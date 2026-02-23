import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const ADMIN_EMAIL  = "aabidaabdessamad@gmail.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GH_TOKEN     = process.env.GITHUB_MODELS_TOKEN ?? "";

async function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const c = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await c.auth.getUser();
  return user?.email === ADMIN_EMAIL ? user : null;
}

// Re-generate one explanation via GitHub Models (non-streaming, returns full text)
async function generateExplanation(question: { texte: string; correction: string | null; source_question: string | null; choices: { id_choix: number; contenu: string; est_correct: boolean }[] }, model = "gpt-4o-mini"): Promise<string | null> {
  if (!GH_TOKEN) return null;

  const SYSTEM = `Tu es ZeroQCM, le meilleur tuteur de médecine du monde, spécialisé pour les étudiants en médecine marocains.

## MISSION
Expliquer chaque option d'un QCM médical avec une profondeur pédagogique maximale : mécanisme, physiopathologie, formules, valeurs de référence, règles mnémotechniques, et erreurs classiques à éviter.

## RÈGLES
1. Français uniquement.
2. Format de sortie : JSON strict — tableau d'objets, sans markdown, sans texte avant/après.
   [{"letter":"A","contenu":"...","est_correct":true,"why":"..."}]
3. Champ "why" : 40–120 mots. Commence par "✓ " (correcte) ou "✗ " (incorrecte). Explique le MÉCANISME. Montre formules + calculs si nécessaire. Cite valeurs normales. Signale pièges avec "⚠️ Piège :". Utilise "💡 Mnémo :" si pertinent.
4. Aucune réponse aux sujets non médicaux. Retourner [] si non médical.`;

  const opts = question.choices
    .map((c, i) => String.fromCharCode(65 + i) + ") " + c.contenu + " [" + (c.est_correct ? "CORRECTE" : "INCORRECTE") + "]")
    .join("\n");
  const corrCtx = question.correction ? "\n\nCorrection officielle : " + question.correction : "";
  const srcCtx  = question.source_question ? " (source : " + question.source_question + ")" : "";
  const userMsg =
    "## QCM Médical" + srcCtx + "\n\n" +
    "**Question :** " + question.texte + "\n\n**Options :**\n" + opts +
    corrCtx +
    "\n\n## Consigne\nExplique chaque option avec profondeur pédagogique maximale (mécanisme, physiopatho, formules si nécessaire, valeurs normales, pièges classiques, mnémotechniques).\nRéponds UNIQUEMENT en JSON.";

  try {
    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + GH_TOKEN },
      body: JSON.stringify({ model, stream: false, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userMsg }], max_tokens: 1600, temperature: 0.15 }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { choices?: { message?: { content?: string } }[] };
    return json?.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { batch = 20, offset = 0, force = false, model = "gpt-4o-mini" } = await req.json().catch(() => ({})) as {
    batch?: number; offset?: number; force?: boolean; model?: string;
  };

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // force=true → regenerate already-explained questions (via join with ai_explanations)
  // force=false → only missing questions (no existing explanation)
  let questions;
  let fetchError;

  if (force) {
    // Fetch questions that ALREADY have an explanation — regenerate those
    const { data, error } = await db
      .from("ai_explanations")
      .select("question_id, questions!inner(id, texte, correction, source_question, choices(id, id_choix, contenu, est_correct))")
      .range(offset, offset + batch - 1)
      .order("question_id");
    fetchError = error;
    questions = (data ?? []).map((row: Record<string, unknown>) => (row.questions as Record<string, unknown>));
  } else {
    // Only questions WITHOUT existing explanations
    const { data: existingIds } = await db.from("ai_explanations").select("question_id");
    const ids = (existingIds ?? []).map((e: Record<string, unknown>) => e.question_id as string);
    let query = db
      .from("questions")
      .select("id, texte, correction, source_question, choices(id, id_choix, contenu, est_correct)")
      .range(offset, offset + batch - 1)
      .order("id");
    if (ids.length > 0) query = query.not("id", "in", `(${ids.slice(0, 1000).join(",")})`);
    const { data, error } = await query;
    fetchError = error;
    questions = data;
  }

  const error = fetchError;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!questions?.length) return NextResponse.json({ done: true, regenerated: 0 });

  let regenerated = 0;
  const errors: string[] = [];

  for (const q of questions) {
    const explanation = await generateExplanation({
      texte: q.texte,
      correction: (q as Record<string, unknown>).correction as string | null,
      source_question: (q as Record<string, unknown>).source_question as string | null,
      choices: ((q as Record<string, unknown>).choices as { id: number; id_choix: number; contenu: string; est_correct: boolean }[]) ?? [],
    }, model);

    if (!explanation) { errors.push(q.id); continue; }

    const { error: upsertErr } = await db.from("ai_explanations").upsert(
      { question_id: q.id, explanation, generated_by: admin.id, model_used: model },
      { onConflict: "question_id" }
    );
    if (upsertErr) errors.push(q.id);
    else regenerated++;
  }

  return NextResponse.json({
    regenerated,
    errors: errors.length,
    next_offset: offset + batch,
    total_in_batch: questions.length,
    done: questions.length < batch,
  });
}

// GET: get regeneration stats
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const [
    { count: totalQ },
    { count: totalExpl },
  ] = await Promise.all([
    db.from("questions").select("id", { count: "exact", head: true }),
    db.from("ai_explanations").select("question_id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    total_questions: totalQ ?? 0,
    total_explained: totalExpl ?? 0,
    missing:         (totalQ ?? 0) - (totalExpl ?? 0),
    coverage_pct:    totalQ ? Math.round(((totalExpl ?? 0) / totalQ) * 100) : 0,
  });
}