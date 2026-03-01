// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const revalidate = 60;

const FALLBACK = [
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", publisher: "OpenAI", tier: "standard", is_default: true },
  { id: "gpt-4o",       name: "GPT-4o",        publisher: "OpenAI", tier: "premium",  is_default: false },
];

export async function GET() {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await sb.from("ai_models_config").select("id, label, provider, tier, is_enabled, is_default, sort_order").eq("is_enabled", true).order("sort_order");
    if (error || !data || data.length === 0) return NextResponse.json(FALLBACK);
    return NextResponse.json(data.map((m) => ({ id: m.id, name: m.label, publisher: m.provider, tier: m.tier, is_default: m.is_default })));
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
