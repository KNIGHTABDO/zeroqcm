// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAuthUser() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// Returns weak questions (wrong >= 2 times) for authenticated user, optionally filtered by module.
export async function POST(req: NextRequest) {
  // Server-side auth — ignore client-provided userId
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const moduleId = body.moduleId;
  const supabase = getServiceSupabase();

  const { data: wrongAnswers } = await supabase
    .from("user_answers")
    .select("question_id, is_correct")
    .eq("user_id", user.id)
    .eq("is_correct", false);

  const wrongCount: Record<string, number> = {};
  for (const a of wrongAnswers ?? []) {
    wrongCount[a.question_id] = (wrongCount[a.question_id] ?? 0) + 1;
  }

  const weakIds = Object.entries(wrongCount)
    .filter(([, c]) => c >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 40)
    .map(([id]) => id);

  if (!weakIds.length) return NextResponse.json({ questions: [], count: 0, moduleName: null });

  let query = supabase
    .from("questions")
    .select("*, choices(*)")
    .neq("source_type", "open")
    .in("id", weakIds);

  if (moduleId) query = query.eq("module_id", moduleId);

  const { data: questions } = await query;

  let moduleName: string | null = null;
  if (moduleId) {
    const { data: mod } = await supabase
      .from("modules")
      .select("nom")
      .eq("id", moduleId)
      .maybeSingle();
    moduleName = mod?.nom ?? null;
  }

  return NextResponse.json({
    questions: questions ?? [],
    count: questions?.length ?? 0,
    moduleName,
  });
}
