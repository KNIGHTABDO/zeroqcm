// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { testCopilotToken } from "@/lib/copilot-token";

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
  return (
    data?.username === "knightabdo" ||
    user.email === "knight007youtu@gmail.com" ||
    user.email === "aabidaabdessamad@gmail.com"
  );
}

// GET: list all tokens (no github_oauth_token in response for security)
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await getServiceSupabase()
    .from("ai_tokens")
    .select("id, label, status, last_tested_at, last_used_at, use_count, created_at")
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: add new token — immediately test it
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { label, github_oauth_token } = await req.json();
  if (!label || !github_oauth_token) {
    return NextResponse.json({ error: "label and github_oauth_token required" }, { status: 400 });
  }
  const sb = getServiceSupabase();

  // Test immediately on add
  const testResult = await testCopilotToken(github_oauth_token);
  const status = testResult.valid ? "alive" : "dead";

  const { data, error } = await sb
    .from("ai_tokens")
    .insert({
      label,
      github_oauth_token,
      status,
      last_tested_at: new Date().toISOString(),
    })
    .select("id, label, status, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, test_error: testResult.error });
}

// PATCH: test a token (or test all) — THE ONLY PLACE that writes status to DB
// Body: { id: "uuid" } to test one, or { all: true } to test all
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const sb = getServiceSupabase();

  if (body.all) {
    // Test all tokens in parallel
    const { data: tokens } = await sb.from("ai_tokens").select("id, github_oauth_token, label");
    if (!tokens) return NextResponse.json({ results: [] });

    const results = await Promise.all(
      tokens.map(async (t: any) => {
        const result = await testCopilotToken(t.github_oauth_token);
        await sb.from("ai_tokens").update({
          status: result.valid ? "alive" : "dead",
          last_tested_at: new Date().toISOString(),
        }).eq("id", t.id);
        return { id: t.id, label: t.label, status: result.valid ? "alive" : "dead", error: result.error };
      })
    );
    return NextResponse.json({ results });
  }

  if (body.id) {
    const { data: token } = await sb.from("ai_tokens").select("id, github_oauth_token, label").eq("id", body.id).single();
    if (!token) return NextResponse.json({ error: "Token not found" }, { status: 404 });
    const result = await testCopilotToken(token.github_oauth_token);
    await sb.from("ai_tokens").update({
      status: result.valid ? "alive" : "dead",
      last_tested_at: new Date().toISOString(),
    }).eq("id", body.id);
    return NextResponse.json({ id: body.id, status: result.valid ? "alive" : "dead", error: result.error });
  }

  return NextResponse.json({ error: "Provide id or all:true" }, { status: 400 });
}

// DELETE: remove token
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await getServiceSupabase().from("ai_tokens").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
