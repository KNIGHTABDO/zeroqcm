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
  "gpt-4o",
  "gpt-4o-mini",
  "Meta-Llama-3.1-70B-Instruct",
  "Meta-Llama-3.3-70B-Instruct",
  "Mistral-large-2411",
  "Mistral-small-3.1-24B-Instruct-2503",
  "DeepSeek-V3-0324",
];

export const DEFAULT_MODEL = "gpt-4o-mini";
