"use client";
import { use, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronRight, ArrowLeft, Search, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

type Module = {
  id: number;
  nom: string;
  total_activities: number;
  total_questions: number;
  locked?: boolean;
};

type UserProgress = {
  module_id: number;
  answered: number;
  correct: number;
};

type SemInfo = {
  semestre_id: string;
  nom: string;
  faculty: string;
  total_questions: number;
};

export default function SemestreModulesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [semInfo, setSemInfo] = useState<SemInfo | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Record<number, UserProgress>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Load semester info
      const { data: sem } = await supabase
        .from("semesters")
        .select("semestre_id, nom, faculty, total_questions")
        .eq("semestre_id", id)
        .maybeSingle();

      setSemInfo(sem);

      // Load modules for this semester
      const { data: mods } = await supabase
        .from("modules")
        .select("id, nom, total_activities, total_questions")
        .eq("semester_id", id)
        .order("id");

      const modList = (mods ?? []) as Module[];
      setModules(modList);

      // Load user progress per module
      if (user && modList.length > 0) {
        const modIds = modList.map(m => m.id);
        const { data: answers } = await supabase
          .from("user_answers")
          .select("question_id, is_correct, questions!inner(activities!inner(module_id))")
          .eq("user_id", user.id)
          .in("questions.activities.module_id", modIds);

        const prog: Record<number, UserProgress> = {};
        (answers ?? []).forEach((a: any) => {
          const mid = a.questions?.activities?.module_id;
          if (!mid) return;
          if (!prog[mid]) prog[mid] = { module_id: mid, answered: 0, correct: 0 };
          prog[mid].answered++;
          if (a.is_correct) prog[mid].correct++;
        });
        setProgress(prog);
      }

      setLoading(false);
    }
    load();
  }, [id, user]);

  const filtered = modules.filter(m =>
    !search || m.nom.toLowerCase().includes(search.toLowerCase())
  );

  const totalAnswered = Object.values(progress).reduce((s, p) => s + p.answered, 0);
  const totalQuestions = semInfo?.total_questions ?? modules.reduce((s, m) => s + m.total_questions, 0);
  const overallPct = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-2xl mx-auto px-4">

        {/* ── Sticky header ── */}
        <div
          className="sticky top-0 z-20 pt-4 pb-3"
          style={{ background: "var(--bg)" }}
        >
          {/* Back + title row */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl flex-shrink-0 transition-all"
              style={{ color: "var(--text-muted)", background: "var(--surface-alt)", border: "1px solid var(--border)" }}
            >
              <ArrowLeft strokeWidth={1.5} className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-[15px] font-bold truncate" style={{ color: "var(--text)" }}>
                {loading ? "Chargement…" : semInfo?.nom ?? id}
              </h1>
              {semInfo?.faculty && (
                <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                  {semInfo.faculty}
                </p>
              )}
            </div>
            {!loading && totalQuestions > 0 && (
              <div className="flex-shrink-0 text-right">
                <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {overallPct}%
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {totalAnswered}/{totalQuestions}
                </p>
              </div>
            )}
          </div>

          {/* Overall progress bar */}
          {!loading && totalQuestions > 0 && (
            <div className="h-1 rounded-full overflow-hidden mb-3" style={{ background: "var(--border)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--accent)" }}
                initial={{ width: 0 }}
                animate={{ width: `${overallPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          )}

          {/* Search */}
          {modules.length > 4 && (
            <motion.div
              animate={{
                borderColor: searchFocused ? "var(--border-strong)" : "var(--border)",
              }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
              style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
            >
              <Search strokeWidth={1.5} className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Rechercher un module…"
                className="flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: "var(--text)", caretColor: "var(--accent)" }}
              />
              <AnimatePresence>
                {search && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => setSearch("")}
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span className="text-[11px]">✕</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="pb-24 space-y-2 pt-2">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 strokeWidth={1.5} className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
                {search ? "Aucun module trouvé" : "Aucun module disponible"}
              </p>
            </div>
          )}

          <AnimatePresence>
            {!loading && filtered.map((mod, i) => {
              const prog = progress[mod.id];
              const answered = prog?.answered ?? 0;
              const correct = prog?.correct ?? 0;
              const pct = mod.total_questions > 0
                ? Math.round((answered / mod.total_questions) * 100)
                : 0;
              const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : null;
              const isComplete = pct >= 100;

              return (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href={`/semestres/${id}/${mod.id}`}
                    className="block rounded-xl p-4 transition-all duration-150 group"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                    }}

                  >
                    <div className="flex items-start gap-3">
                      {/* Module icon */}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background: isComplete ? "var(--success-subtle)" : answered > 0 ? "var(--accent-subtle)" : "var(--surface-alt)",
                          border: `1px solid ${isComplete ? "var(--success-border)" : answered > 0 ? "var(--accent-border)" : "var(--border)"}`,
                        }}
                      >
                        {isComplete
                          ? <CheckCircle strokeWidth={1.5} className="w-4 h-4" style={{ color: "var(--success)" }} />
                          : answered > 0
                          ? <BookOpen strokeWidth={1.5} className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                          : <BookOpen strokeWidth={1.5} className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--text)" }}>
                            {mod.nom}
                          </p>
                          <ChevronRight strokeWidth={1.5}
                            className="w-4 h-4 flex-shrink-0 mt-0.5 transition-transform duration-150 group-hover:translate-x-0.5"
                            style={{ color: "var(--text-muted)" }}
                          />
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {mod.total_activities} activité{mod.total_activities !== 1 ? "s" : ""}
                          </span>
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {mod.total_questions} Q
                          </span>
                          {accuracy !== null && (
                            <span
                              className="text-[11px] font-semibold"
                              style={{ color: accuracy >= 70 ? "var(--success)" : accuracy >= 50 ? "var(--warning)" : "var(--error)" }}
                            >
                              {accuracy}% juste
                            </span>
                          )}
                          {answered === 0 && (
                            <span className="text-[11px]" style={{ color: "var(--text-disabled)" }}>
                              Non commencé
                            </span>
                          )}
                        </div>

                        {/* Progress bar */}
                        {mod.total_questions > 0 && (
                          <div className="mt-2.5">
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                              <motion.div
                                className="h-full rounded-full"
                                style={{
                                  background: isComplete ? "var(--success)" : "var(--accent)",
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: i * 0.04 + 0.1, duration: 0.7, ease: "easeOut" }}
                              />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
                                {answered}/{mod.total_questions} répondues
                              </span>
                              <span className="text-[10px] font-medium" style={{ color: pct > 0 ? "var(--text-secondary)" : "var(--text-disabled)" }}>
                                {pct}%
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
