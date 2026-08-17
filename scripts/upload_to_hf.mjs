import fs from "fs";
import path from "path";
import https from "https";

const HF_TOKEN = process.env.HF_TOKEN;
const repoId = process.argv[2];

if (!HF_TOKEN || !repoId) {
  console.error("Usage: HF_TOKEN=hf_xxx node scripts/upload_to_hf.mjs <username>/<dataset-repo-name>");
  process.exit(1);
}

const DATASET_DIR = path.resolve("./dataset");

async function createRepo() {
  console.log(`Checking dataset repository on Hugging Face: ${repoId}...`);
  return new Promise((resolve, reject) => {
    const req = https.request(
      "https://huggingface.co/api/repos/create",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log("✅ Repository created successfully!");
          } else if (res.statusCode === 409) {
            console.log("✅ Repository already exists. Proceeding to upload files...");
          } else {
            console.warn(`Repository note (${res.statusCode}): ${body}`);
          }
          resolve();
        });
      }
    );
    req.on("error", reject);
    req.write(JSON.stringify({ name: repoId.split("/")[1], type: "dataset", private: true }));
    req.end();
  });
}

function uploadFileStream(fileName) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(DATASET_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${filePath} does not exist, skipping.`);
      return resolve();
    }

    const stats = fs.statSync(filePath);
    const totalBytes = stats.size;
    const sizeMB = (totalBytes / (1024 * 1024)).toFixed(1);

    console.log(`\n📤 Uploading ${fileName} (${sizeMB} MB)...`);

    const options = {
      hostname: "huggingface.co",
      port: 443,
      path: `/api/datasets/${repoId}/upload/main/${encodeURIComponent(fileName)}`,
      method: "PUT",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": totalBytes,
      },
      timeout: 0, // No timeout
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`\n✅ ${fileName} uploaded successfully!`);
          resolve();
        } else {
          console.error(`\n❌ Upload failed for ${fileName}: HTTP ${res.statusCode} - ${body}`);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on("error", (err) => {
      console.error(`\n❌ Request error on ${fileName}:`, err.message);
      reject(err);
    });

    const fileStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    let uploadedBytes = 0;
    const startTime = Date.now();

    fileStream.on("data", (chunk) => {
      uploadedBytes += chunk.length;
      const pct = ((uploadedBytes / totalBytes) * 100).toFixed(1);
      const elapsedSec = (Date.now() - startTime) / 1000 || 1;
      const speedMB = (uploadedBytes / (1024 * 1024) / elapsedSec).toFixed(2);
      process.stdout.write(`\r  → Progress: ${pct}% (${(uploadedBytes / (1024 * 1024)).toFixed(1)} / ${sizeMB} MB) | Speed: ${speedMB} MB/s`);
    });

    fileStream.on("end", () => {
      req.end();
    });

    fileStream.on("error", (err) => {
      req.destroy(err);
      reject(err);
    });
  });
}

async function run() {
  await createRepo();
  await uploadFileStream("stats_summary.json");
  await uploadFileStream("val.jsonl");
  await uploadFileStream("test_benchmark.jsonl");
  await uploadFileStream("train.jsonl");
  console.log(`\n🎉 ALL FILES UPLOADED TO: https://huggingface.co/datasets/${repoId}`);
}

run().catch((err) => {
  console.error("Upload error:", err.message);
});
