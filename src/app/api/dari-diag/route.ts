import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const DARI_API = "https://dari-qcm-back-production-c027.up.railway.app/api";
const DARI_H = { "Content-Type": "application/json", "Origin": "https://dariqcm.vip" };

async function register(year: number) {
  const ts = Date.now() + Math.random() * 1000;
  const email = `zqd${year}_${Math.floor(ts)}@gmail.com`;
  const res = await fetch(`${DARI_API}/auth/register`, {
    method: "POST", headers: DARI_H,
    body: JSON.stringify({ nom: "ZeroQCM", prenom: `S${year}`, email, phone: "0612345678",
      annee_etude: String(year), mot_de_passe: "ZeroQCM2026!" }),
  });
  const raw = await res.json();
  return { status: res.status, raw, email };
}

function decrypt(enc: { enc: string; iv: string; data: string }, key: Buffer): unknown {
  if (!enc?.enc) return enc;
  const iv = Buffer.from(enc.iv, "base64");
  const ct = Buffer.from(enc.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(ct.slice(-16));
  return JSON.parse(Buffer.concat([decipher.update(ct.slice(0, -16)), decipher.final()]).toString());
}

async function getSemesters(token: string, key: Buffer) {
  const r = await fetch(`${DARI_API}/qcm/semesters`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", Origin: "https://dariqcm.vip" }
  });
  if (!r.ok) return { error: `HTTP ${r.status}` };
  const raw = await r.json() as { enc?: string };
  const sems = (raw.enc ? decrypt(raw as { enc: string; iv: string; data: string }, key) : raw) as Array<{
    semestre_id: string; nom: string; total_questions: number; total_modules: number;
  }>;
  return { sems };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results: Record<string, unknown> = {};

  for (let year = 1; year <= 6; year++) {
    await new Promise(r => setTimeout(r, 3000));
    const { status, raw, email } = await register(year);
    const token = (raw as { token?: string }).token;

    if (!token) {
      results[`year_${year}`] = { registerStatus: status, raw, email };
      continue;
    }

    const key = crypto.createHash("sha256").update(token).digest();
    const { sems, error } = await getSemesters(token, key);
    if (error) { results[`year_${year}`] = { error, email }; continue; }
    results[`year_${year}`] = {
      email,
      semesters: (sems as Array<{ semestre_id: string; nom: string; total_questions: number }>)
        .map(s => ({ id: s.semestre_id, nom: s.nom, q: s.total_questions }))
    };
  }

  return NextResponse.json({ ok: true, results });
}
