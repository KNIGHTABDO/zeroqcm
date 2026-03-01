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

// GET: returns live Copilot models merged with DB overrides.
// Falls back to DB rows if Copilot API is unavailable (no token yet, cold start, etc).
export async function GET(req: NextRequest) {
  const sb = getServiceSupabase();

  // Always load DB rows first (seed data + overrides)
  const { data: dbRows } = await sb.from("ai_models_config").select("*").order("sort_order");
  const dbMap = new Map((dbRows ?? []).map((r: any) => [r.id, r]));

  // Try to fetch live models from Copilot API (3s timeout)
  let liveModels: any[] = [];
  let usingLive = false;
  try {
    const tokenStr = await getCopilotToken();
    const baseURL = getCopilotBaseURL(tokenStr);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${baseURL}/models`, {
      headers: {
        Authorization: `Bearer ${tokenStr}`,
        "editor-version": "vscode/1.98.0",
        "editor-plugin-version": "GitHub.copilot/1.276.0",
        "copilot-integration-id": "vscode-chat",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      liveModels = (json.data ?? json).filter((m: any) =>
        m.id && (m.capabilities?.type === "chat" || !m.capabilities?.type) && m.model_picker_enabled !== false
      );
      usingLive = liveModels.length > 0;
    }
  } catch {}

  if (usingLive) {
    // Merge live Copilot models with DB overrides
    const result = liveModels.map((m: any) => {
      const db = dbMap.get(m.id);
      return {
        id: m.id,
        label: db?.custom_label ?? db?.label ?? m.name ?? m.id,
        provider: inferProvider(m.id),
        tier: inferTier(m.id),
        is_enabled: db ? db.is_enabled : true,
        is_default: db?.is_default ?? false,
        sort_order: db?.sort_order ?? 999,
        supports_vision: m.capabilities?.supports?.vision ?? false,
        supports_tools: m.capabilities?.supports?.tool_calls ?? false,
        max_context: m.capabilities?.limits?.max_context_window_tokens,
        billing_plan: m.billing_plan,
        source: "live",
      };
    });
    return NextResponse.json(result.sort((a: any, b: any) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)));
  }

  // Fallback: serve from DB seed (gracefully handles no-token and cold-start)
  const fallback = (dbRows ?? []).map((m: any) => ({
    id: m.id,
    label: m.custom_label ?? m.label ?? m.id,
    provider: m.provider ?? inferProvider(m.id),
    tier: m.tier ?? inferTier(m.id),
    is_enabled: m.is_enabled ?? true,
    is_default: m.is_default ?? false,
    sort_order: m.sort_order ?? 999,
    supports_vision: m.supports_vision ?? false,
    supports_tools: m.supports_tools ?? true,
    max_context: null,
    source: "db",
  }));
  return NextResponse.json(fallback.sort((a: any, b: any) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)));
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
