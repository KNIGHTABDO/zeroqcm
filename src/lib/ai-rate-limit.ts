// @ts-nocheck
/**
 * ZeroQCM — AI Usage Rate Limiter
 *
 * CATEGORY-BASED shared quotas (not per-model):
 *   - multiplier 0 (standard/free): unlimited
 *     → gemini-3-flash-preview, gpt-5-mini, claude-haiku-4.5, oswe-vscode-prime
 *   - multiplier 1 (1× premium): shared 10 req/user/day across ALL 1× models
 *     → gpt-4.1, gpt-4o, claude-sonnet-4/4.5/4.6, gemini-3-pro-preview, grok-code-fast-1
 *   - multiplier 3 (3× heavy): shared 5 req/user/day across ALL 3× models
 *     → gpt-5.2, gpt-5.1, gemini-2.5-pro, gemini-3.1-pro-preview, claude-opus-4.5/4.6
 *
 * Limits are stored in ai_rate_limits table (admin-editable, no redeploy).
 * ai_usage tracks (user_id, multiplier, usage_date) — one row per category per day.
 * Admin always bypasses all limits.
 */

import { createClient } from "@supabase/supabase-js";

// Hardcoded fallback defaults (used if ai_rate_limits table is unavailable)
const DEFAULT_LIMITS: Record<number, number> = {
  0: 0,   // free: unlimited (0 = no limit)
  1: 10,  // 1× premium: 10/day shared
  3: 5,   // 3× heavy: 5/day shared
};

// Multiplier lookup per model ID — mirrors ai_models_config.premium_multiplier
// Used as fast in-memory lookup to avoid a DB round-trip for every request
const MODEL_MULTIPLIER: Record<string, 0 | 1 | 3> = {
  // Standard/free (0)
  "gemini-3-flash-preview":    0,
  "gpt-5-mini":                0,
  "claude-haiku-4.5":          0,
  "oswe-vscode-prime":         0,

  // 1× premium (1)
  "gpt-4.1":                   1,
  "gpt-4o":                    1,
  "claude-sonnet-4":           1,
  "claude-sonnet-4.5":         1,
  "claude-sonnet-4.6":         1,
  "gemini-3-pro-preview":      1,
  "grok-code-fast-1":          1,

  // 3× heavy (3)
  "gpt-5.2":                   3,
  "gpt-5.1":                   3,
  "gemini-2.5-pro":            3,
  "gemini-3.1-pro-preview":    3,
  "claude-opus-4.5":           3,
  "claude-opus-4.6":           3,
};

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Get the premium multiplier for a model ID from the static map.
 *  Returns null if the model is not in the static map (requires DB lookup). */
export function getModelMultiplier(modelId: string): 0 | 1 | 3 | null {
  if (!modelId) return null;
  const lower = modelId.toLowerCase();
  if (lower in MODEL_MULTIPLIER) return MODEL_MULTIPLIER[lower];
  if (modelId in MODEL_MULTIPLIER) return MODEL_MULTIPLIER[modelId];
  return null; // Unknown — must look up in DB
}

/** Fetch the category daily limit from ai_rate_limits table.
 *  Falls back to DEFAULT_LIMITS if DB unavailable. */
async function getCategoryLimit(multiplier: number): Promise<number> {
  try {
    const sb = getServiceSupabase();
    const { data } = await sb
      .from("ai_rate_limits")
      .select("daily_limit")
      .eq("multiplier", multiplier)
      .maybeSingle();
    if (data?.daily_limit !== undefined && data.daily_limit !== null) {
      return data.daily_limit;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_LIMITS[multiplier] ?? 0;
}

/** Check if user has category quota remaining for a model.
 *  Returns { allowed, remaining, limit, multiplier }.
 *  Admin (isAdmin=true) always allowed. */
export async function checkAiQuota(
  userId: string,
  modelId: string,
  isAdmin = false
): Promise<{ allowed: boolean; remaining: number; limit: number; multiplier: number }> {
  // Admin: always allowed (check before any DB work)
  if (isAdmin) return { allowed: true, remaining: 999, limit: 999, multiplier: 0 };

  // Resolve multiplier: in-memory first, then DB fallback (so admin edits take effect immediately)
  let multiplier = getModelMultiplier(modelId);
  // Always try DB to pick up admin tier changes — also resolves null (unknown static) models
  if (modelId) {
    try {
      const sb = getServiceSupabase();
      const { data } = await sb
        .from("ai_models_config")
        .select("premium_multiplier")
        .eq("id", modelId)
        .maybeSingle();
      if (data?.premium_multiplier !== undefined && data.premium_multiplier !== null) {
        multiplier = data.premium_multiplier as 0 | 1 | 3;
      }
    } catch { /* fail-open: use static fallback */ }
  }

  // FIX #29: If multiplier still null after DB lookup, model is unknown — reject
  if (multiplier === null) {
    return { allowed: false, remaining: 0, limit: 0, multiplier: -1 as any };
  }

  // Free/standard models: always allowed
  if (multiplier === 0) return { allowed: true, remaining: 999, limit: 0, multiplier: 0 };

  // Get category limit (from DB or fallback)
  const limit = await getCategoryLimit(multiplier);
  if (limit === 0) return { allowed: true, remaining: 999, limit: 0, multiplier };

  const sb = getServiceSupabase();
  const today = new Date().toISOString().split("T")[0]; // UTC date

  const { data, error } = await sb
    .from("ai_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .eq("multiplier", multiplier)
    .maybeSingle();

  if (error) return { allowed: true, remaining: limit, limit, multiplier }; // fail-open

  const used = data?.count ?? 0;
  const remaining = Math.max(0, limit - used);
  return { allowed: remaining > 0, remaining, limit, multiplier };
}

/** Atomically increment the category usage bucket for a user. */
export async function incrementAiUsage(
  userId: string,
  modelId: string
): Promise<void> {
  // Resolve multiplier: static map first, then always verify against DB
  // (admin may have re-tiered a model from the dashboard — static map won't know)
  let multiplier: 0 | 1 | 3 = getModelMultiplier(modelId) ?? 0;
  try {
    const sb = getServiceSupabase();
    const { data } = await sb
      .from("ai_models_config")
      .select("premium_multiplier")
      .eq("id", modelId)
      .maybeSingle();
    if (data?.premium_multiplier !== undefined && data.premium_multiplier !== null) {
      multiplier = data.premium_multiplier as 0 | 1 | 3;
    }
  } catch { /* fail-open: use static value */ }

  // Always track usage (including free=0) so admin can see real totals
  try {
    const sb = getServiceSupabase();
    const today = new Date().toISOString().split("T")[0];
    await sb.rpc("increment_ai_usage", {
      p_user_id: userId,
      p_date: today,
      p_multiplier: multiplier,
    });
  } catch {
    // Non-fatal
  }
}
