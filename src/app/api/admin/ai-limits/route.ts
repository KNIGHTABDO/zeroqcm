// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const { verifyAdmin: _verify } = await import("@/lib/admin");
  return _verify(req);
}

/** GET: returns category limits + today's usage summary (per-user, not aggregated) */
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = getServiceSupabase();
  const today = new Date().toISOString().split("T")[0];

  const [limitsRes, usageRes] = await Promise.all([
    sb.from("ai_rate_limits").select("multiplier,daily_limit,label").order("multiplier"),
    sb.from("ai_usage")
      .select("multiplier,count,user_id")
      .eq("usage_date", today),
  ]);

  // Per-user counts per multiplier: { mult -> { userId -> count } }
  const perUser: Record<number, Record<string, number>> = {};
  for (const row of usageRes.data ?? []) {
    if (!perUser[row.multiplier]) perUser[row.multiplier] = {};
    perUser[row.multiplier][row.user_id] = (perUser[row.multiplier][row.user_id] ?? 0) + (row.count ?? 0);
  }

  // usage_today: for each multiplier, report distinct users who used it today + their counts
  const usage_today = Object.entries(perUser).map(([m, userMap]) => ({
    multiplier: Number(m),
    user_count: Object.keys(userMap).length,
    total_requests: Object.values(userMap).reduce((a, b) => a + b, 0),
    // Top users (up to 5) for drill-down in UI
    top_users: Object.entries(userMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([uid, count]) => ({ uid, count })),
  }));

  return NextResponse.json({
    limits: limitsRes.data ?? [],
    usage_today,
  });
}

/** PATCH: update a category's daily_limit */
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { multiplier, daily_limit } = body;

  if (multiplier === undefined || daily_limit === undefined) {
    return NextResponse.json({ error: "multiplier and daily_limit required" }, { status: 400 });
  }
  if (!Number.isInteger(daily_limit) || daily_limit < 0) {
    return NextResponse.json({ error: "daily_limit must be a non-negative integer" }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const { error } = await sb
    .from("ai_rate_limits")
    .upsert({ multiplier, daily_limit, updated_at: new Date().toISOString() }, { onConflict: "multiplier" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
