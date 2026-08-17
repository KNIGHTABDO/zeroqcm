/**
 * Upload ZeroQCM dataset to Hugging Face Hub
 * 
 * Usage:
 *   HF_TOKEN=hf_your_token_here node scripts/upload_to_hf.mjs <username>/<dataset_name>
 * 
 * Example:
 *   HF_TOKEN=hf_xxx node scripts/upload_to_hf.mjs my-username/zeroqcm-morocco-medical
 */

import fs from "fs";
import path from "path";

const HF_TOKEN = process.env.HF_TOKEN;
const repoId = process.argv[2];

if (!HF_TOKEN || !repoId) {
  console.error("Usage: HF_TOKEN=hf_xxx node scripts/upload_to_hf.mjs <username>/<dataset-repo-name>");
  console.error("Get a write token from: https://huggingface.co/settings/tokens");
  process.exit(1);
}

const DATASET_DIR = path.resolve("./dataset");

async function createRepo() {
  console.log(`Creating dataset repository on Hugging Face: ${repoId}...`);
  const res = await fetch("https://huggingface.co/api/repos/create", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: repoId.split("/")[1],
      type: "dataset",
      private: true, // Creates private by default for your data
    }),
  });
  if (res.status === 409) {
    console.log("Repository already exists. Proceeding to upload files...");
  } else if (!res.ok) {
    const err = await res.text();
    console.warn(`Repo creation note (${res.status}): ${err}`);
  } else {
    console.log("✅ Repository created successfully!");
  }
}

async function uploadFile(fileName) {
  const filePath = path.join(DATASET_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`File ${filePath} does not exist, skipping.`);
    return;
  }

  const stats = fs.statSync(filePath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
  console.log(`\nUploading ${fileName} (${sizeMB} MB)...`);

  const fileBuffer = fs.readFileSync(filePath);
  const url = `https://huggingface.co/api/datasets/${repoId}/upload/main/${fileName}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/octet-stream",
    },
    body: fileBuffer,
  });

  if (res.ok) {
    console.log(`✅ ${fileName} uploaded successfully!`);
  } else {
    console.error(`❌ Failed to upload ${fileName}: HTTP ${res.status} - ${await res.text()}`);
  }
}

async function run() {
  await createRepo();
  await uploadFile("train.jsonl");
  await uploadFile("val.jsonl");
  await uploadFile("test_benchmark.jsonl");
  await uploadFile("stats_summary.json");
  console.log(`\n🎉 All dataset files uploaded to https://huggingface.co/datasets/${repoId}`);
}

run().catch(console.error);
