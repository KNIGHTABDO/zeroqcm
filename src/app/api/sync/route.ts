import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Pro: up to 300s

const DARI_API = "https://dari-qcm-back-production-c027.up.railway.app/api";
const DARI_ORIGIN = "https://dariqcm.vip";

// ── Auth ───────────────────────────────────────────────────────────────────
async function getDariToken(): Promise<string> {
  const ts = Date.now();
  const email = `sync_${ts}@noreply.fmpc`;
  const res = await fetch(`${DARI_API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": DARI_ORIGIN },
    body: JSON.stringify({
      nom: "Sync", prenom: "Bot",
      email, phone: "0600000000",
      annee_etude: "1", mot_de_passe: "Scraper2026!",
    }),
  });
  const d = await res.json() as { token?: string };
  if (!d.token) throw new Error(`DariQCM auth failed: ${JSON.stringify(d)}`);
  return d.token;
}

// ── Decrypt ────────────────────────────────────────────────────────────────
function dariDecrypt(enc: { enc: string; iv: string; data: string }, token: string): unknown {
  if (!enc?.enc) return enc;
  const key = crypto.createHash("sha256").update(token).digest();
  const iv = Buffer.from(enc.iv, "base64");
  const ct = Buffer.from(enc.data, "base64");
  const tag = ct.slice(-16);
  const payload = ct.slice(0, -16);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(payload), d.final()]).toString("utf8"));
}

// ── API fetch ──────────────────────────────────────────────────────────────
async function dariGet<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${DARI_API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        Origin: DARI_ORIGIN,
      },
    });
    if (!res.ok) return null;
    const raw = await res.json() as T | { enc: string; iv: string; data: string };
    if (raw && typeof raw === "object" && "enc" in raw) {
      return dariDecrypt(raw as { enc: string; iv: string; data: string }, token) as T;
    }
    return raw as T;
  } catch {
    return null;
  }
}

// ── DariQCM types ──────────────────────────────────────────────────────────
interface DariSemester {
  id_semestre: number;
  semestre_id: string;
  nom: string;
  total_modules: number;
  total_questions: number;
  total_activities: number;
}
interface DariModule {
  id_module: number;
  module_id: string;
  nom: string;
  description: string | null;
  total_questions: number;
  total_activities: number;
}
interface DariActivity {
  id_activite: number;
  activite_id: string;
  nom: string;
  type_activite: string;
  total_questions: number;
  chapitre?: string;
}
interface DariQuestion {
  id_question: number;
  question_id: string;
  texte: string;
  image_url: string | null;
  correction: string | null;
  source_question: string | null;
  source_type: string;
  position: number;
  choices: {
    id_choix: number;
    choix_id: string;
    contenu: string;
    est_correct: number;
    pourcentage: string;
    explication: string | null;
  }[];
}

// ── Helper: infer faculty from semestre_id ─────────────────────────────────
function inferFaculty(semId: string): string {
  const s = semId.toLowerCase();
  if (s.includes("fmpr")) return "FMPR";
  if (s.includes("fmpm")) return "FMPM";
  if (s.includes("um6"))  return "UM6SS";
  if (s.includes("fmpdf")) return "FMPDF";
  return "FMPC";
}

// ── Sync one activity ──────────────────────────────────────────────────────
async function syncActivity(
  act: DariActivity,
  modId: number,
  supabase: ReturnType<typeof createClient>,
  token: string,
  stats: SyncStats
): Promise<void> {
  // Check if activity already fully synced (id_activite exists in DB with same total_questions)
  const { data: existing } = await supabase
    .from("activities")
    .select("id, total_questions")
    .eq("id", act.id_activite)
    .maybeSingle();

  // Skip if already in DB with same question count
  if (existing && existing.total_questions === act.total_questions) {
    return;
  }

  // Upsert activity row
  await supabase.from("activities").upsert({
    id: act.id_activite,
    activite_id: act.activite_id,
    nom: act.nom,
    type_activite: act.type_activite,
    module_id: modId,
    total_questions: act.total_questions,
    chapitre: act.chapitre ?? null,
  }, { onConflict: "id" });

  // Fetch and decrypt questions
  const payload = await dariGet<{ questions: DariQuestion[] }>(
    `/qcm/activities/${act.id_activite}`, token
  );
  if (!payload?.questions?.length) return;

  for (const q of payload.questions) {
    const { data: qRow } = await supabase.from("questions").upsert({
      id_question: q.id_question,
      question_id: q.question_id,
      texte: q.texte,
      image_url: q.image_url,
      correction: q.correction,
      source_question: q.source_question,
      source_type: q.source_type,
      position: q.position,
      activity_id: act.id_activite,
      module_id: modId,
    }, { onConflict: "id_question" }).select("id").maybeSingle();

    if (qRow?.id && q.choices?.length) {
      for (const c of q.choices) {
        await supabase.from("choices").upsert({
          id_choix: c.id_choix,
          choix_id: c.choix_id,
          question_id: qRow.id,
          contenu: c.contenu,
          est_correct: c.est_correct === 1,
          pourcentage: parseFloat(c.pourcentage ?? "0"),
          explication: c.explication,
        }, { onConflict: "id_choix" });
      }
    }
    stats.questions_added++;
  }

  stats.activities_synced++;
  await new Promise(r => setTimeout(r, 100)); // gentle rate limiting
}

interface SyncStats {
  semesters_new: string[];
  modules_new: string[];
  activities_synced: number;
  questions_added: number;
  errors: string[];
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
}

// ── Main sync ──────────────────────────────────────────────────────────────
async function runSync(supabase: ReturnType<typeof createClient>): Promise<SyncStats> {
  const stats: SyncStats = {
    semesters_new: [],
    modules_new: [],
    activities_synced: 0,
    questions_added: 0,
    errors: [],
    started_at: new Date().toISOString(),
  };

  const start = Date.now();
  const TIMEOUT_MS = 260_000; // leave 40s buffer from maxDuration

  try {
    const token = await getDariToken();

    // 1. Fetch all semesters from DariQCM
    const dariSems = await dariGet<DariSemester[]>("/qcm/semesters", token);
    if (!dariSems?.length) {
      stats.errors.push("DariQCM returned no semesters — API may be temporarily down");
      return stats;
    }

    // 2. Load existing semesters from our DB
    const { data: dbSems } = await supabase.from("semesters")
      .select("semestre_id, total_activities");
    const dbSemMap = new Map((dbSems ?? []).map(s => [s.semestre_id, s]));

    // 3. Walk each DariQCM semester
    for (const sem of dariSems) {
      if (Date.now() - start > TIMEOUT_MS) {
        stats.errors.push("Timeout: partial sync — will resume on next run");
        break;
      }

      const faculty = inferFaculty(sem.semestre_id);
      const isNew = !dbSemMap.has(sem.semestre_id);

      // Upsert semester row (always refresh totals)
      await supabase.from("semesters").upsert({
        semestre_id: sem.semestre_id,
        nom: sem.nom,
        faculty,
        total_modules: sem.total_modules,
        total_questions: sem.total_questions,
        total_activities: sem.total_activities,
      }, { onConflict: "semestre_id" });

      if (isNew) {
        stats.semesters_new.push(sem.nom);
      }

      // Skip expensive module walk if nothing changed in this semester
      const dbSem = dbSemMap.get(sem.semestre_id);
      if (!isNew && dbSem?.total_activities === sem.total_activities) {
        continue; // no new activities — skip this semester entirely
      }

      // 4. Walk modules
      const modules = await dariGet<DariModule[]>(
        `/qcm/semesters/${sem.id_semestre}/modules`, token
      );
      if (!modules?.length) continue;

      // Load existing module IDs for this semester
      const { data: dbMods } = await supabase.from("modules")
        .select("id, total_activities")
        .eq("semester_id", sem.semestre_id);
      const dbModMap = new Map((dbMods ?? []).map(m => [m.id, m]));

      for (const mod of modules) {
        if (Date.now() - start > TIMEOUT_MS) break;

        const modIsNew = !dbModMap.has(mod.id_module);

        await supabase.from("modules").upsert({
          id: mod.id_module,
          module_id: mod.module_id,
          nom: mod.nom,
          description: mod.description,
          semester_id: sem.semestre_id,
          total_questions: mod.total_questions,
          total_activities: mod.total_activities,
        }, { onConflict: "id" });

        if (modIsNew) stats.modules_new.push(mod.nom);

        // Skip if module has same activity count
        const dbMod = dbModMap.get(mod.id_module);
        if (!modIsNew && dbMod?.total_activities === mod.total_activities) {
          continue;
        }

        // 5. Walk activities
        const activities = await dariGet<DariActivity[]>(
          `/qcm/modules/${mod.id_module}/activities`, token
        );
        if (!activities?.length) continue;

        for (const act of activities) {
          if (Date.now() - start > TIMEOUT_MS) break;
          try {
            await syncActivity(act, mod.id_module, supabase, token, stats);
          } catch (e) {
            stats.errors.push(`Activity ${act.nom}: ${String(e).slice(0, 100)}`);
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

// ── Route handler ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Protect: only Vercel cron or requests with correct secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isCronCall = req.headers.get("x-vercel-cron") === "1";

  if (cronSecret && !isCronCall && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const stats = await runSync(supabase);

  // Persist last sync result to a sync_log table (if exists) or just return it
  const hasNew = stats.semesters_new.length > 0 || stats.activities_synced > 0;

  return NextResponse.json({
    ok: true,
    changed: hasNew,
    stats,
    summary: hasNew
      ? `+${stats.semesters_new.length} semesters, +${stats.activities_synced} activities, +${stats.questions_added} questions`
      : "No changes — DB is up to date",
  });
}
