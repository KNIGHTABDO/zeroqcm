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

async function getAuthUser(req: NextRequest) {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  // Server-side auth — ignore client-provided userId
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get("moduleId");
  const limit = parseInt(searchParams.get("limit") ?? "30");

  const supabase = getServiceSupabase();

  // Find questions answered wrong 2+ times
  const { data: wrongAnswers } = await supabase
    .from("user_answers")
    .select("question_id, is_correct")
    .eq("user_id", user.id)
    .eq("is_correct", false);

  if (!wrongAnswers?.length) {
    return NextResponse.json({ questions: [], count: 0 });
  }

  const wrongCount: Record<string, number> = {};
  for (const a of wrongAnswers) {
    wrongCount[a.question_id] = (wrongCount[a.question_id] ?? 0) + 1;
  }

  const weakIds = Object.entries(wrongCount)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id]) => id);

  if (!weakIds.length) {
    return NextResponse.json({ questions: [], count: 0 });
  }

  let query = supabase
    .from("questions")
    .select("id, texte, image_url, activity_id, module_id, choices(*)")
    .neq("source_type", "open")
    .in("id", weakIds);

  if (moduleId) query = query.eq("module_id", parseInt(moduleId));

  const { data: questions } = await query;

  return NextResponse.json({
    questions: questions ?? [],
    count: questions?.length ?? 0,
    wrongCounts: wrongCount,
  });
}
