import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * ZeroQCM — GitHub Models provider via AI SDK
 * Endpoint: https://models.inference.ai.azure.com
 * Model IDs must NOT include the publisher prefix (e.g. "gpt-4o-mini" not "openai/gpt-4o-mini")
 * GITHUB_MODELS_TOKEN (or GITHUB_TOKEN) must be set in Vercel env.
 */
export const githubModels = createOpenAICompatible({
  name: "github-models",
  baseURL: "https://models.inference.ai.azure.com",
  headers: {
    Authorization: `Bearer ${process.env.GITHUB_MODELS_TOKEN ?? process.env.GITHUB_TOKEN ?? ""}`,
  },
});

/** Strip publisher prefix so Azure endpoint receives a clean model name */
export function resolveModelId(id: string): string {
  return id.includes("/") ? id.split("/").pop()! : id;
}

export const ALLOWED_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "Meta-Llama-3.1-70B-Instruct",
  "Meta-Llama-3.3-70B-Instruct",
  "Mistral-large-2411",
  "Mistral-small-3.1-24B-Instruct-2503",
  "DeepSeek-V3-0324",
  "gpt-5-mini",           // listed but may require special access
];

export const DEFAULT_MODEL = "gpt-4o-mini";