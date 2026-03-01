// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCopilotToken, getCopilotBaseURL } from "@/lib/copilot-token";

export const runtime = "nodejs";
// No static cache — we merge live Copilot API + DB overrides on every request (edge-cached by Vercel)
export const revalidate = 120;

interface CopilotModel {
  id: string;
  name?: string;
  version?: string;
  vendor?: string;
  model_picker_enabled?: boolean;
  billing_plan?: string;
  capabilities?: {
    type?: string;
    family?: string;
    supports?: {
      tool_calls?: boolean;
      parallel_tool_calls?: boolean;
      vision?: boolean;
      streaming?: boolean;
      dimensions?: boolean;
    };
    limits?: {
      max_context_window_tokens?: number;
      max_prompt_tokens?: number;
      max_output_tokens?: number;
    };
    tokenizer?: string;
  };
  object?: string;
  policy?: { state?: string };
}

interface ModelOverride {
  id: string;
  is_enabled: boolean;
  is_default: boolean;
  sort_order?: number;
  custom_label?: string;
}

// Known provider mappings from model ID prefix
function inferProvider(id: string): string {
  if (id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4") || id.startsWith("text-") || id.startsWith("dall-")) return "OpenAI";
  if (id.startsWith("claude-")) return "Anthropic";
  if (id.startsWith("gemini-")) return "Google";
  if (id.startsWith("meta-llama-") || id.startsWith("llama-")) return "Meta";
  if (id.startsWith("mistral-") || id.startsWith("codestral-") || id.startsWith("devstral-") || id.startsWith("pixtral-") || id.startsWith("magistral-")) return "Mistral";
  if (id.startsWith("deepseek-")) return "DeepSeek";
  if (id.startsWith("phi-")) return "Microsoft";
  if (id.startsWith("grok-")) return "xAI";
  if (id.startsWith("command-") || id.startsWith("cohere-")) return "Cohere";
  if (id.startsWith("jamba-")) return "AI21";
  if (id.startsWith("ai21-")) return "AI21";
  if (id.startsWith("ministral-")) return "Mistral";
  if (id.startsWith("qwen-")) return "Alibaba";
  return "Other";
}

// Infer tier from Copilot billing info
function inferTier(m: CopilotModel): "standard" | "premium" {
  if (m.billing_plan === "individual") return "standard";
  if (m.billing_plan === "business") return "premium";
  // Fallback: premium models by known ID
  const premiumIds = ["gpt-4.1", "gpt-4o", "gpt-4.5-preview", "o1", "o3", "o4-mini", "claude-3-5-sonnet", "claude-3-7-sonnet", "claude-sonnet-4-5", "claude-3-opus", "gemini-2.5-pro", "grok-3"];
  if (premiumIds.some(p => m.id.includes(p) && !m.id.includes("mini") && !m.id.includes("nano") && !m.id.includes("haiku") && !m.id.includes("flash"))) return "premium";
  return "standard";
}

const FALLBACK = [
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", publisher: "OpenAI", tier: "standard", is_default: true, supports_vision: false, supports_tools: true },
  { id: "gpt-4o",       name: "GPT-4o",        publisher: "OpenAI", tier: "premium",  is_default: false, supports_vision: true, supports_tools: true },
];

export async function GET() {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    // Parallel: fetch Copilot live models + DB overrides
    const [copilotResult, dbResult] = await Promise.allSettled([
      (async () => {
        const token = await getCopilotToken();
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
        if (!res.ok) throw new Error(`Copilot /models ${res.status}`);
        const json = await res.json();
        return (json.data ?? json) as CopilotModel[];
      })(),
      sb.from("ai_models_config").select("id, is_enabled, is_default, sort_order, custom_label"),
    ]);

    if (copilotResult.status === "rejected") {
      // No token configured yet — fall through to DB list
      const { data: dbModels } = await sb.from("ai_models_config").select("id, label, provider, tier, is_enabled, is_default, sort_order").eq("is_enabled", true).order("sort_order");
      if (dbModels && dbModels.length > 0) {
        return NextResponse.json(dbModels.map(m => ({ id: m.id, name: m.label ?? m.id, publisher: m.provider ?? inferProvider(m.id), tier: m.tier ?? "standard", is_default: m.is_default ?? false })));
      }
      return NextResponse.json(FALLBACK);
    }

    const liveModels = copilotResult.value;
    const overrides: ModelOverride[] = dbResult.status === "fulfilled" ? (dbResult.value.data ?? []) : [];
    const overrideMap = new Map(overrides.map(o => [o.id, o]));

    // Filter to chat-capable models and model_picker_enabled
    const chatModels = liveModels.filter(m =>
      m.id &&
      (m.capabilities?.type === "chat" || !m.capabilities?.type) &&
      m.model_picker_enabled !== false &&
      m.object !== "model_deprecated"
    );

    // Merge overrides
    const result = chatModels
      .map(m => {
        const ov = overrideMap.get(m.id);
        const isEnabled = ov ? ov.is_enabled : true; // default: show all live models
        const isDefault = ov?.is_default ?? false;
        const provider = inferProvider(m.id);
        const tier = inferTier(m);
        const name = ov?.custom_label ?? m.name ?? m.id;
        return {
          id: m.id,
          name,
          publisher: provider,
          tier,
          is_default: isDefault,
          is_enabled: isEnabled,
          supports_vision: m.capabilities?.supports?.vision ?? false,
          supports_tools: m.capabilities?.supports?.tool_calls ?? false,
          max_tokens: m.capabilities?.limits?.max_context_window_tokens,
          sort_order: ov?.sort_order ?? 999,
        };
      })
      .filter(m => m.is_enabled)
      .sort((a, b) => {
        // Default model first
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        // Then by sort_order
        return a.sort_order - b.sort_order;
      });

    if (result.length === 0) return NextResponse.json(FALLBACK);
    return NextResponse.json(result);
  } catch (err) {
    console.error("gh-models error:", err);
    return NextResponse.json(FALLBACK);
  }
}
