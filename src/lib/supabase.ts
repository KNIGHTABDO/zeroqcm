import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  faculty: string;
  annee_etude: number;
  preferences: {
    theme: "dark" | "light";
    ai_model: string;
    ai_key: string | null;
    notifications: boolean;
    language: "fr" | "ar";
  };
};

export async function getProfile(userId: string) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return data as Profile | null;
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }) {
  const { data } = await supabase.from("profiles").upsert(profile).select().single();
  return data as Profile | null;
}

export async function getActivityWithQuestions(activityId: number) {
  const { data: activity } = await supabase
    .from("activities")
    .select("*, modules(nom, semesters(nom, faculty))")
    .eq("id", activityId)
    .single();

  const { data: questions } = await supabase
    .from("questions")
    .select("*, choices(*)")
    .eq("activity_id", activityId)
    .order("position");

  return { activity, questions: questions ?? [] };
}

export async function submitAnswer(params: {
  userId: string;
  questionId: string;
  activityId: number;
  selectedChoiceIds: string[];
  isCorrect: boolean;
  timeSpent: number;
}) {
  return supabase.from("user_answers").insert({
    user_id: params.userId,
    question_id: params.questionId,
    activity_id: params.activityId,
    selected_choice_ids: params.selectedChoiceIds,
    is_correct: params.isCorrect,
    time_spent_seconds: params.timeSpent,
  });
}

export async function getUserStats(userId: string) {
  const { data } = await supabase
    .from("user_answers")
    .select("is_correct, answered_at")
    .eq("user_id", userId);

  if (!data?.length) return { total: 0, correct: 0, rate: 0, streak: 0 };

  const total = data.length;
  const correct = data.filter((a) => a.is_correct).length;
  const rate = Math.round((correct / total) * 100);

  // Streak calc
  const dates = [...new Set(data.map((a) => a.answered_at.split("T")[0]))].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().split("T")[0];
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    if (dates[i] === expected || (i === 0 && dates[i] === today)) streak++;
    else break;
  }

  return { total, correct, rate, streak };
}

export async function getComments(questionId: string) {
  const { data } = await supabase
    .from("comments")
    .select("*, profiles(username, avatar_url), comment_likes(user_id)")
    .eq("question_id", questionId)
    .is("parent_id", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function addComment(params: { questionId: string; userId: string; content: string; isAnonymous?: boolean; parentId?: string }) {
  return supabase.from("comments").insert({
    question_id: params.questionId,
    user_id: params.userId,
    content: params.content,
    is_anonymous: params.isAnonymous ?? false,
    parent_id: params.parentId ?? null,
  }).select("*, profiles(username, avatar_url)").single();
}
