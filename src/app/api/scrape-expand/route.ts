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
    await supabase.from("choices").upsert(choiceRows.slice(i, i + 500) as Parameters<typeof supabase.from>[0][], { onConflict: "id_choix" });
  }
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
