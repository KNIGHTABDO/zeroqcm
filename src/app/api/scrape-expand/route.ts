import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DARI_API = "https://dari-qcm-back-production-c027.up.railway.app/api";
const DARI_HEADERS = { "Content-Type": "application/json", "Origin": "https://dariqcm.vip" };

// --- Auth ---
async function register(annee: number): Promise<{ jwt: string; key: Buffer }> {
  const ts = Date.now() + annee;
  const email = `expand_${annee}_${ts}@noreply.fmpc`;
  const res = await fetch(`${DARI_API}/auth/register`, {
    method: "POST",
    headers: DARI_HEADERS,
    body: JSON.stringify({
      nom: "Expand", prenom: `Y${annee}`, email,
      phone: "0600000000", annee_etude: String(annee), mot_de_passe: "Scraper2026!",
    }),
  });
  const data = await res.json() as { token?: string; message?: string };
  if (!data.token) throw new Error(`Auth failed year ${annee}: ${data.message}`);
  return { jwt: data.token, key: crypto.createHash("sha256").update(data.token).digest() };
}

// --- Decrypt ---
function decrypt(enc: { enc: string; iv: string; data: string }, key: Buffer): unknown {
  if (!enc?.enc) return enc;
  const iv = Buffer.from(enc.iv, "base64");
  const ct = Buffer.from(enc.data, "base64");
  const tag = ct.slice(-16);
  const payload = ct.slice(0, -16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8"));
}

// --- API helper ---
async function api<T>(path: string, jwt: string, key: Buffer): Promise<T> {
  const res = await fetch(`${DARI_API}${path}`, {
    headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json", Origin: "https://dariqcm.vip" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  const raw = await res.json() as T | { enc: string; iv: string; data: string };
  if (raw && typeof raw === "object" && "enc" in raw) return decrypt(raw as { enc: string; iv: string; data: string }, key) as T;
  return raw as T;
}

type Semester = { id_semestre: number; semestre_id: string; nom: string; total_modules: number; total_questions: number; total_activities: number };
type Module = { id_module: number; module_id: string; nom: string; description: string | null; total_questions: number; total_activities: number };
type Activity = { id_activite: number; activite_id: string; nom: string; type_activite: string; total_questions: number; chapitre?: string };
type Choice = { id_choix: number; choix_id: string; contenu: string; est_correct: number; pourcentage: string; explication: string | null };
type Question = { id_question: number; question_id: string; texte: string; image_url: string | null; correction: string | null; source_question: string | null; source_type: string; position: number; choices: Choice[] };

const FACULTY_MAP: Record<string, string> = { fmpr: "FMPR", fmpm: "FMPM", um6: "UM6SS", fmpdf: "FMPDF" };
function getFaculty(semId: string): string {
  const s = semId.toLowerCase();
  for (const [k, v] of Object.entries(FACULTY_MAP)) if (s.includes(k)) return v;
  return "FMPC";
}

async function scrapeActivity(act: Activity, jwt: string, key: Buffer, moduleId: number): Promise<{ q: number; c: number }> {
  const dec = await api<{ questions: Question[] }>(`/qcm/activities/${act.id_activite}`, jwt, key);
  const questions = dec.questions ?? [];
  if (!questions.length) return { q: 0, c: 0 };

  // Upsert questions in batches of 200
  for (let i = 0; i < questions.length; i += 200) {
    const batch = questions.slice(i, i + 200).map(q => ({
      id_question: q.id_question, question_id: q.question_id, texte: q.texte,
      image_url: q.image_url, correction: q.correction, source_question: q.source_question,
      source_type: q.source_type, position: q.position,
      activity_id: act.id_activite, module_id: moduleId,
    }));
    await supabase.from("questions").upsert(batch, { onConflict: "id_question" });
  }

  // Fetch back DB IDs
  const idQuestions = questions.map(q => q.id_question);
  const { data: qRows } = await supabase.from("questions").select("id,id_question").in("id_question", idQuestions);
  const qidMap = Object.fromEntries((qRows ?? []).map(r => [r.id_question, r.id]));

  // Build choices
  const choiceRows: object[] = [];
  for (const q of questions) {
    const uid = qidMap[q.id_question];
    if (uid) for (const c of (q.choices ?? [])) choiceRows.push({
      id_choix: c.id_choix, choix_id: c.choix_id, question_id: uid,
      contenu: c.contenu, est_correct: c.est_correct === 1,
      pourcentage: parseFloat(c.pourcentage ?? "0"), explication: c.explication,
    });
  }
  // Upsert choices in batches of 500
  for (let i = 0; i < choiceRows.length; i += 500) {
    await supabase.from("choices").upsert(choiceRows.slice(i, i + 500) as unknown as Record<string, unknown>[], { onConflict: "id_choix" });
  }
  // ── Post-insert correctness fix ──────────────────────────────────────
  // Fix 1: for questions with no est_correct=true, set est_correct=true
  //         on every choice with pourcentage >= 50 (majority-selection proxy).
  if (idQuestions.length > 0) {
    const { data: qRowsFix } = await supabase
      .from("questions")
      .select("id")
      .in("id_question", idQuestions);
    const qUids = (qRowsFix ?? []).map((r: { id: string }) => r.id);

    if (qUids.length > 0) {
      // IDs of questions that still have no correct choice after upsert
      const { data: noCorrectRows } = await supabase
        .from("questions")
        .select("id")
        .in("id", qUids)
        .not("source_type", "in", '("open","no_answer")');

      const allIds = (noCorrectRows ?? []).map((r: { id: string }) => r.id);

      // Among those, find which ones actually lack a correct choice
      const chunkSize = 200;
      const needFixIds: string[] = [];
      for (let i = 0; i < allIds.length; i += chunkSize) {
        const chunk = allIds.slice(i, i + chunkSize);
        const { data: withCorrect } = await supabase
          .from("choices")
          .select("question_id")
          .in("question_id", chunk)
          .eq("est_correct", true);
        const hasCorrectSet = new Set((withCorrect ?? []).map((r: { question_id: string }) => r.question_id));
        chunk.filter(id => !hasCorrectSet.has(id)).forEach(id => needFixIds.push(id));
      }

      if (needFixIds.length > 0) {
        // Fix 1: set est_correct=true for choices with pourcentage >= 50
        for (let i = 0; i < needFixIds.length; i += chunkSize) {
          const chunk = needFixIds.slice(i, i + chunkSize);
          await supabase
            .from("choices")
            .update({ est_correct: true })
            .in("question_id", chunk)
            .gte("pourcentage", 50);
        }

        // Fix 2: still broken? mark highest-pct choice as correct (for pct 1-49)
        const stillBroken: string[] = [];
        for (let i = 0; i < needFixIds.length; i += chunkSize) {
          const chunk = needFixIds.slice(i, i + chunkSize);
          const { data: withCorrect2 } = await supabase
            .from("choices")
            .select("question_id")
            .in("question_id", chunk)
            .eq("est_correct", true);
          const hasCorrect2 = new Set((withCorrect2 ?? []).map((r: { question_id: string }) => r.question_id));
          chunk.filter(id => !hasCorrect2.has(id)).forEach(id => stillBroken.push(id));
        }

        if (stillBroken.length > 0) {
          // Fix 2: for each still-broken question, pick the highest-pourcentage choice
          for (let i = 0; i < stillBroken.length; i += chunkSize) {
            const chunk = stillBroken.slice(i, i + chunkSize);
            const { data: allChoices } = await supabase
              .from("choices")
              .select("id, question_id, pourcentage")
              .in("question_id", chunk)
              .gt("pourcentage", 0)
              .order("pourcentage", { ascending: false });

            const bestChoice: Record<string, string> = {};
            for (const c of (allChoices ?? [])) {
              if (!bestChoice[c.question_id]) bestChoice[c.question_id] = c.id;
            }
            const bestIds = Object.values(bestChoice);
            if (bestIds.length > 0) {
              await supabase.from("choices").update({ est_correct: true }).in("id", bestIds);
            }
          }

          // Fix 3: fully-zero pct questions → tag as no_answer (exclude from scored quiz)
          const zeroIds: string[] = [];
          for (let i = 0; i < stillBroken.length; i += chunkSize) {
            const chunk = stillBroken.slice(i, i + chunkSize);
            const { data: withCorrect3 } = await supabase
              .from("choices").select("question_id").in("question_id", chunk).eq("est_correct", true);
            const hasCorrect3 = new Set((withCorrect3 ?? []).map((r: { question_id: string }) => r.question_id));
            chunk.filter(id => !hasCorrect3.has(id)).forEach(id => zeroIds.push(id));
          }
          if (zeroIds.length > 0) {
            for (let i = 0; i < zeroIds.length; i += chunkSize) {
              await supabase.from("questions").update({ source_type: "no_answer" }).in("id", zeroIds.slice(i, i + chunkSize));
            }
          }
        }
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────
  return { q: questions.length, c: choiceRows.length };
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { year } = await req.json() as { year?: number };
  if (!year || year < 2 || year > 5) return NextResponse.json({ error: "year must be 2-5" }, { status: 400 });

  const stats = { semesters: 0, modules: 0, activities: 0, questions: 0, choices: 0, errors: 0 };
  const errorLog: string[] = [];

  try {
    const { jwt, key } = await register(year);
    const semesters = await api<Semester[]>("/qcm/semesters", jwt, key);

    for (const sem of semesters) {
      const faculty = getFaculty(sem.semestre_id);
      await supabase.from("semesters").upsert({
        semestre_id: sem.semestre_id, nom: sem.nom, faculty,
        total_modules: sem.total_modules, total_questions: sem.total_questions,
        total_activities: sem.total_activities,
      }, { onConflict: "semestre_id" });
      stats.semesters++;

      const modules = await api<Module[]>(`/qcm/semesters/${sem.id_semestre}/modules`, jwt, key);
      for (const mod of modules) {
        await supabase.from("modules").upsert({
          id: mod.id_module, module_id: mod.module_id, nom: mod.nom,
          description: mod.description, semester_id: sem.semestre_id,
          total_questions: mod.total_questions, total_activities: mod.total_activities,
        }, { onConflict: "id" });
        stats.modules++;

        const activities = await api<Activity[]>(`/qcm/modules/${mod.id_module}/activities`, jwt, key);
        // Upsert activities in bulk
        const actRows = activities.map(act => ({
          id: act.id_activite, activite_id: act.activite_id, nom: act.nom,
          type_activite: act.type_activite, module_id: mod.id_module,
          total_questions: act.total_questions, chapitre: act.chapitre ?? null,
        }));
        for (let i = 0; i < actRows.length; i += 100) {
          await supabase.from("activities").upsert(actRows.slice(i, i + 100), { onConflict: "id" });
        }
        stats.activities += activities.length;

        // Scrape activities with concurrency 10 using Promise.all on batches
        const CONCURRENCY = 10;
        for (let i = 0; i < activities.length; i += CONCURRENCY) {
          const batch = activities.slice(i, i + CONCURRENCY);
          const results = await Promise.allSettled(batch.map(act => scrapeActivity(act, jwt, key, mod.id_module)));
          for (const r of results) {
            if (r.status === "fulfilled") { stats.questions += r.value.q; stats.choices += r.value.c; }
            else { stats.errors++; errorLog.push(r.reason?.message?.slice(0, 80) ?? "?"); }
          }
        }
      }
    }
  } catch (e) {
    return NextResponse.json({ error: String(e), stats }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stats, errors: errorLog.slice(0, 20) });
}
