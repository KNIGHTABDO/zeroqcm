// @ts-nocheck
/**
 * ZeroQCM — AI Category Rate Limiter
 *
 * Limits are SHARED POOLS per category (not per model):
 *   - heavy (3×): 5 req/day total across ALL heavy models
 *   - premium (1×): 15 req/day total across ALL premium models
 *   - free (0×): unlimited
 *
 * Category = premium_multiplier value (0, 1, or 3).
 * ai_usage table tracks (user_id, multiplier, usage_date) — one row per category per user per day.
 * Admin always bypasses all limits.
 *
 * Real model tiers (from live Copilot API, 2026-03-01):
 *   FREE:    gemini-3-flash-preview, gpt-5-mini, claude-haiku-4.5, oswe-vscode-prime
 *   PREMIUM: gpt-4.1, gpt-4o, claude-sonnet-4, claude-sonnet-4.5, claude-sonnet-4.6,
 *            gemini-3-pro-preview, grok-code-fast-1
 *   HEAVY:   gpt-5.2, gpt-5.1, gemini-2.5-pro, gemini-3.1-pro-preview,
 *            claude-opus-4.5, claude-opus-4.6
 */

import { createClient } from "@supabase/supabase-js";

// Category limits (shared pool per tier per day)
const CATEGORY_LIMITS: Record<number, number> = {
  3: 5,   // heavy: 5 total/day
  1: 15,  // premium: 15 total/day
  0: 0,   // free: unlimited
};

// FREE models — unlimited regardless
const FREE_MODELS = new Set([
  "gemini-3-flash-preview",
  "gemini-2.5-flash-preview-04-17",
  "gemini-2-0-flash",
  "gpt-5-mini",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o-mini",
  "claude-haiku-4.5",
  "claude-3-5-haiku",
  "oswe-vscode-prime",
  "llama",
  "ministral",
  "phi",
]);

// 3× heavy models
const HEAVY_MODELS = new Set([
  "gpt-5.2",
  "gpt-5.1",
  "claude-opus-4.5",
  "claude-opus-4.6",
  "claude-opus-4",
  "claude-3-opus",
  "gemini-3.1-pro-preview",
  "gemini-2.5-pro",
  "o1",
  "o3",
  "o3-mini",
  "grok-3",
]);

/** Get category multiplier: 0=free, 1=premium, 3=heavy */
export function getModelMultiplier(modelId: string): 0 | 1 | 3 {
  if (!modelId) return 1;
  const id = modelId.toLowerCase();
  if ([...FREE_MODELS].some(f => id.includes(f.toLowerCase()))) return 0;
  if ([...HEAVY_MODELS].some(h => id.includes(h.toLowerCase()))) return 3;
  return 1; // everything else = premium
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Check if user has quota remaining for a model's category.
 * Returns { allowed, remaining, limit, multiplier }.
 * Admin (isAdmin=true) always bypasses.
 */
export async function checkAiQuota(
  userId: string,
  modelId: string,
  isAdmin = false
): Promise<{ allowed: boolean; remaining: number; limit: number; multiplier: number }> {
  const multiplier = getModelMultiplier(modelId);

  // Admin: always allowed
  if (isAdmin) return { allowed: true, remaining: 999, limit: 999, multiplier };

  // Free category: always allowed
  if (multiplier === 0) return { allowed: true, remaining: 999, limit: 0, multiplier: 0 };

  const limit = CATEGORY_LIMITS[multiplier] ?? 15;
  const sb = getServiceSupabase();
  const today = new Date().toISOString().split("T")[0];

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

/**
 * Atomically increment usage for a user's category bucket.
 * Buckets: (user_id, multiplier, usage_date) — one row per tier per day.
 */
export async function incrementAiUsage(
  userId: string,
  modelId: string
): Promise<void> {
  const multiplier = getModelMultiplier(modelId);
  if (multiplier === 0) return; // free — skip tracking

  try {
    const sb = getServiceSupabase();
    const today = new Date().toISOString().split("T")[0];
    // Use the original category-based RPC (p_multiplier, not p_model_id)
    await sb.rpc("increment_ai_usage_v2", {
      p_user_id: userId,
      p_multiplier: multiplier,
      p_date: today,
    });
  } catch {
    // Non-fatal
  }
}
