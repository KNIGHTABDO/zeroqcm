// @ts-nocheck
/**
 * ZeroQCM — AI Usage Rate Limiter
 *
 * CATEGORY-BASED shared quotas (not per-model).
 * Multiplier is ALWAYS resolved from DB (ai_models_config.premium_multiplier).
 * No static map — admin changes take effect immediately, zero stale data.
 *
 *   - multiplier 0 (standard/free): unlimited, but tracked for admin visibility
 *   - multiplier 1 (1× premium): shared 10 req/user/day
 *   - multiplier 3 (3× heavy): shared 5 req/user/day
 *
 * Limits stored in ai_rate_limits table (admin-editable, no redeploy).
 * ai_usage tracks (user_id, multiplier, usage_date) — one row per category per day.
 * Admin always bypasses all limits.
 */

import { createClient } from "@supabase/supabase-js";

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Resolve a model's multiplier from DB.
 * Returns the DB value, or null if model is unknown/not in config.
 * NEVER returns a stale hardcoded value.
 */
export async function resolveModelMultiplier(modelId: string): Promise<0 | 1 | 3 | null> {
  if (!modelId) return null;
  try {
    const sb = getServiceSupabase();
    const { data } = await sb
      .from("ai_models_config")
      .select("premium_multiplier")
      .eq("id", modelId)
      .maybeSingle();
    if (data?.premium_multiplier !== undefined && data.premium_multiplier !== null) {
      return data.premium_multiplier as 0 | 1 | 3;
    }
  } catch { /* fail-open */ }
  return null;
}

/**
 * Synchronous fallback used only in the unauthenticated gate check in route.ts.
 * Returns 0 for known-free models, 1 for anything else (safer: blocks anon access).
 * NOT used for actual usage tracking or quota enforcement.
 */
export function getModelMultiplierSync(modelId: string): 0 | 1 | 3 {
  // Only models that are definitively free get 0 here
  // This list is intentionally minimal — auth gate is not the billing system
  const FREE_MODELS = new Set(["gpt-5-mini", "oswe-vscode-prime"]);
  if (FREE_MODELS.has(modelId)) return 0;
  return 1; // Conservative: treat unknown as premium for auth gating
}

// Keep old export name for backward compat with route.ts unauthenticated check
export function getModelMultiplier(modelId: string): 0 | 1 | 3 | null {
  return getModelMultiplierSync(modelId);
}

/** Fetch the category daily limit from ai_rate_limits table.
 *  Falls back to hardcoded defaults only if DB is unavailable. */
async function getCategoryLimit(multiplier: number): Promise<number> {
  const FALLBACK: Record<number, number> = { 0: 0, 1: 10, 3: 5 };
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
  } catch { /* fall through */ }
  return FALLBACK[multiplier] ?? 0;
}

/** Check if user has category quota remaining for a model.
 *  Returns { allowed, remaining, limit, multiplier, resolvedMultiplier }.
 *  Admin (isAdmin=true) always allowed. */
export async function checkAiQuota(
  userId: string,
  modelId: string,
  isAdmin = false
): Promise<{ allowed: boolean; remaining: number; limit: number; multiplier: number; resolvedMultiplier: 0 | 1 | 3 }> {
  if (isAdmin) return { allowed: true, remaining: 999, limit: 999, multiplier: 0, resolvedMultiplier: 0 };

  // Always resolve from DB — zero tolerance for stale static values
  const multiplier = await resolveModelMultiplier(modelId);

  if (multiplier === null) {
    // Model not in DB — block it
    return { allowed: false, remaining: 0, limit: 0, multiplier: -1 as any, resolvedMultiplier: 0 };
  }

  // Free/standard models: always allowed
  if (multiplier === 0) {
    return { allowed: true, remaining: 999, limit: 0, multiplier: 0, resolvedMultiplier: 0 };
  }

  const limit = await getCategoryLimit(multiplier);
  if (limit === 0) return { allowed: true, remaining: 999, limit: 0, multiplier, resolvedMultiplier: multiplier };

  const sb = getServiceSupabase();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await sb
    .from("ai_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .eq("multiplier", multiplier)
    .maybeSingle();

  if (error) return { allowed: true, remaining: limit, limit, multiplier, resolvedMultiplier: multiplier };

  const used = data?.count ?? 0;
  const remaining = Math.max(0, limit - used);
  return { allowed: remaining > 0, remaining, limit, multiplier, resolvedMultiplier: multiplier };
}

/**
 * Atomically increment the category usage bucket.
 * Accepts pre-resolved multiplier to avoid a second DB call.
 * If multiplier not provided, resolves from DB (never falls back to 0 for unknowns).
 */
export async function incrementAiUsage(
  userId: string,
  modelId: string,
  resolvedMultiplier?: 0 | 1 | 3
): Promise<void> {
  let multiplier: 0 | 1 | 3;

  if (resolvedMultiplier !== undefined) {
    multiplier = resolvedMultiplier;
  } else {
    // Resolve from DB — if lookup fails, DO NOT default to 0 (would under-count)
    const resolved = await resolveModelMultiplier(modelId);
    if (resolved === null) {
      // Unknown model — still track as 1 so admin can investigate
      multiplier = 1;
    } else {
      multiplier = resolved;
    }
  }

  try {
    const sb = getServiceSupabase();
    const today = new Date().toISOString().split("T")[0];
    await sb.rpc("increment_ai_usage", {
      p_user_id: userId,
      p_date: today,
      p_multiplier: multiplier,
    });
  } catch {
    // Non-fatal — log but don't crash the response
  }
}
