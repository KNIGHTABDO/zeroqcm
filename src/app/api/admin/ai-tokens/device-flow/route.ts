// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CLIENT_ID = "Iv1.b507a08c87ecfe98"; // OpenClaw / VS Code GitHub OAuth App
const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const sb = getServiceSupabase();
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return false;
  const { data } = await sb.from("profiles").select("username").eq("id", user.id).maybeSingle();
  return data?.username === "knightabdo" || user.email === "knight007youtu@gmail.com" || user.email === "aabidaabdessamad@gmail.com";
}

// POST — initiate device flow
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = new URLSearchParams({ client_id: CLIENT_ID, scope: "read:user" });
  const res = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return NextResponse.json({ error: `GitHub device code failed: HTTP ${res.status}` }, { status: 502 });

  const data = await res.json();
  if (!data.device_code || !data.user_code || !data.verification_uri) {
    return NextResponse.json({ error: "GitHub device code response missing fields" }, { status: 502 });
  }

  return NextResponse.json({
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    expires_in: data.expires_in,
    interval: data.interval ?? 5,
  });
}

// GET — poll for access token
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const device_code = url.searchParams.get("device_code");
  const label = url.searchParams.get("label") || "GitHub Account";
  if (!device_code) return NextResponse.json({ error: "device_code required" }, { status: 400 });

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    device_code,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });

  const res = await fetch(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return NextResponse.json({ error: `GitHub token poll failed: HTTP ${res.status}` }, { status: 502 });

  const data = await res.json();

  if ("access_token" in data && typeof data.access_token === "string") {
    // Success — get GitHub username
    let ghUsername = label;
    try {
      const userRes = await fetch(USER_URL, {
        headers: { Authorization: `Bearer ${data.access_token}`, Accept: "application/json" },
      });
      if (userRes.ok) {
        const user = await userRes.json();
        ghUsername = user.login ? `@${user.login}` : label;
      }
    } catch {}

    // Save to DB
    const sb = getServiceSupabase();
    const { data: saved, error } = await sb
      .from("ai_tokens")
      .insert({ label: ghUsername, github_oauth_token: data.access_token, status: "alive" })
      .select("id, label, status")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ status: "authorized", token: saved });
  }

  const err = data.error ?? "unknown";
  if (err === "authorization_pending") return NextResponse.json({ status: "pending" });
  if (err === "slow_down") return NextResponse.json({ status: "slow_down" });
  if (err === "expired_token") return NextResponse.json({ status: "expired", error: "Code expired" });
  if (err === "access_denied") return NextResponse.json({ status: "denied", error: "User denied access" });
  return NextResponse.json({ status: "error", error: err });
}
