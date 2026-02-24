import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const DARI_API = "https://dari-qcm-back-production-c027.up.railway.app/api";
const DARI_H = { "Content-Type": "application/json", "Origin": "https://dariqcm.vip" };

async function register(year: number) {
  const ts = Date.now() + Math.random() * 1000;
  const email = `zqdiag_${year}_${ts}@noreply.fmpc`;
  const res = await fetch(`${DARI_API}/auth/register`, {
    method: "POST", headers: DARI_H,
    body: JSON.stringify({ nom: "Diag", prenom: `Y${year}`, email, phone: "0612345678",
      annee_etude: String(year), mot_de_passe: "Diag2026!" }),
  });
  const data = await res.json() as { token?: string; message?: string; retryAfter?: number };
  if (!data.token) return { error: data.message ?? "no token", retryAfter: data.retryAfter };
  const key = crypto.createHash("sha256").update(data.token).digest();
  return { token: data.token, key };
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
    await new Promise(r => setTimeout(r, 2000)); // 2s between registrations
    const auth = await register(year);
    if ("error" in auth) {
      results[`year_${year}`] = { error: auth.error, retryAfter: auth.retryAfter };
      continue;
    }
    const { sems, error } = await getSemesters(auth.token!, auth.key!);
    if (error) { results[`year_${year}`] = { error }; continue; }
    results[`year_${year}`] = (sems as Array<{ semestre_id: string; nom: string; total_questions: number }>)
      .map(s => ({ id: s.semestre_id, nom: s.nom, q: s.total_questions }));
  }

  return NextResponse.json({ ok: true, results });
}
