import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const moduleId = searchParams.get("moduleId");
  const limit = parseInt(searchParams.get("limit") ?? "30");

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Find questions answered wrong 2+ times (or never answered = also weak)
  const { data: wrongAnswers } = await supabase
    .from("user_answers")
    .select("question_id, is_correct")
    .eq("user_id", userId)
    .eq("is_correct", false);

  if (!wrongAnswers?.length) {
    return NextResponse.json({ questions: [], count: 0 });
  }

  // Count wrongs per question
  const wrongCount: Record<string, number> = {};
  for (const a of wrongAnswers) {
    wrongCount[a.question_id] = (wrongCount[a.question_id] ?? 0) + 1;
  }

  // Questions wrong >= 2 times
  const weakIds = Object.entries(wrongCount)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)   // worst first
    .slice(0, limit)
    .map(([id]) => id);

  if (!weakIds.length) {
    return NextResponse.json({ questions: [], count: 0 });
  }

  let query = supabase
    .from("questions")
    .select("id, texte, image_url, activity_id, module_id, choices(*)")
    .in("id", weakIds);

  if (moduleId) query = query.eq("module_id", parseInt(moduleId));

  const { data: questions } = await query;

  return NextResponse.json({
    questions: questions ?? [],
    count: questions?.length ?? 0,
    wrongCounts: wrongCount,
  });
}
