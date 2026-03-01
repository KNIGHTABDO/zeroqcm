// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
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

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  const sb = getServiceSupabase();
  let query = sb.from("ai_tokens").select("id, label, github_oauth_token");
  if (id) query = (query as any).eq("id", id);
  const { data: tokens, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.all(
    (tokens ?? []).map(async (tok: any) => {
      try {
        const res = await fetch("https://api.github.com/copilot_internal/v2/token", {
          headers: { Accept: "application/json", Authorization: `Bearer ${tok.github_oauth_token}`, "editor-version": "vscode/1.98.0", "editor-plugin-version": "GitHub.copilot/1.276.0", "user-agent": "GithubCopilot/1.276.0" },
        });
        const status = res.ok ? "alive" : (res.status === 401 ? "dead" : "rate_limited");
        let sku = "unknown";
        if (res.ok) {
          const data = await res.json();
          const parts = (data.token ?? "").split(";");
          sku = parts.find((p: string) => p.startsWith("sku="))?.split("=")[1] ?? "unknown";
        }
        await sb.from("ai_tokens").update({ status, last_tested_at: new Date().toISOString() }).eq("id", tok.id);
        return { id: tok.id, label: tok.label, status, sku };
      } catch (err: any) {
        await sb.from("ai_tokens").update({ status: "dead", last_tested_at: new Date().toISOString() }).eq("id", tok.id);
        return { id: tok.id, label: tok.label, status: "dead", error: err.message };
      }
    })
  );
  return NextResponse.json(results);
}
