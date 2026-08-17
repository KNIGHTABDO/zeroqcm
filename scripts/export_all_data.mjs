import fs from "fs";
import path from "path";

const SUPABASE_URL = "https://clcbqtkyrtntixdspxiw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2JxdGt5cnRudGl4ZHNweGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Njk0OTIsImV4cCI6MjA4NzI0NTQ5Mn0.TS-xYaxSX1knWKeszWMqxFyHt-MxMX5ZGwLsdI3XSNU";

const OUT_DIR = path.resolve("./export");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function fetchWithRetry(url, options = {}, retries = 5, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        console.warn(`\n[Retry ${i + 1}/${retries}] HTTP ${res.status}, waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    } catch (e) {
      if (i === retries - 1) throw e;
      console.warn(`\n[Retry ${i + 1}/${retries}] Fetch failed: ${e.message}, waiting ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
}

async function exportTablePaginated(tableName, select, orderBy, isJSONL = false, totalExpected = 0) {
  console.log(`\n📥 Exporting ${tableName}${totalExpected ? ` (~${totalExpected.toLocaleString()} expected)` : ""}...`);
  
  const ext = isJSONL ? "jsonl" : "json";
  const filePath = path.join(OUT_DIR, `${tableName}.${ext}`);
  
  let writeStream = null;
  const allRows = [];
  if (isJSONL) {
    writeStream = fs.createWriteStream(filePath, { flags: "w", encoding: "utf8" });
  }

  let from = 0;
  const pageSize = 1000;
  const startTime = Date.now();
  let fetchedCount = 0;

  while (true) {
    const to = from + pageSize - 1;
    const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=${encodeURIComponent(select)}&order=${orderBy}`;
    const res = await fetchWithRetry(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Range: `${from}-${to}`,
      },
    });

    const rows = await res.json();
    if (!rows || rows.length === 0) break;

    if (isJSONL) {
      for (const r of rows) {
        writeStream.write(JSON.stringify(r) + "\n");
      }
    } else {
      allRows.push(...rows);
    }

    fetchedCount += rows.length;
    from += pageSize;

    const percent = totalExpected ? ` (${Math.min(100, (fetchedCount / totalExpected) * 100).toFixed(1)}%)` : "";
    const speed = (fetchedCount / ((Date.now() - startTime) / 1000 || 1)).toFixed(0);
    process.stdout.write(`\r  → ${fetchedCount.toLocaleString()} rows fetched${percent} | Speed: ${speed} rows/s`);

    if (rows.length < pageSize) break;
  }

  if (isJSONL) {
    await new Promise((resolve) => writeStream.end(resolve));
  } else {
    fs.writeFileSync(filePath, JSON.stringify(allRows, null, 2), "utf8");
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ ${tableName}: ${fetchedCount.toLocaleString()} rows exported in ${duration}s -> export/${tableName}.${ext}`);
  return fetchedCount;
}

async function run() {
  console.log("==================================================");
  console.log("     ZEROQCM FULL SUPABASE DATA EXPORTER         ");
  console.log("==================================================");

  const startTotalTime = Date.now();

  // 1. Reference tables (JSON)
  await exportTablePaginated("semesters", "*", "semestre_id", false, 33);
  await exportTablePaginated("modules", "*", "id", false, 175);
  await exportTablePaginated("activities", "*", "id", false, 5773);
  await exportTablePaginated("ai_explanations", "*", "id", false, 29);

  // 2. Large dataset tables (Streaming JSONL)
  const questionsCount = await exportTablePaginated(
    "questions",
    "id,id_question,activity_id,module_id,texte,image_url,correction,source_type,source_question,position",
    "id",
    true,
    226191
  );

  const choicesCount = await exportTablePaginated(
    "choices",
    "id,question_id,id_choix,contenu,est_correct,pourcentage,explication",
    "id",
    true,
    758462
  );

  const totalSec = ((Date.now() - startTotalTime) / 1000).toFixed(1);
  console.log("\n==================================================");
  console.log("             ALL DATA EXPORTED SUCCESSFULLY!      ");
  console.log("==================================================");
  console.log(`• Questions:   ${questionsCount.toLocaleString()}`);
  console.log(`• Choices:     ${choicesCount.toLocaleString()}`);
  console.log(`• Total time:  ${totalSec}s`);
  console.log(`• Directory:   ${OUT_DIR}`);
}

run().catch(err => {
  console.error("Export script error:", err);
  process.exit(1);
});
