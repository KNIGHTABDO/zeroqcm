// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

const DARI_API = "https://dari-qcm-back-production-c027.up.railway.app/api";
const DARI_ORIGIN = "https://dariqcm.vip";

// ── Auth ──────────────────────────────────────────────────────────────────────
async function getDariToken(anneeEtude: number): Promise<string> {
  const ts = Date.now();
  const res = await fetch(`${DARI_API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": DARI_ORIGIN },
    body: JSON.stringify({
      nom: "Sync", prenom: `Y${anneeEtude}`,
      email: `sync_y${anneeEtude}_${ts}@noreply.fmpc`,
      phone: "0600000000", annee_etude: String(anneeEtude),
      mot_de_passe: "Scraper2026!",
    }),
  });
  const d = (await res.json()) as { token?: string };
  if (!d.token) throw new Error(`DariQCM auth failed yr${anneeEtude}`);
  return d.token;
}

// ── AES-256-GCM decrypt (odd sem responses are encrypted) ────────────────────
function dariDecrypt(enc: { enc: string; iv: string; data: string }, token: string): unknown {
  const key = crypto.createHash("sha256").update(token).digest();
  const iv  = Buffer.from(enc.iv, "base64");
  const ct  = Buffer.from(enc.data, "base64");
  const tag = ct.slice(-16);
  const payload = ct.slice(0, -16);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(payload), d.final()]).toString("utf8"));
}

async function dariGet<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${DARI_API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", Origin: DARI_ORIGIN },
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as T | { enc: string; iv: string; data: string };
    if (raw && typeof raw === "object" && "enc" in raw) {
      return dariDecrypt(raw as { enc: string; iv: string; data: string }, token) as T;
    }
    return raw as T;
  } catch { return null; }
}

// ── Direct module question fetch (used for even sems + pharmacy) ─────────────
async function fetchModuleQuestions(moduleId: number, token: string): Promise<DariQuestion[]> {
  const res = await fetch(`${DARI_API}/modules/${moduleId}/questions`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", Origin: DARI_ORIGIN },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ── Interfaces ────────────────────────────────────────────────────────────────
interface DariSemester {
  id_semestre: number; semestre_id: string; nom: string;
  total_modules: number; total_questions: number; total_activities: number;
}
interface DariModule {
  id_module: number; module_id: string; nom: string; description: string | null;
  total_questions: number; total_activities: number; id_semestre?: number; semestre_nom?: string;
}
interface DariActivity {
  id_activite: number; activite_id: string; nom: string;
  type_activite: string; total_questions: number; chapitre?: string;
}
interface DariChoice {
  id_choix: number; choix_id: string; contenu: string;
  est_correct: number; pourcentage: string; explication: string | null;
}
interface DariQuestion {
  id_question: number; question_id: string; texte: string;
  image_url: string | null; correction: string | null;
  source_qst?: string | null; source_question?: string | null;
  source_type: string; position: number;
  choices: DariChoice[];
}
interface DariActivityPayload { questions: DariQuestion[] }
interface SyncStats {
  semesters_new: string[]; modules_new: string[];
  activities_synced: number; questions_added: number;
  errors: string[]; started_at: string; finished_at?: string; duration_ms?: number;
}

// ── Faculty lookup (odd sems via /qcm/semesters) ──────────────────────────────
const SEM_FACULTY: Record<string, string> = {
  s1:"FMPC", s3:"FMPC", s5:"FMPC", s7:"FMPC", s9:"FMPC",
  s1_FMPDF:"FMPDF",
  S1_FMPM:"FMPM", S3_FMPM:"FMPM", S5_FMPM:"FMPM", S7_FMPM:"FMPM", S9_FMPM:"FMPM",
  S1_FMPR:"FMPR", S3_FMPR:"FMPR", S5_FMPR:"FMPR", S7_FMPR:"FMPR", S9_FMPR:"FMPR",
  S1_UM6:"UM6SS", S3_UM6:"UM6SS", S5_UM6:"UM6SS", S7_UM6:"UM6SS", S9_UM6:"UM6SS",
};

// ── Direct-seed semesters (even + pharmacy) — NOT accessible via /qcm/semesters ──
// These are fetched directly via /api/modules/{id}/questions
const DIRECT_SEMESTERS = [
  // ── Even sems FMPC ──
  { semestre_id: "s2",      nom: "S2 FMPC",            faculty: "FMPC",
    modules: [
      { id: 1,  nom: "Anatomie 2" },        { id: 2,  nom: "Anatomie 2-(UM6)" },
      { id: 53, nom: "Anglais" },            { id: 54, nom: "Digital Skills" },
      { id: 5,  nom: "Hématologie fondamentale" },
      { id: 3,  nom: "Histologie Embrylogie 1" },
      { id: 4,  nom: "Histologie Embrylogie 2" },
      { id: 6,  nom: "Microbiologie Immunologie" }, { id: 7, nom: "Physiologie 1" },
      { id: 8,  nom: "Stage d'immersion Structures de soins" },
      { id: 9,  nom: "Techniques de Communication" },
    ]},
  // ── Even sems FMPM ──
  { semestre_id: "S2_FMPM", nom: "S2 FMPM", faculty: "FMPM",
    modules: [
      { id: 119, nom: "Anatomie II" },        { id: 120, nom: "Biophysique" },
      { id: 121, nom: "Digital skills" },     { id: 122, nom: "English" },
      { id: 123, nom: "Hématologie" },        { id: 124, nom: "Immuno-hémato (nouvelle réforme)" },
      { id: 125, nom: "Microbiologie" },      { id: 126, nom: "Physiologie I" },
      { id: 127, nom: "Tice & Communication" },
    ]},
  { semestre_id: "s4",      nom: "S4 FMPC", faculty: "FMPC",
    modules: [
      { id: 12, nom: "Hématologie" }, { id: 14, nom: "Sémiologie 2" },
      { id: 15, nom: "Stage d'immersion en médecine sociale" },
    ]},
  { semestre_id: "S4_FMPM", nom: "S4 FMPM", faculty: "FMPM",
    modules: [
      { id: 135, nom: "Anapath II" },              { id: 136, nom: "Anatomie Pathologique" },
      { id: 137, nom: "Parasito - Maladie infectieuse" },
      { id: 138, nom: "Pharmacologie" },            { id: 139, nom: "Radiologie" },
      { id: 140, nom: "Sémiologie II" },
    ]},
  { semestre_id: "s6",      nom: "S6 FMPC", faculty: "FMPC",
    modules: [
      { id: 16, nom: "Maladies de l'Appareil Cardio-vasculaire" },
      { id: 17, nom: "Maladies de l'Appareil digestif" },
      { id: 18, nom: "Maladies de l'Appareil Respiratoire" },
    ]},
  { semestre_id: "S6_FMPM", nom: "S6 FMPM", faculty: "FMPM",
    modules: [{ id: 145, nom: "Cardio - CCV" }, { id: 146, nom: "Pneumo - Chir thoracique" }]},
  { semestre_id: "s8",      nom: "S8 FMPC", faculty: "FMPC",
    modules: [
      { id: 19, nom: "Immuno-Pathologie Génétique" },
      { id: 20, nom: "Maladies de l'Appareil locomoteur" },
      { id: 21, nom: "Maladies de l'Enfant" },
    ]},
  { semestre_id: "S8_FMPM", nom: "S8 FMPM", faculty: "FMPM",
    modules: [
      { id: 151, nom: "Anapath II" }, { id: 152, nom: "Appareil Locomoteur" },
      { id: 153, nom: "Immuno - génétique - med interne" },
    ]},
  { semestre_id: "s10",     nom: "S10 FMPC", faculty: "FMPC",
    modules: [
      { id: 22, nom: "Gynécologie Obstétrique" },
      { id: 23, nom: "Médecine Légale et Médecine de travail Ethique et Déontologie" },
      { id: 24, nom: "NEPHROLOGIE -UROLOGIE" }, { id: 25, nom: "ORL - OPHTALMOLOGIE" },
    ]},
  { semestre_id: "S10_FMPM",nom: "S10 FMPM", faculty: "FMPM",
    modules: [
      { id: 115, nom: "Med legal-éthique-travail-deontology" },
      { id: 116, nom: "Néphrologie-Urologie" },
      { id: 117, nom: "Santé publique" }, { id: 118, nom: "Synthèse thérapeutique" },
    ]},
  // ── Pharmacy UM6SS (S5 + S7) — NOT exposed via /qcm/semesters at all ──
  { semestre_id: "S5_PHARMA_UM6", nom: "S5 Pharmacie UM6SS", faculty: "UM6SS",
    modules: [
      { id: 158, nom: "Chimie analytique instrumentale" },
      { id: 159, nom: "Hematologie biologie" },
      { id: 160, nom: "Microbiologie" },
      { id: 166, nom: "pharmacie galenique I" },
      { id: 161, nom: "Pharmacie galenique TP" },
      { id: 162, nom: "Pharmacognosie speciale" },
      { id: 167, nom: "pharmacologie speciale I" },
      { id: 164, nom: "Tp hematologie biologie" },
      { id: 163, nom: "TP MICROBIOLOGIE" },
      { id: 165, nom: "Tp pharmacologie speciale I" },
    ]},
  { semestre_id: "S7_PHARMA_UM6", nom: "S7 Pharmacie UM6SS", faculty: "UM6SS",
    modules: [
      { id: 168, nom: "Biochimie pre-instrumentale" },
      { id: 169, nom: "Mycologie" },
      { id: 174, nom: "pharmacotechnie" },
      { id: 175, nom: "semiologie" },
      { id: 173, nom: "Tp mycologie" },
      { id: 170, nom: "TP pharmacotechnie" },
      { id: 171, nom: "TP toxicologie" },
      { id: 172, nom: "TP toxicologie 2" },
    ]},
] as const;

// ── Upsert a batch of questions + choices from direct module fetch ─────────────
async function syncDirectModule(
  moduleId: number, moduleName: string, semId: string,
  supabase: ReturnType<typeof createClient<any>>, token: string,
  stats: SyncStats, forceRefetch = false
): Promise<void> {
  try {
    // Check if module needs update
    const { data: dbMod } = await supabase
      .from("modules").select("id, total_questions").eq("id", moduleId).maybeSingle() as
      { data: { id: number; total_questions: number } | null };

    // Fetch from DariQCM to get real count
    const questions = await fetchModuleQuestions(moduleId, token);
    if (!questions.length) return;

    const dariCount = questions.length;
    const dbCount = dbMod?.total_questions ?? 0;

    // Skip if counts match and not force-refetch
    if (!forceRefetch && dbMod && dbCount === dariCount) return;

    // Upsert module row
    await supabase.from("modules").upsert({
      id: moduleId, module_id: String(moduleId), nom: moduleName,
      semester_id: semId, total_questions: dariCount, total_activities: 0,
    }, { onConflict: "id" });

    if (!dbMod) stats.modules_new.push(moduleName);

    // Upsert questions in batches of 200
    for (let i = 0; i < questions.length; i += 200) {
      const batch = questions.slice(i, i + 200).map((q) => ({
        id_question: q.id_question,
        question_id: q.question_id ?? String(q.id_question),
        texte: q.texte, image_url: q.image_url ?? null,
        correction: q.correction ?? null,
        source_question: q.source_qst ?? q.source_question ?? null,
        source_type: q.source_type ?? "qcm",
        position: q.position ?? 0,
        activity_id: null, module_id: moduleId,
      }));
      await supabase.from("questions").upsert(batch, { onConflict: "id_question" });
    }

    // Fetch back DB UUIDs for choices
    const idQs = questions.map((q) => q.id_question);
    const { data: qRows } = await supabase
      .from("questions").select("id,id_question").in("id_question", idQs);
    const qidMap = Object.fromEntries((qRows ?? []).map((r) => [r.id_question, r.id]));

    // Upsert choices in batches of 500
    const choiceRows: Record<string, unknown>[] = [];
    for (const q of questions) {
      const uid = qidMap[q.id_question];
      if (uid) {
        for (const c of q.choices ?? []) {
          choiceRows.push({
            id_choix: c.id_choix,
            choix_id: c.choix_id ?? String(c.id_choix),
            question_id: uid, contenu: c.contenu,
            est_correct: c.est_correct === 1,
            pourcentage: parseFloat(c.pourcentage ?? "0"),
            explication: c.explication ?? null,
          });
        }
      }
    }
    for (let i = 0; i < choiceRows.length; i += 500) {
      await supabase.from("choices").upsert(choiceRows.slice(i, i + 500), { onConflict: "id_choix" });
    }

    const newQs = dariCount - dbCount;
    if (newQs > 0) stats.questions_added += newQs;
    stats.activities_synced++;
  } catch (e) {
    stats.errors.push(`Module ${moduleId} "${moduleName}": ${String(e).slice(0, 80)}`);
  }
}

// ── Sync one activity from /qcm/activities/{id} (odd sems) ───────────────────
async function syncActivity(
  act: DariActivity, modId: number,
  supabase: ReturnType<typeof createClient<any>>,
  token: string, stats: SyncStats
): Promise<void> {
  const { data: existing } = await supabase
    .from("activities").select("id, total_questions").eq("id", act.id_activite).maybeSingle() as
    { data: { id: number; total_questions: number } | null };
  if (existing && existing.total_questions === act.total_questions) return;

  await supabase.from("activities").upsert(
    { id: act.id_activite, activite_id: act.activite_id, nom: act.nom,
      type_activite: act.type_activite, module_id: modId,
      total_questions: act.total_questions, chapitre: act.chapitre ?? null },
    { onConflict: "id" }
  );

  const payload = await dariGet<DariActivityPayload>(`/qcm/activities/${act.id_activite}`, token);
  if (!payload?.questions?.length) return;

  for (const q of payload.questions) {
    const { data: qRow } = await supabase.from("questions").upsert(
      { id_question: q.id_question, question_id: q.question_id, texte: q.texte,
        image_url: q.image_url, correction: q.correction,
        source_question: q.source_question ?? null,
        source_type: q.source_type, position: q.position,
        activity_id: act.id_activite, module_id: modId },
      { onConflict: "id_question" }
    ).select("id").maybeSingle() as { data: { id: number } | null };

    if (qRow?.id && q.choices?.length) {
      for (const c of q.choices) {
        await supabase.from("choices").upsert(
          { id_choix: c.id_choix, choix_id: c.choix_id, question_id: qRow.id,
            contenu: c.contenu, est_correct: c.est_correct === 1,
            pourcentage: parseFloat(c.pourcentage ?? "0"), explication: c.explication },
          { onConflict: "id_choix" }
        );
      }
    }
    stats.questions_added++;
  }
  stats.activities_synced++;
  await new Promise<void>(r => setTimeout(r, 80));
}

// ── Main sync ─────────────────────────────────────────────────────────────────
async function runSync(
  supabase: ReturnType<typeof createClient<any>>,
  targetYear?: number
): Promise<SyncStats> {
  const stats: SyncStats = {
    semesters_new: [], modules_new: [],
    activities_synced: 0, questions_added: 0,
    errors: [], started_at: new Date().toISOString(),
  };
  const start = Date.now();
  const TIMEOUT_MS = 255_000;

  try {
    // ── 1. Fetch existing semesters + modules from DB ──
    const { data: dbSems } = await supabase
      .from("semesters").select("semestre_id, total_activities, total_questions") as
      { data: { semestre_id: string; total_activities: number; total_questions: number }[] | null };
    const dbSemMap = new Map((dbSems ?? []).map(s => [s.semestre_id, s]));

    const { data: dbMods } = await supabase
      .from("modules").select("id, total_activities, total_questions") as
      { data: { id: number; total_activities: number; total_questions: number }[] | null };
    const dbModMap = new Map((dbMods ?? []).map(m => [m.id, m]));

    // ── 2. PART A — Odd sems via /qcm/semesters (years 1–5) ──
    const DARI_YEARS = [1, 2, 3, 4, 5] as const;
    const years = targetYear ? [targetYear] : [...DARI_YEARS];

    for (const yr of years) {
      if (Date.now() - start > TIMEOUT_MS) {
        stats.errors.push(`Timeout guard: year ${yr} not started`);
        break;
      }

      let token: string;
      try { token = await getDariToken(yr); }
      catch (e) { stats.errors.push(`Auth yr${yr}: ${String(e)}`); continue; }

      const dariSems = await dariGet<DariSemester[]>("/qcm/semesters", token);
      if (!dariSems?.length) { stats.errors.push(`yr${yr}: no semesters`); continue; }

      for (const sem of dariSems) {
        if (Date.now() - start > TIMEOUT_MS) {
          stats.errors.push("Timeout: partial sync — resume with ?year=" + yr);
          break;
        }

        const faculty = SEM_FACULTY[sem.semestre_id] ?? "FMPC";
        const isNew = !dbSemMap.has(sem.semestre_id);

        await supabase.from("semesters").upsert(
          { semestre_id: sem.semestre_id, nom: sem.nom, faculty,
            total_modules: sem.total_modules, total_questions: sem.total_questions,
            total_activities: sem.total_activities },
          { onConflict: "semestre_id" }
        );
        if (isNew) stats.semesters_new.push(sem.nom);

        const dbSem = dbSemMap.get(sem.semestre_id);
        if (!isNew && dbSem?.total_activities === sem.total_activities) continue;

        const modules = await dariGet<DariModule[]>(`/qcm/semesters/${sem.id_semestre}/modules`, token);
        if (!modules?.length) continue;

        const { data: semDbMods } = await supabase
          .from("modules").select("id, total_activities").eq("semester_id", sem.semestre_id) as
          { data: { id: number; total_activities: number }[] | null };
        const semDbModMap = new Map((semDbMods ?? []).map(m => [m.id, m]));

        for (const mod of modules) {
          if (Date.now() - start > TIMEOUT_MS) break;
          const modIsNew = !semDbModMap.has(mod.id_module);

          await supabase.from("modules").upsert(
            { id: mod.id_module, module_id: mod.module_id, nom: mod.nom,
              description: mod.description, semester_id: sem.semestre_id,
              total_questions: mod.total_questions, total_activities: mod.total_activities },
            { onConflict: "id" }
          );
          if (modIsNew) stats.modules_new.push(mod.nom);

          const dbMod = semDbModMap.get(mod.id_module);
          if (!modIsNew && dbMod?.total_activities === mod.total_activities) continue;

          const activities = await dariGet<DariActivity[]>(`/qcm/modules/${mod.id_module}/activities`, token);
          if (!activities?.length) continue;

          for (const act of activities) {
            if (Date.now() - start > TIMEOUT_MS) break;
            try { await syncActivity(act, mod.id_module, supabase, token, stats); }
            catch (e) { stats.errors.push(`Act "${act.nom}": ${String(e).slice(0, 80)}`); }
          }
        }
      }
    }

    // ── 3. PART B — Even sems + Pharmacy via /api/modules/{id}/questions ──
    // Only runs when not in year-specific mode (targetYear means odd-sem specific)
    if (!targetYear) {
      // Get one generic token for direct module fetching
      let genericToken: string;
      try { genericToken = await getDariToken(1); }
      catch (e) { stats.errors.push(`Direct-sem auth: ${String(e)}`); genericToken = ""; }

      if (genericToken) {
        const CONCURRENCY = 5;

        for (const sem of DIRECT_SEMESTERS) {
          if (Date.now() - start > TIMEOUT_MS) break;

          await supabase.from("semesters").upsert({
            semestre_id: sem.semestre_id, nom: sem.nom, faculty: sem.faculty,
            total_modules: sem.modules.length, total_questions: 0, total_activities: 0,
          }, { onConflict: "semestre_id" });

          const isNew = !dbSemMap.has(sem.semestre_id);
          if (isNew) stats.semesters_new.push(sem.nom);

          let semTotal = 0;
          for (let i = 0; i < sem.modules.length; i += CONCURRENCY) {
            if (Date.now() - start > TIMEOUT_MS) break;
            const batch = sem.modules.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map(mod =>
              syncDirectModule(mod.id, mod.nom, sem.semestre_id, supabase, genericToken, stats)
            ));
          }

          // Update semester total_questions from actual DB count
          const { data: semQCount } = await supabase
            .from("questions")
            .select("id", { count: "exact", head: true })
            .in("module_id", sem.modules.map(m => m.id)) as { data: null; count: number | null };
          if (semQCount !== null && semQCount > 0) {
            await supabase.from("semesters")
              .update({ total_questions: semQCount })
              .eq("semestre_id", sem.semestre_id);
          }
        }
      }
    }

  } catch (e) {
    stats.errors.push(`Fatal: ${String(e).slice(0, 200)}`);
  }

  stats.finished_at = new Date().toISOString();
  stats.duration_ms = Date.now() - start;
  return stats;
}

// ── HTTP handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = req.headers.get("x-vercel-cron") === "1";
  const auth = req.headers.get("authorization");

  if (cronSecret && !isCron && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const yearParam = req.nextUrl.searchParams.get("year");
  const targetYear = yearParam ? parseInt(yearParam) : undefined;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const stats = await runSync(supabase, targetYear);
  const hasNew = stats.semesters_new.length > 0 || stats.activities_synced > 0 || stats.questions_added > 0;

  return NextResponse.json({
    ok: true, changed: hasNew,
    year: targetYear ?? "all",
    summary: hasNew
      ? `+${stats.semesters_new.length} new sems, +${stats.activities_synced} activities, +${stats.questions_added} questions`
      : "Up to date",
    stats,
  });
}
