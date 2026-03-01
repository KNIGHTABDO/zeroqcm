// @ts-nocheck
/**
 * ZeroQCM — GitHub Copilot Internal Token Manager
 * Exchanges GitHub OAuth tokens for short-lived Copilot inference tokens (~30 min).
 * Rotates across all alive tokens stored in Supabase ai_tokens table.
 *
 * KEY DESIGN RULE:
 *   getCopilotToken() NEVER writes status=dead to the DB.
 *   Only the admin /api/admin/ai-tokens?action=test endpoint manages token health status.
 *   During normal inference, transient failures (network, cold-start, timeout) are
 *   silently skipped — the next token is tried. This prevents healthy tokens from
 *   being permanently killed by a single transient error.
 */

import { createClient } from "@supabase/supabase-js";

interface InferenceTokenCache {
  token: string;
  expiresAt: number;
}

// In-memory cache: oauthTokenRowId → { token, expiresAt }
// Wiped on cold start but populated on first successful exchange.
const CACHE = new Map<string, InferenceTokenCache>();
let roundRobinIndex = 0;

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function exchangeCopilotToken(oauthToken: string): Promise<{ token: string; expiresAt: number }> {
  const res = await fetch("https://api.github.com/copilot_internal/v2/token", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${oauthToken}`,
      "editor-version": "vscode/1.98.0",
      "editor-plugin-version": "GitHub.copilot/1.276.0",
      "user-agent": "GithubCopilot/1.276.0",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Copilot token exchange failed: ${res.status}`);
  const data = await res.json();
  if (!data.token) throw new Error("No token in Copilot exchange response");
  return {
    token: data.token,
    expiresAt: (data.expires_at ?? Math.floor(Date.now() / 1000) + 1800) * 1000,
  };
}

export async function getCopilotToken(): Promise<string> {
  const supabase = getServiceSupabase();

  // Load all tokens regardless of status — we attempt alive ones first,
  // and will try any token (including recently-failed) in case admin reset it.
  // Filter: skip permanently dead ones (status=dead), but include alive + unknown.
  const { data: rows, error } = await supabase
    .from("ai_tokens")
    .select("id, github_oauth_token, status, use_count")
    .neq("status", "dead")
    .order("use_count", { ascending: true });

  if (error || !rows || rows.length === 0) {
    // No tokens in DB — try env var fallback
    const envToken =
      process.env.GITHUB_COPILOT_OAUTH_TOKEN ??
      process.env.GITHUB_MODELS_TOKEN ??
      process.env.GITHUB_TOKEN;
    if (!envToken) throw new Error("No GitHub OAuth tokens configured.");
    const exchanged = await exchangeCopilotToken(envToken);
    return exchanged.token;
  }

  const now = Date.now();
  const MARGIN = 5 * 60 * 1000; // 5-minute expiry margin

  for (let attempt = 0; attempt < rows.length; attempt++) {
    const idx = roundRobinIndex % rows.length;
    roundRobinIndex = (roundRobinIndex + 1) % rows.length;
    const row = rows[idx];

    // Check in-memory cache first
    const cached = CACHE.get(row.id);
    if (cached && cached.expiresAt - now > MARGIN) {
      // Fire-and-forget: increment use_count without blocking
      supabase
        .from("ai_tokens")
        .update({ last_used_at: new Date().toISOString(), use_count: (row.use_count ?? 0) + 1 })
        .eq("id", row.id)
        .then(() => {});
      return cached.token;
    }

    // Try to exchange for a fresh inference token
    // ⚡ NEVER mark dead on failure — skip and try next token
    try {
      const fresh = await exchangeCopilotToken(row.github_oauth_token);
      CACHE.set(row.id, { token: fresh.token, expiresAt: fresh.expiresAt });
      // Update last_used_at — NOT status (only admin test updates status)
      supabase
        .from("ai_tokens")
        .update({ last_used_at: new Date().toISOString(), use_count: (row.use_count ?? 0) + 1 })
        .eq("id", row.id)
        .then(() => {});
      return fresh.token;
    } catch (err) {
      // Transient failure — log, skip, try next token
      console.warn(`[copilot-token] Exchange failed for token ${row.id.slice(0, 8)}: ${err}`);
      // DO NOT update DB status here
    }
  }

  throw new Error("All configured GitHub tokens failed to exchange. Check token validity in Admin → AI Tokens.");
}

/**
 * Returns the Copilot inference base URL.
 * Extracts proxy-ep from inference token and replaces proxy. → api. with https:// prefix.
 * Always returns a valid https:// URL.
 */
export function getCopilotBaseURL(inferenceToken: string): string {
  try {
    const parts = inferenceToken.split(";");
    const proxyEp = parts.find((p) => p.startsWith("proxy-ep="))?.split("=")[1];
    if (proxyEp) return `https://${proxyEp.replace("proxy.", "api.")}`;
  } catch {}
  return "https://api.individual.githubcopilot.com";
}

/**
 * Test a single OAuth token — used by admin panel only.
 * Returns { valid: boolean, token?: string, error?: string }
 * This is the ONLY place that marks tokens alive/dead in the DB.
 */
export async function testCopilotToken(oauthToken: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const { token } = await exchangeCopilotToken(oauthToken);
    // Verify we can actually hit /models
    const baseURL = getCopilotBaseURL(token);
    const res = await fetch(`${baseURL}/models`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "editor-version": "vscode/1.98.0",
        "editor-plugin-version": "GitHub.copilot/1.276.0",
        "copilot-integration-id": "vscode-chat",
      },
      cache: "no-store",
    });
    if (!res.ok) return { valid: false, error: `Models endpoint returned ${res.status}` };
    return { valid: true };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}
