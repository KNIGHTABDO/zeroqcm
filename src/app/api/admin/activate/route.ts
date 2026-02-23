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

export async function POST(req: NextRequest) {
  const admin_user = await verifyAdmin(req);
  if (!admin_user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, action } = await req.json();
  if (!userId || !["approve", "deny", "revoke"].includes(action)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const newStatus = action === "approve" ? "approved" : action === "deny" ? "denied" : "pending";
  const payload: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
  if (action === "approve") payload.approved_at = new Date().toISOString();
  if (action === "revoke")  payload.approved_at = null;

  const { error } = await db.from("activation_keys").update(payload).eq("user_id", userId);
  if (error) {
    console.error("activate error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}