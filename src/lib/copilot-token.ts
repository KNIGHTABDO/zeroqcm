// @ts-nocheck
/**
 * ZeroQCM — GitHub Copilot Internal Token Manager
 * Exchanges GitHub OAuth tokens for short-lived Copilot inference tokens (~30 min).
 * Rotates across all alive tokens stored in Supabase ai_tokens table.
 */

import { createClient } from "@supabase/supabase-js";

interface InferenceTokenCache {
  token: string;
  expiresAt: number;
  oauthTokenId: string;
}

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
  const { data: rows, error } = await supabase
    .from("ai_tokens")
    .select("id, github_oauth_token, status, use_count")
    .neq("status", "dead")
    .order("use_count", { ascending: true });

  if (error || !rows || rows.length === 0) {
    const envToken = process.env.GITHUB_COPILOT_OAUTH_TOKEN ?? process.env.GITHUB_MODELS_TOKEN ?? process.env.GITHUB_TOKEN;
    if (!envToken) throw new Error("No GitHub OAuth tokens configured. Add them in Admin → AI Tokens.");
    const exchanged = await exchangeCopilotToken(envToken);
    return exchanged.token;
  }

  const now = Date.now();
  const MARGIN = 5 * 60 * 1000;

  for (let attempt = 0; attempt < rows.length; attempt++) {
    const idx = roundRobinIndex % rows.length;
    roundRobinIndex = (roundRobinIndex + 1) % rows.length;
    const row = rows[idx];

    const cached = CACHE.get(row.id);
    if (cached && cached.expiresAt - now > MARGIN) {
      supabase.from("ai_tokens").update({ last_used_at: new Date().toISOString(), use_count: row.use_count + 1 }).eq("id", row.id).then(() => {});
      return cached.token;
    }

    try {
      const fresh = await exchangeCopilotToken(row.github_oauth_token);
      CACHE.set(row.id, { token: fresh.token, expiresAt: fresh.expiresAt, oauthTokenId: row.id });
      await supabase.from("ai_tokens").update({ status: "alive", last_tested_at: new Date().toISOString(), last_used_at: new Date().toISOString() }).eq("id", row.id);
      return fresh.token;
    } catch {
      await supabase.from("ai_tokens").update({ status: "dead" }).eq("id", row.id);
    }
  }

  throw new Error("All configured GitHub tokens are dead or expired. Re-authorize via Admin → AI Tokens.");
}

/**
 * Returns the Copilot inference base URL.
 * The inference token contains a proxy-ep= segment like:
 *   proxy-ep=proxy.individual.githubcopilot.com
 * The /models and /chat/completions endpoints live on:
 *   https://api.individual.githubcopilot.com  (note: api., not proxy.)
 *
 * BUG FIX: previously returned the hostname WITHOUT https:// prefix,
 * causing every fetch to fail with "TypeError: Failed to parse URL".
 */
export function getCopilotBaseURL(inferenceToken: string): string {
  try {
    const parts = inferenceToken.split(";");
    const proxyEp = parts.find((p) => p.startsWith("proxy-ep="))?.split("=")[1];
    if (proxyEp) return `https://${proxyEp.replace("proxy.", "api.")}`;
  } catch {}
  return "https://api.individual.githubcopilot.com";
}
