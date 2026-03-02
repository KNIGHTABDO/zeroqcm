"use client";
import { use, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen, ChevronRight, Loader2, CheckCircle, Clock, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

type Activity = {
  id: number;
  nom: string;
  total_questions: number;
  source?: string;
};

type ModuleInfo = {
  id: number;
  nom: string;
  semestre_id: string;
};

type Progress = {
  activity_id: number;
  answered: number;
  correct: number;
};

export default function ModuleActivitiesPage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id: semId, moduleId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [progress, setProgress] = useState<Record<number, Progress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const modId = parseInt(moduleId);

      const [{ data: mod }, { data: acts }] = await Promise.all([
        supabase.from("modules").select("id, nom, semestre_id").eq("id", modId).maybeSingle(),
        supabase.from("activities").select("id, nom, total_questions, source").eq("module_id", modId).order("id"),
      ]);

      setModuleInfo(mod);
      setActivities((acts ?? []) as Activity[]);

      if (user && acts?.length) {
        const actIds = acts.map((a: Activity) => a.id);
        const { data: ans } = await supabase
          .from("user_answers")
          .select("is_correct, questions!inner(activities!inner(id))")
          .eq("user_id", user.id)
          .in("questions.activities.id", actIds);

        const prog: Record<number, Progress> = {};
        (ans ?? []).forEach((a: any) => {
          const aid = a.questions?.activities?.id;
          if (!aid) return;
          if (!prog[aid]) prog[aid] = { activity_id: aid, answered: 0, correct: 0 };
          prog[aid].answered++;
          if (a.is_correct) prog[aid].correct++;
        });
        setProgress(prog);
      }
      setLoading(false);
    }
    load();
  }, [semId, moduleId, user]);

  const totalAnswered = Object.values(progress).reduce((s, p) => s + p.answered, 0);
  const totalQ = activities.reduce((s, a) => s + a.total_questions, 0);
  const overallPct = totalQ > 0 ? Math.round((totalAnswered / totalQ) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-2xl mx-auto px-4">

        {/* Sticky header */}
        <div className="sticky top-0 z-20 pt-4 pb-3" style={{ background: "var(--bg)" }}>
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl flex-shrink-0 transition-all"
              style={{ color: "var(--text-muted)", background: "var(--surface-alt)", border: "1px solid var(--border)" }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-[15px] font-bold truncate" style={{ color: "var(--text)" }}>
                {loading ? "Chargement…" : moduleInfo?.nom ?? "Module"}
              </h1>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {activities.length} activité{activities.length !== 1 ? "s" : ""}
              </p>
            </div>
            {totalQ > 0 && !loading && (
              <div className="flex-shrink-0 text-right">
                <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--accent)" }}>
                  {overallPct}%
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {totalAnswered}/{totalQ}
                </p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {!loading && totalQ > 0 && (
            <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: "var(--border)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--accent)" }}
                initial={{ width: 0 }}
                animate={{ width: `${overallPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="pb-24 space-y-2 pt-2">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          )}

          {!loading && activities.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
                Aucune activité disponible pour ce module.
              </p>
            </div>
          )}

          <AnimatePresence>
            {!loading && activities.map((activity, i) => {
              const prog = progress[activity.id];
              const answered = prog?.answered ?? 0;
              const correct = prog?.correct ?? 0;
              const pct = activity.total_questions > 0
                ? Math.round((answered / activity.total_questions) * 100)
                : 0;
              const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : null;
              const isComplete = pct >= 100;
              const isStarted = answered > 0 && !isComplete;

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                >
                  <Link
                    href={`/quiz/${activity.id}`}
                    className="block rounded-xl p-4 transition-all duration-150 group"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "var(--surface-alt)";
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Status icon */}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background: isComplete
                            ? "var(--success-subtle)"
                            : isStarted
                            ? "var(--accent-subtle)"
                            : "var(--surface-alt)",
                          border: `1px solid ${isComplete ? "var(--success-border)" : isStarted ? "var(--accent-border)" : "var(--border)"}`,
                        }}
                      >
                        {isComplete ? (
                          <CheckCircle className="w-4 h-4" style={{ color: "var(--success)" }} />
                        ) : isStarted ? (
                          <Clock className="w-4 h-4" style={{ color: "var(--accent)" }} />
                        ) : (
                          <Play className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--text)" }}>
                            {activity.nom}
                          </p>
                          <ChevronRight
                            className="w-4 h-4 flex-shrink-0 mt-0.5 transition-transform duration-150 group-hover:translate-x-0.5"
                            style={{ color: "var(--text-muted)" }}
                          />
                        </div>

                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {activity.total_questions} question{activity.total_questions !== 1 ? "s" : ""}
                          </span>
                          {activity.source && (
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                              style={{ background: "var(--surface-active)", color: "var(--text-muted)" }}
                            >
                              {activity.source}
                            </span>
                          )}
                          {accuracy !== null && (
                            <span
                              className="text-[11px] font-semibold"
                              style={{ color: accuracy >= 70 ? "var(--success)" : accuracy >= 50 ? "var(--warning)" : "var(--error)" }}
                            >
                              {accuracy}% juste
                            </span>
                          )}
                        </div>

                        {/* Progress bar */}
                        {activity.total_questions > 0 && (
                          <div className="mt-2.5">
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: isComplete ? "var(--success)" : "var(--accent)" }}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: i * 0.04 + 0.1, duration: 0.7, ease: "easeOut" }}
                              />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
                                {answered}/{activity.total_questions}
                              </span>
                              <span className="text-[10px] font-medium" style={{ color: pct > 0 ? "var(--text-secondary)" : "var(--text-disabled)" }}>
                                {pct > 0 ? (isComplete ? "✓ Terminé" : `${pct}%`) : "Non commencé"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
