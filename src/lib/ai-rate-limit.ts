// @ts-nocheck
/**
 * ZeroQCM — AI Usage Rate Limiter (per-model)
 *
 * Limits are stored per model in ai_models_config.daily_limit:
 *   - null  → fall back to tier-based defaults
 *   - 0     → unlimited (free/standard models)
 *   - N     → hard N requests/user/day for this model
 *
 * Tier-based defaults (fallback):
 *   - premium_multiplier=3 (Opus, GPT-5.2, Gemini Pro, o1/o3, Grok-3): 5 req/day
 *   - premium_multiplier=1 (GPT-4.1, GPT-4o, Sonnet, etc.):            15 req/day
 *   - premium_multiplier=0 (gpt-4.1-mini, Haiku, Flash):               unlimited
 *
 * ai_usage table: (user_id, model_id, usage_date) — unique per model per day per user
 * Admin always bypasses all limits.
 */

import { createClient } from "@supabase/supabase-js";

// Free models — no limit regardless of DB config
const FREE_MODELS = new Set([
  "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o-mini",
  "claude-haiku-4-5", "claude-3-5-haiku",
  "gemini-3-flash-preview", "gemini-2.5-flash-preview-04-17", "gemini-2-0-flash",
  "llama", "ministral", "phi",
]);

// 3× heavy models fallback defaults (5/day)
const TRIPLE_PREMIUM_MODELS = new Set([
  "claude-opus-4-5", "claude-opus-4", "claude-3-opus",
  "gpt-5.2", "gpt-5.1",
  "gemini-3-1-pro-preview", "gemini-2-5-pro-preview-03-25", "gemini-2.5-pro",
  "o1", "o3", "o1-preview", "o3-mini",
  "grok-3",
]);

/** Tier-based fallback multiplier: 0=free, 1=premium, 3=heavy */
export function getModelMultiplier(modelId: string): 0 | 1 | 3 {
  if (!modelId) return 1;
  const id = modelId.toLowerCase();
  if ([...FREE_MODELS].some(f => id.includes(f.toLowerCase()))) return 0;
  if ([...TRIPLE_PREMIUM_MODELS].some(p => id.includes(p.toLowerCase()))) return 3;
  return 1;
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Fetch per-model daily_limit from ai_models_config.
 *  Returns: number (0=unlimited, N=limit) or null if not set in DB. */
async function getModelDailyLimit(modelId: string): Promise<number | null> {
  try {
    const sb = getServiceSupabase();
    const { data } = await sb
      .from("ai_models_config")
      .select("daily_limit, premium_multiplier")
      .eq("id", modelId)
      .maybeSingle();
    if (!data) return null; // model not in DB → use tier fallback
    if (data.daily_limit !== null && data.daily_limit !== undefined) {
      return data.daily_limit; // explicit DB limit (0=unlimited, N=limit)
    }
    // No explicit daily_limit — derive from premium_multiplier in DB
    const m = data.premium_multiplier ?? null;
    if (m === 0) return 0;          // free
    if (m === 3) return 5;          // heavy: 5/day
    if (m === 1) return 15;         // premium: 15/day
    return null;
  } catch {
    return null; // fail-open
  }
}

/** Check if user has quota remaining for a model.
 *  Returns { allowed, remaining, limit, modelLimit }.
 *  Admin (isAdmin=true) is always allowed. */
export async function checkAiQuota(
  userId: string,
  modelId: string,
  isAdmin = false
): Promise<{ allowed: boolean; remaining: number; limit: number; multiplier: number }> {
  const multiplier = getModelMultiplier(modelId);

  // Admin: always allowed
  if (isAdmin) return { allowed: true, remaining: 999, limit: 999, multiplier };

  // Fetch per-model limit (from DB, or tier fallback)
  let limit: number;
  const dbLimit = await getModelDailyLimit(modelId);
  if (dbLimit !== null) {
    limit = dbLimit;
  } else {
    // Tier fallback
    if (multiplier === 0) limit = 0;        // free = unlimited
    else if (multiplier === 3) limit = 5;   // heavy = 5/day
    else limit = 15;                         // premium = 15/day
  }

  // Unlimited (0) — always allow
  if (limit === 0) return { allowed: true, remaining: 999, limit: 0, multiplier };

  const sb = getServiceSupabase();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await sb
    .from("ai_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .eq("model_id", modelId)
    .maybeSingle();

  if (error) return { allowed: true, remaining: limit, limit, multiplier }; // fail-open

  const used = data?.count ?? 0;
  const remaining = Math.max(0, limit - used);
  return { allowed: remaining > 0, remaining, limit, multiplier };
}

/** Atomically increment usage for a user+model+date. */
export async function incrementAiUsage(
  userId: string,
  modelId: string
): Promise<void> {
  try {
    const sb = getServiceSupabase();
    const today = new Date().toISOString().split("T")[0];
    await sb.rpc("increment_ai_usage", {
      p_user_id: userId,
      p_model_id: modelId,
      p_date: today,
    });
  } catch {
    // Non-fatal: usage tracking failure should not block the user
  }
}
