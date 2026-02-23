import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const token = auth.slice(7);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Session invalide" }, { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await admin
    .from("activation_keys")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.status === "approved") {
    return NextResponse.json({ status: "approved" });
  }

  const { error: upsertErr } = await admin
    .from("activation_keys")
    .upsert({
      user_id:      user.id,
      status:       "pending",
      requested_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (upsertErr) {
    console.error("Upsert error:", JSON.stringify(upsertErr));
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }

  return NextResponse.json({ status: "pending" });
}