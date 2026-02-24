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

export const ALLOWED_MODELS = [
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1",
  "meta/llama-4-scout-17b-16e-instruct",
  "meta/llama-3.3-70b-instruct",
  "deepseek/deepseek-v3-0324",
  "mistral-ai/mistral-small-2503",
];

export const DEFAULT_MODEL = "openai/gpt-5-mini";