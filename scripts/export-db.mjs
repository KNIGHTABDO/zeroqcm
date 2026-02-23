#!/usr/bin/env node
/**
 * ZeroQCM Database Export Script
 *
 * Exports all tables to CSV files in /export/
 *
 * Usage:
 *   SUPABASE_URL=https://clcbqtkyrtntixdspxiw.supabase.co \
 *   SUPABASE_SERVICE_KEY=<service_role_key> \
 *   node scripts/export-db.mjs
 *
 * Then zip: zip -r zerqcm-db-export.zip export/
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const OUT_DIR = join(process.cwd(), "export");
mkdirSync(OUT_DIR, { recursive: true });

function toCSV(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(",") || s.includes("\n") || s.includes('"')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(","))
  ].join("\n");
}

async function exportTable(table, select, orderBy, batchSize = 1000) {
  console.log(`\nExporting ${table}...`);
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy)
      .range(from, from + batchSize - 1);
    if (error) { console.error(`  ERROR: ${error.message}`); break; }
    if (!data?.length) break;
    rows.push(...data);
    process.stdout.write(`\r  ${rows.length} rows fetched...`);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  writeFileSync(join(OUT_DIR, `${table}.csv`), toCSV(rows), "utf-8");
  console.log(`\n  Done: ${rows.length.toLocaleString()} rows -> export/${table}.csv`);
  return rows.length;
}

const TABLES = [
  { table: "semesters",  select: "*",                                                                          orderBy: "semestre_id" },
  { table: "modules",    select: "*",                                                                          orderBy: "module_id"   },
  { table: "activities", select: "id,nom,module_id,type_activite,chapitre",                                    orderBy: "id"          },
  { table: "questions",  select: "id,activity_id,texte,source_type,source_question,image_url,correction,position", orderBy: "id"     },
  { table: "choices",    select: "id,question_id,id_choix,contenu,est_correct,pourcentage,explication",        orderBy: "question_id" },
  { table: "profiles",   select: "id,username,full_name,annee_etude,created_at",                              orderBy: "created_at"  },
];

console.log("ZeroQCM Database Export");
console.log(`Output: ${OUT_DIR}\n`);

let total = 0;
for (const t of TABLES) {
  total += await exportTable(t.table, t.select, t.orderBy);
}
console.log(`\nAll done. ${total.toLocaleString()} total rows exported.`);
console.log("Zip command: zip -r zerqcm-db-export.zip export/");
