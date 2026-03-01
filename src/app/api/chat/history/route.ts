// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Service-role client — bypasses RLS entirely
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Auth client — verifies the caller is logged in
async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 60;

// GET /api/chat/history?limit=60&offset=0 — paginated message history
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit  = Math.min(parseInt(searchParams.get("limit")  ?? String(DEFAULT_LIMIT), 10), MAX_LIMIT);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

  const db = getServiceSupabase();
  const { data, error, count } = await db
    .from("chat_messages")
    .select("id, role, content, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [], total: count ?? 0, limit, offset });
}

// DELETE /api/chat/history — wipe all messages for this user
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();
  const { error } = await db
    .from("chat_messages")
    .delete()
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST /api/chat/history — save a single message (user or assistant)
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role, content } = await req.json();
  if (!role || !content) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (!["user", "assistant", "system"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (typeof content !== "string" || content.length > 32000) {
    return NextResponse.json({ error: "Content too long or invalid" }, { status: 400 });
  }

  const db = getServiceSupabase();

  // FIX #19: cap stored messages at 500 per user — delete oldest excess
  const { count } = await db
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= 500) {
    // Delete the oldest 50 messages to make room
    const { data: oldest } = await db
      .from("chat_messages")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50);
    if (oldest?.length) {
      await db.from("chat_messages").delete().in("id", oldest.map((m: { id: string }) => m.id));
    }
  }

  const { error } = await db
    .from("chat_messages")
    .insert({ user_id: user.id, role, content });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
