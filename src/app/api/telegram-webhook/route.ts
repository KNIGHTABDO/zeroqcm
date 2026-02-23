import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const cq = update.callback_query as Record<string, unknown> | undefined;
  if (!cq) return NextResponse.json({ ok: true });

  const callbackData = cq.callback_data as string;
  const chatId       = (cq.from as Record<string, unknown>).id;
  const queryId      = cq.id as string;
  const msgId        = (cq.message as Record<string, unknown>)?.message_id;

  const isApprove = callbackData?.startsWith("approve_");
  const isDeny    = callbackData?.startsWith("deny_");
  if (!isApprove && !isDeny) return NextResponse.json({ ok: true });

  const userId    = callbackData.replace(/^(approve|deny)_/, "");
  const newStatus = isApprove ? "approved" : "denied";

  // ── Answer callback FIRST — clears the loading spinner immediately ─────────
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: queryId,
      text: isApprove ? "✅ Approuvé!" : "❌ Refusé",
      show_alert: false,
    }),
  });

  // ── DB update ─────────────────────────────────────────────────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const updatePayload: Record<string, unknown> = {
    status:     newStatus,
    updated_at: new Date().toISOString(),
  };
  if (isApprove) updatePayload.approved_at = new Date().toISOString();

  const { error: dbErr } = await admin
    .from("activation_keys")
    .update(updatePayload)
    .eq("user_id", userId);

  if (dbErr) console.error("DB update error:", dbErr);

  // ── Fetch profile for display name ────────────────────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("username, full_name")
    .eq("id", userId)
    .maybeSingle();

  const displayName = escapeHtml(profile?.full_name || profile?.username || userId.slice(0, 8));

  // ── Edit original message to show final result ────────────────────────────
  const now = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Casablanca" });
  const resultText = isApprove
    ? `✅ <b>Approuvé</b>

👤 ${displayName}
🆔 <code>${userId}</code>
🕐 ${escapeHtml(now)}`
    : `❌ <b>Refusé</b>

👤 ${displayName}
🆔 <code>${userId}</code>`;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:    chatId,
      message_id: msgId,
      text:       resultText,
      parse_mode: "HTML",
    }),
  });

  return NextResponse.json({ ok: true });
}
