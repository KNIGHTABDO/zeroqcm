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

/** GET: returns category limits + today's usage summary */
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = getServiceSupabase();
  const today = new Date().toISOString().split("T")[0];

  const [limitsRes, usageRes] = await Promise.all([
    sb.from("ai_rate_limits").select("multiplier,daily_limit,label").order("multiplier"),
    sb.from("ai_usage")
      .select("multiplier,count")
      .eq("usage_date", today),
  ]);

  // Aggregate usage by multiplier (sum across all users)
  const usageByMult: Record<number, number> = {};
  for (const row of usageRes.data ?? []) {
    usageByMult[row.multiplier] = (usageByMult[row.multiplier] ?? 0) + (row.count ?? 0);
  }
  const usage_today = Object.entries(usageByMult).map(([m, count]) => ({
    multiplier: Number(m), count,
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
