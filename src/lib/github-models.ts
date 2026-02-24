import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * ZeroQCM — GitHub Models provider via AI SDK
 * Uses the OpenAI-compatible endpoint at models.inference.ai.azure.com
 * GITHUB_MODELS_TOKEN (or GITHUB_TOKEN) must be set in Vercel env.
 */
export const githubModels = createOpenAICompatible({
  name: "github-models",
  baseURL: "https://models.inference.ai.azure.com",
  headers: {
    Authorization: `Bearer ${process.env.GITHUB_MODELS_TOKEN ?? process.env.GITHUB_TOKEN ?? ""}`,
  },
});

/**
 * Maps catalog model IDs (from /api/gh-models, with publisher prefix)
 * to the bare model IDs accepted by the Azure inference endpoint.
 * The endpoint does NOT accept "publisher/" prefixes.
 */
export const MODEL_ID_MAP: Record<string, string> = {
  // OpenAI (gpt-5-mini unavailable; gpt-5-chat is the working gpt-5 tier model)
  "openai/gpt-5-chat":    "gpt-5-chat",
  "openai/gpt-5-nano":    "gpt-5-nano",
  "openai/gpt-4o-mini":   "gpt-4o-mini",
  "openai/gpt-4o":        "gpt-4o",
  "openai/gpt-4.1":       "gpt-4.1",
  "openai/gpt-4.1-mini":  "gpt-4.1-mini",
  "openai/gpt-4.1-nano":  "gpt-4.1-nano",
  // Meta
  "meta/llama-4-scout-17b-16e-instruct":                "Llama-4-Scout-17B-16E-Instruct",
  "meta/llama-4-maverick-17b-128e-instruct-fp8":        "Llama-4-Maverick-17B-128E-Instruct-FP8",
  "meta/llama-3.3-70b-instruct":                        "Llama-3.3-70B-Instruct",
  "meta/meta-llama-3.1-8b-instruct":                    "Meta-Llama-3.1-8B-Instruct",
  // DeepSeek
  "deepseek/deepseek-v3-0324": "DeepSeek-V3-0324",
  // Mistral
  "mistral-ai/mistral-small-2503": "Mistral-small-2503",
  "mistral-ai/ministral-3b":       "Ministral-3B",
  "mistral-ai/codestral-2501":     "Codestral-2501",
};

/** Resolve a catalog model ID to its endpoint-compatible bare ID. */
export function resolveModelId(catalogId: string): string {
  // Check explicit map first
  if (catalogId in MODEL_ID_MAP) return MODEL_ID_MAP[catalogId];
  // Fallback: strip "publisher/" prefix
  const slash = catalogId.indexOf("/");
  return slash >= 0 ? catalogId.slice(slash + 1) : catalogId;
}

/** Allowed catalog-format model IDs (displayed to users, mapped at request time). */
export const ALLOWED_MODELS = Object.keys(MODEL_ID_MAP);

/** Default model (gpt-5-chat = gpt-5 tier, confirmed working with Copilot Pro). */
export const DEFAULT_MODEL = "openai/gpt-5-chat";