/**
 * DariQCM Multi-Year Scraper – populates Supabase with questions/choices for ALL years
 *
 * Year → annee_etude mapping (confirmed working):
 *   Year 1 → "1"    → S1 (FMPC, FMPDF, FMPM, FMPR, UM6)
 *   Year 2 → "2"    → S3 (FMPC, FMPM, FMPR, UM6)
 *   Year 3 → "3.0"  → S5 (FMPC, FMPM, FMPR, UM6)
 *   Year 4 → "4eme" → S7 (FMPC, FMPM, FMPR, UM6)
 *   Year 5 → "5"    → S9 (FMPC, FMPM, FMPR, UM6)
 *
 * Usage:
 *   npx tsx scripts/scrape.ts              # scrape all years
 *   npx tsx scripts/scrape.ts --year=2     # scrape year 2 (S3) only
 *   npx tsx scripts/scrape.ts --rescrape   # force re-scrape even existing semesters
 */

import * as crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DARI_API = "https://dari-qcm-back-production-c027.up.railway.app/api";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  Missing SUPABASE env vars. Copy .env.example → .env and fill in.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Year → annee_etude value ───────────────────────────────────────────────
const YEAR_ANNEE: Record<number, string> = {
  1: "1",
  2: "2",
  3: "3.0",
  4: "4eme",
  5: "5",
};

// ── Auth ──────────────────────────────────────────────────────────────────
async function getToken(year: number): Promise<string> {
  const timestamp = Date.now();
  const annee_etude = YEAR_ANNEE[year];
  if (!annee_etude) throw new Error(`Unknown year: ${year}`);

  const email = `scraper_y${year}_${timestamp}@noreply.fmpc`;

  // Try register first
  const reg = await fetch(`${DARI_API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "https://dariqcm.vip" },
    body: JSON.stringify({
      nom: "Scraper", prenom: "FMPC",
      email,
      phone: "0600000000",
      annee_etude,
      mot_de_passe: "Scraper2026!",
    }),
  });

  const data = await reg.json() as { token?: string; error?: string; message?: string };
  if (data.token) {
    console.log(`✅  Year ${year} authenticated as ${email}`);
    return data.token;
  }

  // Rate limited or already exists — try login with a stored email if available
  throw new Error(`Auth failed for year ${year}: ${JSON.stringify(data)}`);
}

// ── Decrypt response ───────────────────────────────────────────────────────
function decrypt(enc: { enc: string; iv: string; data: string }, token: string): unknown {
  if (!enc?.enc) return enc;
  const keyMaterial = crypto.createHash("sha256").update(token).digest();
  const iv = Buffer.from(enc.iv, "base64");
  const ciphertext = Buffer.from(enc.data, "base64");
  const tag = ciphertext.slice(-16);
  const payload = ciphertext.slice(0, -16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyMaterial, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

// ── API helper ─────────────────────────────────────────────────────────────
async function api<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${DARI_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Origin: "https://dariqcm.vip",
    },
  });
  const raw = await res.json() as T | { enc: string; iv: string; data: string };
  if (raw && typeof raw === "object" && "enc" in raw) {
    return await decrypt(raw as { enc: string; iv: string; data: string }, token) as T;
  }
  return raw as T;
}

function getFaculty(semestreId: string): string {
  const id = semestreId.toLowerCase();
  if (id.includes("fmpm")) return "FMPM";
  if (id.includes("fmpr")) return "FMPR";
  if (id.includes("um6")) return "UM6SS";
  if (id.includes("fmpdf")) return "FMPDF";
  return "FMPC";
}

// ── Scrape one year ────────────────────────────────────────────────────────
async function scrapeYear(year: number, token: string, forceRescrape = false) {
  type Semester = { id_semestre: number; semestre_id: string; nom: string; total_modules: number; total_questions: number; total_activities: number };
  const semesters = await api<Semester[]>("/qcm/semesters", token);
  console.log(`  📚  Year ${year}: ${semesters.length} semesters`);

  for (const sem of semesters) {
    // Skip if already seeded and not force rescraping
    if (!forceRescrape) {
      const { count } = await supabase.from("modules").select("id", { count: "exact", head: true }).eq("semester_id", sem.semestre_id);
      if ((count ?? 0) > 0) {
        console.log(`  ⏭️  ${sem.nom} already seeded (${count} modules) – skipping`);
        continue;
      }
    }

    const faculty = getFaculty(sem.semestre_id);
    await supabase.from("semesters").upsert({
      semestre_id: sem.semestre_id, nom: sem.nom, faculty,
      total_modules: sem.total_modules, total_questions: sem.total_questions,
      total_activities: sem.total_activities,
    }, { onConflict: "semestre_id" });

    type Module = { id_module: number; module_id: string; nom: string; description: string | null; total_questions: number; total_activities: number };
    const modules = await api<Module[]>(`/qcm/semesters/${sem.id_semestre}/modules`, token);
    console.log(`    📂  ${sem.nom}: ${modules.length} modules`);

    for (const mod of modules) {
      await supabase.from("modules").upsert({
        id: mod.id_module, module_id: mod.module_id, nom: mod.nom,
        description: mod.description, semester_id: sem.semestre_id,
        total_questions: mod.total_questions, total_activities: mod.total_activities,
      }, { onConflict: "id" });

      type Activity = { id_activite: number; activite_id: string; nom: string; type_activite: string; total_questions: number; chapitre?: string };
      const activities = await api<Activity[]>(`/qcm/modules/${mod.id_module}/activities`, token);

      for (const act of activities) {
        await supabase.from("activities").upsert({
          id: act.id_activite, activite_id: act.activite_id, nom: act.nom,
          type_activite: act.type_activite, module_id: mod.id_module,
          total_questions: act.total_questions, chapitre: act.chapitre ?? null,
        }, { onConflict: "id" });

        try {
          type QuestionPayload = {
            activity: unknown;
            questions: {
              id_question: number; question_id: string; texte: string;
              image_url: string | null; correction: string | null;
              source_question: string | null; source_type: string; position: number;
              choices: { id_choix: number; choix_id: string; contenu: string; est_correct: number; pourcentage: string; explication: string | null }[];
            }[];
          };
          const decrypted = await api<QuestionPayload>(`/qcm/activities/${act.id_activite}`, token);
          const questions = decrypted.questions ?? [];

          for (const q of questions) {
            const { data: qRow } = await supabase.from("questions").upsert({
              id_question: q.id_question, question_id: q.question_id,
              texte: q.texte, image_url: q.image_url, correction: q.correction,
              source_question: q.source_question, source_type: q.source_type,
              position: q.position, activity_id: act.id_activite, module_id: mod.id_module,
            }, { onConflict: "id_question" }).select("id").single();

            if (qRow?.id && q.choices?.length) {
              for (const c of q.choices) {
                await supabase.from("choices").upsert({
                  id_choix: c.id_choix, choix_id: c.choix_id, question_id: qRow.id,
                  contenu: c.contenu, est_correct: c.est_correct === 1,
                  pourcentage: parseFloat(c.pourcentage ?? "0"),
                  explication: c.explication,
                }, { onConflict: "id_choix" });
              }
            }
          }

          process.stdout.write(`    ✓ ${act.nom}: ${questions.length}q\r`);
          await new Promise((r) => setTimeout(r, 100));
        } catch (e) {
          console.error(`    ❌ ${act.nom}:`, e);
        }
      }
      console.log(`    ✅  ${mod.nom}: done`);
    }
    console.log(`  ✅  ${sem.nom}: done`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const yearArg = args.find(a => a.startsWith("--year="));
  const forceRescrape = args.includes("--rescrape");
  const yearsToRun = yearArg ? [parseInt(yearArg.split("=")[1])] : [1, 2, 3, 4, 5];

  console.log(`🚀  DariQCM Multi-Year Scraper`);
  console.log(`    Years: ${yearsToRun.join(", ")} | Force rescrape: ${forceRescrape}`);

  for (const year of yearsToRun) {
    console.log(`\n📅  Starting Year ${year} (annee_etude=${YEAR_ANNEE[year]})...`);
    try {
      const token = await getToken(year);
      await scrapeYear(year, token, forceRescrape);
    } catch (e) {
      console.error(`❌  Year ${year} failed:`, e);
    }
  }

  console.log("\n🎉  Multi-year scrape complete!");
}

main().catch(console.error);
