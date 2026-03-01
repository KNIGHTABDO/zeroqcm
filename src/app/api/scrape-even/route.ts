import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DARI_API = "https://dari-qcm-back-production-c027.up.railway.app/api";
const DARI_HEADERS = { "Content-Type": "application/json", "Origin": "https://dariqcm.vip" };

// ── Auth ──────────────────────────────────────────────────────────────
async function register(): Promise<string> {
  const ts = Date.now();
  const res = await fetch(`${DARI_API}/auth/register`, {
    method: "POST",
    headers: DARI_HEADERS,
    body: JSON.stringify({
      nom: "Seed", prenom: "Even",
      email: `seed_even_${ts}@noreply.fmpc`,
      phone: "0600000000", annee_etude: "1", mot_de_passe: "Scraper2026!",
    }),
  });
  const data = await res.json() as { token?: string; message?: string };
  if (!data.token) throw new Error(`Auth failed: ${data.message}`);
  return data.token;
}

// ── Even semesters config (confirmed live on DariQCM Feb 27 2026) ─────
const EVEN_SEMESTERS = [
  {
    semestre_id: "s2", nom: "S2 FMPC", faculty: "FMPC",
    modules: [
      { id: 1,  nom: "Anatomie 2" },
      { id: 2,  nom: "Anatomie 2-(UM6)" },
      { id: 53, nom: "Anglais" },
      { id: 54, nom: "Digital Skills" },
      { id: 5,  nom: "Hématologie fondamentale" },
      { id: 3,  nom: "Histologie Embrylogie 1" },
      { id: 4,  nom: "Histologie Embrylogie 2" },
      { id: 6,  nom: "Microbiologie Immunologie" },
      { id: 7,  nom: "Physiologie 1" },
      { id: 8,  nom: "Stage d'immersion Structures de soins" },
      { id: 9,  nom: "Techniques de Communication" },
    ],
  },
  {
    semestre_id: "S2_FMPM", nom: "S2 FMPM", faculty: "FMPM",
    modules: [
      { id: 119, nom: "Anatomie II" },
      { id: 120, nom: "Biophysique" },
      { id: 121, nom: "Digital skills" },
      { id: 122, nom: "English" },
      { id: 123, nom: "Hématologie" },
      { id: 124, nom: "Immuno-hémato (nouvelle réforme)" },
      { id: 125, nom: "Microbiologie" },
      { id: 126, nom: "Physiologie I" },
      { id: 127, nom: "Tice & Communication" },
    ],
  },
  {
    semestre_id: "s4", nom: "S4 FMPC", faculty: "FMPC",
    modules: [
      { id: 12, nom: "Hématologie" },
      { id: 14, nom: "Sémiologie 2" },
      { id: 15, nom: "Stage d'immersion en médecine sociale" },
    ],
  },
  {
    semestre_id: "S4_FMPM", nom: "S4 FMPM", faculty: "FMPM",
    modules: [
      { id: 135, nom: "Anapath II" },
      { id: 136, nom: "Anatomie Pathologique" },
      { id: 137, nom: "Parasito - Maladie infectieuse" },
      { id: 138, nom: "Pharmacologie" },
      { id: 139, nom: "Radiologie" },
      { id: 140, nom: "Sémiologie II" },
    ],
  },
  {
    semestre_id: "s6", nom: "S6 FMPC", faculty: "FMPC",
    modules: [
      { id: 16, nom: "Maladies de l'Appareil Cardio-vasculaire" },
      { id: 17, nom: "Maladies de l'Appareil digestif" },
      { id: 18, nom: "Maladies de l'Appareil Respiratoire" },
    ],
  },
  {
    semestre_id: "S6_FMPM", nom: "S6 FMPM", faculty: "FMPM",
    modules: [
      { id: 145, nom: "Cardio - CCV" },
      { id: 146, nom: "Pneumo - Chir thoracique" },
    ],
  },
  {
    semestre_id: "s8", nom: "S8 FMPC", faculty: "FMPC",
    modules: [
      { id: 19, nom: "Immuno-Pathologie Génétique" },
      { id: 20, nom: "Maladies de l'Appareil locomoteur" },
      { id: 21, nom: "Maladies de l'Enfant" },
    ],
  },
  {
    semestre_id: "S8_FMPM", nom: "S8 FMPM", faculty: "FMPM",
    modules: [
      { id: 151, nom: "Anapath II" },
      { id: 152, nom: "Appareil Locomoteur" },
      { id: 153, nom: "Immuno - génétique - med interne" },
    ],
  },
  {
    semestre_id: "s10", nom: "S10 FMPC", faculty: "FMPC",
    modules: [
      { id: 22, nom: "Gynécologie Obstétrique" },
      { id: 23, nom: "Médecine Légale et Médecine de travail Ethique et Déontologie" },
      { id: 24, nom: "NEPHROLOGIE -UROLOGIE" },
      { id: 25, nom: "ORL - OPHTALMOLOGIE" },
    ],
  },
  {
    semestre_id: "S10_FMPM", nom: "S10 FMPM", faculty: "FMPM",
    modules: [
      { id: 115, nom: "Med legal-éthique-travail-deontology" },
      { id: 116, nom: "Néphrologie-Urologie" },
      { id: 117, nom: "Santé publique" },
      { id: 118, nom: "Synthèse thérapeutique" },
    ],
  },
  // ── Pharmacy UM6SS — NOT exposed via /qcm/semesters ──
  {
    semestre_id: "S5_PHARMA_UM6", nom: "S5 Pharmacie UM6SS", faculty: "UM6SS",
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
    ],
  },
  {
    semestre_id: "S7_PHARMA_UM6", nom: "S7 Pharmacie UM6SS", faculty: "UM6SS",
    modules: [
      { id: 168, nom: "Biochimie pre-instrumentale" },
      { id: 169, nom: "Mycologie" },
      { id: 174, nom: "pharmacotechnie" },
      { id: 175, nom: "semiologie" },
      { id: 173, nom: "Tp mycologie" },
      { id: 170, nom: "TP pharmacotechnie" },
      { id: 171, nom: "TP toxicologie" },
      { id: 172, nom: "TP toxicologie 2" },
    ],
  },
] as const;

type QuestionRow = {
  id_question: number; question_id: string; texte: string;
  image_url: string | null; correction: string | null; source_qst: string | null;
  source_type: string; difficulte: string | null;
  choices: ChoiceRow[];
};
type ChoiceRow = {
  id_choix: number; choix_id: string; contenu: string;
  est_correct: number; pourcentage: string; explication: string | null;
};

async function seedModule(
  moduleId: number, moduleName: string, semId: string, jwt: string
): Promise<{ q: number; c: number; error?: string }> {
  try {
    const res = await fetch(`${DARI_API}/modules/${moduleId}/questions`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json", Origin: "https://dariqcm.vip" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for module ${moduleId}`);
    const questions: QuestionRow[] = await res.json();
    if (!questions.length) return { q: 0, c: 0 };

    // Upsert module
    await supabase.from("modules").upsert({
      id: moduleId, module_id: String(moduleId), nom: moduleName,
      semester_id: semId, total_questions: questions.length, total_activities: 0,
    }, { onConflict: "id" });

    // Upsert questions in batches of 200
    for (let i = 0; i < questions.length; i += 200) {
      const batch = questions.slice(i, i + 200).map((q) => ({
        id_question: q.id_question,
        question_id: q.question_id ?? String(q.id_question),
        texte: q.texte, image_url: q.image_url ?? null,
        correction: q.correction ?? null,
        source_question: q.source_qst ?? null,
        source_type: q.source_type ?? "qcm",
        position: 0, activity_id: null, module_id: moduleId,
      }));
      await supabase.from("questions").upsert(batch, { onConflict: "id_question" });
    }

    // Fetch back DB UUIDs
    const idQs = questions.map((q) => q.id_question);
    const { data: qRows } = await supabase.from("questions").select("id,id_question").in("id_question", idQs);
    const qidMap = Object.fromEntries((qRows ?? []).map((r) => [r.id_question, r.id]));

    // Build + upsert choices in batches of 500
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

    return { q: questions.length, c: choiceRows.length };
  } catch (e) {
    return { q: 0, c: 0, error: String(e) };
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stats = { semesters: 0, modules: 0, questions: 0, choices: 0, errors: 0 };
  const errorLog: string[] = [];

  try {
    const jwt = await register();

    for (const sem of EVEN_SEMESTERS) {
      // Ensure semester row exists
      await supabase.from("semesters").upsert({
        semestre_id: sem.semestre_id, nom: sem.nom, faculty: sem.faculty,
        total_modules: sem.modules.length, total_questions: 0, total_activities: 0,
      }, { onConflict: "semestre_id" });
      stats.semesters++;

      let semQ = 0;
      const CONCURRENCY = 5;
      for (let i = 0; i < sem.modules.length; i += CONCURRENCY) {
        const batch = sem.modules.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((mod) => seedModule(mod.id, mod.nom, sem.semestre_id, jwt))
        );
        for (const r of results) {
          if (r.status === "fulfilled") {
            stats.modules++;
            stats.questions += r.value.q;
            stats.choices += r.value.c;
            semQ += r.value.q;
            if (r.value.error) { stats.errors++; errorLog.push(r.value.error.slice(0, 100)); }
          } else {
            stats.errors++;
            errorLog.push(r.reason?.message?.slice(0, 80) ?? "?");
          }
        }
      }

      // Update semester total after seeding all modules
      await supabase.from("semesters").update({ total_questions: semQ }).eq("semestre_id", sem.semestre_id);
    }
  } catch (e) {
    return NextResponse.json({ error: String(e), stats }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stats, errors: errorLog.slice(0, 20) });
}
