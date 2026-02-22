import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// ─── Types matching the REAL DB schema ────────────────────────────────────────
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
  } | null;
  created_at?: string;
};

export type Semester = {
  id: string;
  semestre_id: string;
  nom: string;
  faculty: string;
  total_modules: number;
  total_questions: number;
  total_activities: number;
};

export type Module = {
  id: number;
  module_id: string;
  nom: string;
  semester_id: string;
  total_questions: number;
  total_activities: number;
};

export type Activity = {
  id: number;
  activite_id: string;
  nom: string;
  type_activite: string;
  module_id: number;
  total_questions: number;
  chapitre: string | null;
};

export type Question = {
  id: string;
  id_question: number;
  texte: string;
  image_url: string | null;
  correction: string | null;
  source_question: string | null;
  source_type: string | null;
  position: number;
  activity_id: number;
  module_id: number;
};

export type Choice = {
  id: string;
  question_id: string;
  contenu: string;
  est_correct: boolean;
  pourcentage: number;
  explication: string | null;
};

// ─── Auth helpers ──────────────────────────────────────────────────────────────
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return data;
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").upsert(profile).select().single();
  return data;
}

// ─── Quiz data ────────────────────────────────────────────────────────────────
export async function getActivityWithQuestions(activityId: number) {
  // Two separate queries — avoids relying on PostgREST join resolution
  const [{ data: activity }, { data: allQuestions }] = await Promise.all([
    supabase.from("activities").select("*").eq("id", activityId).single(),
    supabase
      .from("questions")
      .select("*, choices(*)")
      .eq("activity_id", activityId)
      .order("position"),
  ]);
  // Separate QCM (has choices) vs open/QROC (no choices)
  const questions = (allQuestions ?? []).filter(
    (q: { source_type: string; choices: unknown[] }) =>
      q.source_type !== "open" && Array.isArray(q.choices) && q.choices.length > 0
  );
  const openQuestions = (allQuestions ?? []).filter(
    (q: { source_type: string; choices: unknown[] }) =>
      q.source_type === "open" || !Array.isArray(q.choices) || q.choices.length === 0
  );
  return { activity, questions, openQuestions };
}

// ─── User progress ────────────────────────────────────────────────────────────
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

  const dates = [...new Set(data.map((a) => a.answered_at.split("T")[0]))].sort().reverse();
  let streak = 0;
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    if (dates[i] === expected) streak++;
    else break;
  }

  return { total, correct, rate, streak };
}

// ─── Comments ─────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getComments(questionId: string): Promise<any[]> {
  const { data } = await supabase
    .from("comments")
    .select("id, content, is_anonymous, created_at, user_id, profiles(username, avatar_url), comment_likes(user_id)")
    .eq("question_id", questionId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function addComment(params: {
  questionId: string;
  userId: string;
  content: string;
  isAnonymous: boolean;
}) {
  return supabase.from("comments").insert({
    question_id: params.questionId,
    user_id: params.userId,
    content: params.content,
    is_anonymous: params.isAnonymous,
  }).select().single();
}
