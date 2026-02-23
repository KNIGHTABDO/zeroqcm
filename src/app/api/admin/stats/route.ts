import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const ADMIN_EMAIL  = "aabidaabdessamad@gmail.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  return user?.email === ADMIN_EMAIL ? user : null;
}

export async function GET(req: NextRequest) {
  const admin_user = await verifyAdmin(req);
  if (!admin_user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [
    { count: totalProfiles },
    { count: pending },
    { count: approved },
    { count: denied },
    { count: totalQuestions },
    { count: totalAnswers },
    { data: recentActivations },
  ] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("activation_keys").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("activation_keys").select("id", { count: "exact", head: true }).eq("status", "approved"),
    db.from("activation_keys").select("id", { count: "exact", head: true }).eq("status", "denied"),
    db.from("questions").select("id", { count: "exact", head: true }),
    db.from("user_answers").select("id", { count: "exact", head: true }),
    db.from("activation_keys")
      .select("user_id, status, requested_at, updated_at")
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(8),
  ]);

  // Enrich recent activations with profile data
  let enriched: Record<string, unknown>[] = [];
  if (recentActivations?.length) {
    const ids = recentActivations.map((r) => r.user_id);
    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, username, faculty, annee_etude")
      .in("id", ids);
    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
    enriched = recentActivations.map((r) => ({
      ...r,
      profile: profileMap[r.user_id] ?? null,
    }));
  }

  return NextResponse.json({
    users:    { total: totalProfiles ?? 0, pending: pending ?? 0, approved: approved ?? 0, denied: denied ?? 0 },
    platform: { questions: totalQuestions ?? 0, answers: totalAnswers ?? 0 },
    recent:   enriched,
  });
}