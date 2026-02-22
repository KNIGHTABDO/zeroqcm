/**
 * DariQCM Scraper — populates Supabase with all questions/choices
 *
 * Usage: bun run scripts/scrape.ts
 * or:    npx tsx scripts/scrape.ts
 *
 * Prereqs:
 *   - .env file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - Supabase schema already applied (see scripts/schema.sql)
 *
 * Strategy:
 *   1. Register a free DariQCM account (or reuse existing token)
 *   2. Walk semesters → modules → activities
 *   3. Decrypt each AES-256-GCM response (key = SHA256(JWT))
 *   4. Upsert into Supabase
 */

import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

// ── Load env ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const DARI_API = "https://dari-qcm-back-production-c027.up.railway.app/api";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  Missing SUPABASE env vars. Copy .env.example → .env and fill in.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Auth ──────────────────────────────────────────────────────────────────
async function getToken(): Promise<string> {
  // Try to register a fresh account (idempotent — use unique email per run if needed)
  const timestamp = Date.now();
  const email = `scraper_${timestamp}@noreply.fmpc`;

  const reg = await fetch(`${DARI_API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "https://dariqcm.vip" },
    body: JSON.stringify({
      nom: "Scraper",
      prenom: "FMPC",
      email,
      phone: "0600000000",
      annee_etude: "1",
      mot_de_passe: "Scraper2026!",
    }),
  });

  const data = await reg.json() as { token?: string; error?: string };
  if (!data.token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  console.log("✅  Authenticated as", email);
  return data.token;
}

// ── Decrypt response ───────────────────────────────────────────────────────
async function decrypt(enc: { enc: string; iv: string; data: string }, token: string): Promise<unknown> {
  if (!enc?.enc) return enc; // not encrypted
  const keyMaterial = crypto.createHash("sha256").update(token).digest();
  const iv = Buffer.from(enc.iv, "base64");
  const ciphertext = Buffer.from(enc.data, "base64");
  // AES-256-GCM: last 16 bytes of ciphertext is the auth tag
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

// ── Main scrape flow ───────────────────────────────────────────────────────
async function main() {
  console.log("🚀  Starting DariQCM scraper...");
  const token = await getToken();

  // 1. Semesters
  const semesters = await api<{ id_semestre: number; semestre_id: string; nom: string; total_modules: number; total_questions: number; total_activities: number }[]>("/qcm/semesters", token);
  console.log(`📚  Found ${semesters.length} semesters`);

  for (const sem of semesters) {
    const faculty = sem.semestre_id.includes("fmpr") ? "FMPR" :
                    sem.semestre_id.includes("fmpm") ? "FMPM" :
                    sem.semestre_id.includes("um6") ? "UM6SS" :
                    sem.semestre_id.includes("fmpdf") ? "FMPDF" : "FMPC";

    // Upsert semester
    await supabase.from("semesters").upsert({
      semestre_id: sem.semestre_id,
      nom: sem.nom,
      faculty,
      total_modules: sem.total_modules,
      total_questions: sem.total_questions,
      total_activities: sem.total_activities,
    }, { onConflict: "semestre_id" });

    // 2. Modules
    const modules = await api<{ id_module: number; module_id: string; nom: string; description: string | null; total_questions: number; total_activities: number }[]>(`/qcm/semesters/${sem.id_semestre}/modules`, token);
    console.log(`  📂  ${sem.nom}: ${modules.length} modules`);

    for (const mod of modules) {
      await supabase.from("modules").upsert({
        id: mod.id_module,
        module_id: mod.module_id,
        nom: mod.nom,
        description: mod.description,
        semester_id: sem.semestre_id,
        total_questions: mod.total_questions,
        total_activities: mod.total_activities,
      }, { onConflict: "id" });

      // 3. Activities (exams + exercises)
      const activities = await api<{ id_activite: number; activite_id: string; nom: string; type_activite: string; total_questions: number; chapitre?: string }[]>(`/qcm/modules/${mod.id_module}/activities`, token);

      for (const act of activities) {
        await supabase.from("activities").upsert({
          id: act.id_activite,
          activite_id: act.activite_id,
          nom: act.nom,
          type_activite: act.type_activite,
          module_id: mod.id_module,
          total_questions: act.total_questions,
          chapitre: act.chapitre ?? null,
        }, { onConflict: "id" });

        // 4. Questions + choices (encrypted)
        try {
          const decrypted = await api<{ activity: unknown; questions: { id_question: number; question_id: string; texte: string; image_url: string | null; correction: string | null; source_question: string | null; source_type: string; position: number; choices: { id_choix: number; choix_id: string; contenu: string; est_correct: number; pourcentage: string; explication: string | null }[] }[] }>(`/qcm/activities/${act.id_activite}`, token);
          const questions = decrypted.questions ?? [];

          for (const q of questions) {
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
              module_id: mod.id_module,
            }, { onConflict: "id_question" }).select("id").single();

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
          }

          process.stdout.write(`    ✓ ${act.nom}: ${questions.length} questions\r`);
          await new Promise((r) => setTimeout(r, 150)); // rate limit
        } catch (e) {
          console.error(`    ❌ Failed ${act.nom}:`, e);
        }
      }
      console.log(`  ✅  ${mod.nom}: done`);
    }
    console.log(`✅  ${sem.nom}: done`);
  }

  console.log("\n🎉  Scrape complete! All data in Supabase.");
}

main().catch(console.error);
