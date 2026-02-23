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

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "all";
  const search = (searchParams.get("search") ?? "").trim();
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fetch profiles
  let profileQuery = db
    .from("profiles")
    .select("id, username, full_name, faculty, annee_etude, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    profileQuery = profileQuery.or(`username.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  const { data: profiles, count } = await profileQuery;
  if (!profiles?.length) return NextResponse.json({ users: [], total: 0 });

  // Fetch activation keys for those profiles
  const ids = profiles.map((p) => p.id);
  const { data: keys } = await db
    .from("activation_keys")
    .select("user_id, status, requested_at, approved_at, updated_at")
    .in("user_id", ids);

  // Fetch auth emails
  const { data: { users: authUsers } } = await db.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = Object.fromEntries((authUsers ?? []).map((u) => [u.id, u.email]));
  const keyMap   = Object.fromEntries((keys ?? []).map((k) => [k.user_id, k]));

  let results = profiles.map((p) => ({
    id:         p.id,
    username:   p.username,
    full_name:  p.full_name,
    email:      emailMap[p.id] ?? null,
    faculty:    p.faculty,
    annee_etude:p.annee_etude,
    created_at: p.created_at,
    activation: keyMap[p.id] ?? null,
  }));

  if (status !== "all") {
    results = results.filter((r) =>
      status === "none" ? !r.activation : r.activation?.status === status
    );
  }

  return NextResponse.json({ users: results, total: count ?? 0 });
}