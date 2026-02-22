import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Question helpers ──────────────────────────────────────────────────────
export async function getSemesters() {
  const { data, error } = await supabase
    .from("semesters")
    .select("*")
    .order("nom");
  if (error) throw error;
  return data;
}

export async function getModulesBySemester(semesterId: string) {
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .eq("semester_id", semesterId)
    .order("nom");
  if (error) throw error;
  return data;
}

export async function getActivitiesByModule(moduleId: number) {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("module_id", moduleId)
    .order("nom");
  if (error) throw error;
  return data;
}

export async function getActivityWithQuestions(activityId: number) {
  const { data: activity, error: ae } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .single();
  if (ae) throw ae;

  const { data: questions, error: qe } = await supabase
    .from("questions")
    .select("*, choices(*)")
    .eq("activity_id", activityId)
    .order("position");
  if (qe) throw qe;

  return { activity, questions };
}
