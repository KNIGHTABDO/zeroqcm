import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Returns a session token that the quiz page can use to fetch weak questions
export async function POST(req: NextRequest) {
  const { userId, moduleId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { data: wrongAnswers } = await supabase
    .from("user_answers")
    .select("question_id, is_correct")
    .eq("user_id", userId)
    .eq("is_correct", false);

  const wrongCount: Record<string, number> = {};
  for (const a of (wrongAnswers ?? [])) {
    wrongCount[a.question_id] = (wrongCount[a.question_id] ?? 0) + 1;
  }

  const weakIds = Object.entries(wrongCount)
    .filter(([, c]) => c >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 40)
    .map(([id]) => id);

  if (!weakIds.length) return NextResponse.json({ questions: [], count: 0 });

  let query = supabase
    .from("questions")
    .select("*, choices(*)")
    .in("id", weakIds);
  if (moduleId) query = query.eq("module_id", moduleId);
  const { data: questions } = await query;

  return NextResponse.json({ questions: questions ?? [], count: questions?.length ?? 0 });
}
