// @ts-nocheck
/**
 * ZeroQCM — AI Usage Rate Limiter
 *
 * Limits:
 *   - 3× models (Claude Opus, GPT-5.2, Gemini 3.1 Pro, etc.): 5 requests/user/day
 *   - 1× premium models (GPT-4.1, GPT-4o, Claude Sonnet, etc.): 10 requests/user/day
 *   - Standard/free models (gpt-4.1-mini, Haiku, Flash, etc.): unlimited
 *
 * Uses Supabase 'ai_usage' table with (user_id, usage_date, multiplier) unique key.
 * Service-role writes, anon-key reads (RLS policy on table).
 */

import { createClient } from "@supabase/supabase-js";

// GitHub Copilot 3× premium multiplier models
// Source: GitHub Copilot billing docs — "premium requests" list
const TRIPLE_PREMIUM_MODELS = new Set([
  "claude-opus-4-5",
  "claude-opus-4",
  "claude-3-opus",
  "gpt-5.2",
  "gpt-5.1",
  "gemini-3-1-pro-preview",
  "gemini-2-5-pro-preview-03-25",
  "gemini-2.5-pro",
  "o1",
  "o3",
  "o1-preview",
  "o3-mini",
  "grok-3",
]);

// Models that cost 0 premium requests (standard, always allowed)
const FREE_MODELS = new Set([
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o-mini",
  "claude-haiku-4-5",
  "claude-3-5-haiku",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-preview-04-17",
  "gemini-2-0-flash",
  "llama",
  "ministral",
  "phi",
]);

// Limits per day per user
const LIMITS: Record<number, number> = {
  3: 5,   // 3× models: 5/day
  1: 10,  // 1× premium: 10/day
};

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Determine the premium multiplier for a model ID.
 *  Returns 0 for free models (no limit), 1 for standard premium, 3 for heavy. */
export function getModelMultiplier(modelId: string): 0 | 1 | 3 {
  if (!modelId) return 1;
  const id = modelId.toLowerCase();
  // Free models — unlimited
  if ([...FREE_MODELS].some(f => id.includes(f.toLowerCase()))) return 0;
  // 3× heavy models
  if ([...TRIPLE_PREMIUM_MODELS].some(p => id.includes(p.toLowerCase()))) return 3;
  // Everything else: 1× premium
  return 1;
}

/** Check if user has quota remaining for a model. Returns { allowed, remaining, limit }.
 *  Admin (passed as isAdmin=true) is always allowed. */
export async function checkAiQuota(
  userId: string,
  modelId: string,
  isAdmin = false
): Promise<{ allowed: boolean; remaining: number; limit: number; multiplier: number }> {
  const multiplier = getModelMultiplier(modelId);

  // Free models: always allowed
  if (multiplier === 0) return { allowed: true, remaining: 999, limit: 999, multiplier: 0 };

  // Admin: always allowed (no tracking)
  if (isAdmin) return { allowed: true, remaining: 999, limit: 999, multiplier };

  const limit = LIMITS[multiplier] ?? 10;
  const sb = getServiceSupabase();
  const today = new Date().toISOString().split("T")[0]; // UTC date

  const { data, error } = await sb
    .from("ai_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .eq("multiplier", multiplier)
    .maybeSingle();

  if (error) {
    console.error("[ai-quota] read error:", error);
    return { allowed: true, remaining: limit, limit, multiplier }; // fail-open
  }

  const used = data?.count ?? 0;
  return {
    allowed: used < limit,
    remaining: Math.max(0, limit - used),
    limit,
    multiplier,
  };
}

/** Increment usage counter for a user + model + day.
 *  Uses UPSERT with atomic increment to handle concurrent requests. */
export async function incrementAiUsage(userId: string, modelId: string): Promise<void> {
  const multiplier = getModelMultiplier(modelId);
  if (multiplier === 0) return; // Free models: don't track

  const sb = getServiceSupabase();
  const today = new Date().toISOString().split("T")[0];

  const { error } = await sb.rpc("increment_ai_usage", {
    p_user_id: userId,
    p_date: today,
    p_multiplier: multiplier,
  });

  if (error) {
    console.error("[ai-quota] increment error (non-fatal):", error.message);
    // Non-fatal: don't block the request if tracking fails
  }
}

/** Get today's usage summary for a user (for UI display). */
export async function getAiUsageSummary(userId: string): Promise<{
  premium1x: { used: number; limit: number };
  premium3x: { used: number; limit: number };
}> {
  const sb = getServiceSupabase();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await sb
    .from("ai_usage")
    .select("multiplier, count")
    .eq("user_id", userId)
    .eq("usage_date", today);

  const rows = data ?? [];
  const get = (mult: number) => rows.find(r => r.multiplier === mult)?.count ?? 0;

  return {
    premium1x: { used: get(1), limit: LIMITS[1] },
    premium3x: { used: get(3), limit: LIMITS[3] },
  };
}