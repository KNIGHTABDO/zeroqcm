import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 3600;

interface CatalogModel {
  id: string;
  name?: string;
  publisher?: string;
  summary?: string;
  tags?: string[];
  capabilities?: string[];
  supported_input_modalities?: string[];
  supported_output_modalities?: string[];
  limits?: { max_input_tokens?: number; max_output_tokens?: number };
  rate_limit_tier?: string;
}

const FALLBACK = [
  { id: "gpt-4o",      name: "GPT-4o",         publisher: "OpenAI" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini",    publisher: "OpenAI" },
  { id: "Meta-Llama-3.3-70B-Instruct", name: "Llama 3.3 70B", publisher: "Meta" },
  { id: "Mistral-large-2411",           name: "Mistral Large", publisher: "Mistral" },
  { id: "DeepSeek-V3-0324",            name: "DeepSeek V3",   publisher: "DeepSeek" },
];

export async function GET() {
  const token = process.env.GITHUB_MODELS_TOKEN ?? process.env.GITHUB_TOKEN ?? "";

  if (!token) return NextResponse.json(FALLBACK);

  try {
    const res = await fetch("https://models.github.ai/catalog/models", {
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) throw new Error("status " + res.status);

    const all = await res.json() as CatalogModel[];

    // Keep only streaming, text-output models
    const filtered = all
      .filter((m) =>
        Array.isArray(m.supported_output_modalities) &&
        m.supported_output_modalities.includes("text") &&
        Array.isArray(m.capabilities) &&
        m.capabilities.includes("streaming")
      )
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        publisher: m.publisher ?? "",
        summary: m.summary ?? "",
        tags: m.tags ?? [],
        supports_tools: m.capabilities?.includes("tool-calling") ?? false,
        supports_vision: m.supported_input_modalities?.includes("image") ?? false,
        rate_limit_tier: m.rate_limit_tier ?? "low",
        max_output_tokens: m.limits?.max_output_tokens ?? 0,
      }));

    return NextResponse.json(filtered.length > 0 ? filtered : FALLBACK);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
