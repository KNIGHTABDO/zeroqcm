import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_ID    = process.env.TELEGRAM_ADMIN_ID!;
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  // ── Auth: get user from Bearer token ──────────────────────────────────────
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const token = auth.slice(7);

  // User-scoped client to validate session
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Session invalide" }, { status: 401 });
  }

  // ── Service-role client for DB writes ─────────────────────────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Check current status (don't re-send if already pending/approved) ──────
  const { data: existing } = await admin
    .from("activation_keys")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.status === "approved") {
    return NextResponse.json({ status: "approved" });
  }

  // ── Fetch user profile for Telegram message ────────────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("username, full_name, annee_etude, faculty")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.full_name || profile?.username || user.email?.split("@")[0] || "Inconnu";
  const semester    = profile?.annee_etude ? `S${(profile.annee_etude * 2) - 1}` : "N/A";
  const now         = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Casablanca", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // ── Upsert activation_keys row ─────────────────────────────────────────────
  const { error: upsertErr } = await admin
    .from("activation_keys")
    .upsert({
      user_id:      user.id,
      status:       "pending",
      requested_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (upsertErr) {
    console.error("Upsert error:", upsertErr);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }

  // ── Send Telegram message to admin ────────────────────────────────────────
  const text = [
    "🔔 *Nouvelle demande d\'activation ZeroQCM*",
    "",
    `👤 *Nom:* ${displayName.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\$&")}`,
    `📧 *Email:* ${user.email}`,
    `📚 *Semestre:* ${semester}`,
    `🏫 *Faculté:* ${profile?.faculty || "FMPC"}`,
    `🕐 *Date:* ${now}`,
    `🆔 \`${user.id}\``,
  ].join("\n");

  const tgBody = {
    chat_id:      ADMIN_ID,
    text,
    parse_mode:   "MarkdownV2",
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Approuver", callback_data: `approve_${user.id}` },
        { text: "❌ Refuser",  callback_data: `deny_${user.id}` },
      ]],
    },
  };

  let telegramMsgId: number | null = null;
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(tgBody),
    });
    const tgJson = await tgRes.json();
    if (tgJson.ok) {
      telegramMsgId = tgJson.result.message_id;
      // Store message ID for later editing
      await admin.from("activation_keys").update({ telegram_message_id: telegramMsgId })
        .eq("user_id", user.id);
    } else {
      console.error("Telegram error:", tgJson);
    }
  } catch (e) {
    console.error("Telegram fetch error:", e);
  }

  // ── Register webhook (idempotent — Telegram ignores if already set) ────────
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ url: "https://zeroqcm.me/api/telegram-webhook" }),
  }).catch(() => {});

  return NextResponse.json({ status: "pending" });
}
