// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCopilotToken, getCopilotBaseURL } from "@/lib/copilot-token";

function getServiceSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const sb = getServiceSupabase();
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return false;
  const { data } = await sb.from("profiles").select("username").eq("id", user.id).maybeSingle();
  return data?.username === "knightabdo" || user.email === "knight007youtu@gmail.com" || user.email === "aabidaabdessamad@gmail.com";
}

function inferProvider(id: string): string {
  if (id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4") || id.startsWith("text-")) return "OpenAI";
  if (id.startsWith("claude-")) return "Anthropic";
  if (id.startsWith("gemini-")) return "Google";
  if (id.startsWith("meta-llama-") || id.startsWith("llama-")) return "Meta";
  if (id.startsWith("mistral-") || id.startsWith("codestral-") || id.startsWith("devstral-") || id.startsWith("pixtral-") || id.startsWith("magistral-")) return "Mistral";
  if (id.startsWith("deepseek-")) return "DeepSeek";
  if (id.startsWith("phi-")) return "Microsoft";
  if (id.startsWith("grok-")) return "xAI";
  if (id.startsWith("command-") || id.startsWith("cohere-")) return "Cohere";
  if (id.startsWith("jamba-") || id.startsWith("ai21-")) return "AI21";
  if (id.startsWith("qwen-")) return "Alibaba";
  return "Other";
}

function inferTier(id: string): "standard" | "premium" {
  const premiumPrefixes = ["gpt-4.1", "gpt-4o", "gpt-4.5", "o1", "o3", "o4-mini", "claude-3-5-sonnet", "claude-3-7-sonnet", "claude-sonnet-4-5", "claude-3-opus", "gemini-2.5-pro", "grok-3"];
  if (premiumPrefixes.some(p => id.includes(p) && !id.includes("-mini") && !id.includes("-nano") && !id.includes("-haiku") && !id.includes("-flash-lite"))) return "premium";
  return "standard";
}

// GET: returns all live Copilot models merged with per-model overrides from DB
export async function GET(req: NextRequest) {
  const sb = getServiceSupabase();
  // Load overrides
  const { data: overrides } = await sb.from("ai_models_config").select("id, is_enabled, is_default, sort_order, custom_label");
  const overrideMap = new Map((overrides ?? []).map((o: any) => [o.id, o]));

  let liveModels: any[] = [];
  try {
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
    if (res.ok) {
      const json = await res.json();
      liveModels = (json.data ?? json).filter((m: any) =>
        m.id && (m.capabilities?.type === "chat" || !m.capabilities?.type) && m.model_picker_enabled !== false
      );
    }
  } catch {}

  const result = liveModels.map((m: any) => {
    const ov = overrideMap.get(m.id);
    return {
      id: m.id,
      label: ov?.custom_label ?? m.name ?? m.id,
      provider: inferProvider(m.id),
      tier: inferTier(m.id),
      is_enabled: ov ? ov.is_enabled : true,
      is_default: ov?.is_default ?? false,
      sort_order: ov?.sort_order ?? 999,
      supports_vision: m.capabilities?.supports?.vision ?? false,
      supports_tools: m.capabilities?.supports?.tool_calls ?? false,
      max_context: m.capabilities?.limits?.max_context_window_tokens,
      // live info
      billing_plan: m.billing_plan,
      model_picker_enabled: m.model_picker_enabled,
    };
  });

  return NextResponse.json(result.sort((a: any, b: any) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)));
}

// PATCH: upsert per-model override
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = getServiceSupabase();
  if (updates.is_default === true) {
    await sb.from("ai_models_config").update({ is_default: false }).neq("id", id);
  }
  // Upsert override row
  const { data, error } = await sb.from("ai_models_config")
    .upsert({ id, ...updates }, { onConflict: "id" })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await getServiceSupabase().from("ai_models_config").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
