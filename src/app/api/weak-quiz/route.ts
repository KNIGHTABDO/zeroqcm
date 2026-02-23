import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Returns weak questions (wrong >= 2 times) for a user, optionally filtered by module.
// Also returns the module name for UI display.
export async function POST(req: NextRequest) {
  const { userId, moduleId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Fetch all incorrect answers for this user
  const { data: wrongAnswers } = await supabase
    .from("user_answers")
    .select("question_id, is_correct")
    .eq("user_id", userId)
    .eq("is_correct", false);

  // Count wrong attempts per question
  const wrongCount: Record<string, number> = {};
  for (const a of wrongAnswers ?? []) {
    wrongCount[a.question_id] = (wrongCount[a.question_id] ?? 0) + 1;
  }

  // Weak = wrong >= 2 times, sorted by error count descending
  const weakIds = Object.entries(wrongCount)
    .filter(([, c]) => c >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 40)
    .map(([id]) => id);

  if (!weakIds.length) return NextResponse.json({ questions: [], count: 0, moduleName: null });

  // Build question query
  let query = supabase
    .from("questions")
    .select("*, choices(*)")
    .neq("source_type", "open")
    .in("id", weakIds);

  if (moduleId) query = query.eq("module_id", moduleId);

  const { data: questions } = await query;

  // Look up module name if moduleId provided
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
