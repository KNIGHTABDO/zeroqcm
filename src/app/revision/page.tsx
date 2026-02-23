"use client";
import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, BookOpen, ChevronRight, LogIn, BarChart2, Target, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

type WeakModule = {
  module_id: number;
  module_name: string;
  semester_name: string;
  semestre_id: string;
  wrong_count: number;
  total_answered: number;
};

type OverallStats = {
  total_wrong: number;
  weak_modules: number;
  worst_module: string | null;
};

function StatCard({ value, label, icon: Icon, delay = 0 }: {
  value: string | number; label: string; icon: React.ElementType; delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3 p-4 rounded-2xl border"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <Icon className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
      <div>
        <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text)" }}>{value}</p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
    </motion.div>
  );
}

export default function RevisionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [modules, setModules] = useState<WeakModule[]>([]);
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    async function load() {
      // 1. Fetch all wrong answers
      const { data: wrongAnswers } = await supabase
        .from("user_answers")
        .select("question_id, is_correct")
        .eq("user_id", user!.id)
        .eq("is_correct", false);

      const { data: allAnswers } = await supabase
        .from("user_answers")
        .select("question_id, is_correct")
        .eq("user_id", user!.id);

      // Count wrong attempts per question
      const wrongCount: Record<string, number> = {};
      for (const a of wrongAnswers ?? []) {
        wrongCount[a.question_id] = (wrongCount[a.question_id] ?? 0) + 1;
      }

      // Weak = wrong >= 2 times
      const weakIds = Object.entries(wrongCount)
        .filter(([, c]) => c >= 2)
        .map(([id]) => id);

      if (!weakIds.length) {
        setStats({ total_wrong: (allAnswers ?? []).filter(a => !a.is_correct).length, weak_modules: 0, worst_module: null });
        setLoading(false);
        return;
      }

      // Fetch module info for weak questions
      const { data: questions } = await supabase
        .from("questions")
        .select("id, module_id")
        .in("id", weakIds.slice(0, 200));

      // Count weak questions per module
      const modWrong: Record<number, number> = {};
      for (const q of questions ?? []) {
        if (q.module_id) modWrong[q.module_id] = (modWrong[q.module_id] ?? 0) + wrongCount[q.id];
      }

      const modIds = Object.keys(modWrong).map(Number);
      if (!modIds.length) {
        setStats({ total_wrong: weakIds.length, weak_modules: 0, worst_module: null });
        setLoading(false);
        return;
      }

      // Fetch module + semester names
      const { data: modRows } = await supabase
        .from("modules")
        .select("id, nom, semester_id")
        .in("id", modIds);

      const semIds = [...new Set((modRows ?? []).map(m => m.semester_id))];
      const { data: semRows } = await supabase
        .from("semesters")
        .select("semestre_id, nom")
        .in("semestre_id", semIds);

      const semMap: Record<string, string> = {};
      for (const s of semRows ?? []) semMap[s.semestre_id] = s.nom;

      // Count total answered per module
      const allAnswerMap: Record<string, number> = {};
      for (const a of allAnswers ?? []) allAnswerMap[a.question_id] = (allAnswerMap[a.question_id] ?? 0) + 1;

      // Build module list
      const result: WeakModule[] = (modRows ?? [])
        .filter(m => modWrong[m.id])
        .map(m => ({
          module_id: m.id,
          module_name: m.nom,
          semester_name: semMap[m.semester_id] ?? m.semester_id,
          semestre_id: m.semester_id,
          wrong_count: modWrong[m.id] ?? 0,
          total_answered: (questions ?? []).filter(q => q.module_id === m.id).length,
        }))
        .sort((a, b) => b.wrong_count - a.wrong_count);

      const worst = result[0]?.module_name ?? null;

      setModules(result);
      setStats({
        total_wrong: weakIds.length,
        weak_modules: result.length,
        worst_module: worst,
      });
      setLoading(false);
    }

    load();
  }, [user]);

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!user && !loading) {
    return (
      <main className="min-h-screen pb-28 flex flex-col items-center justify-center px-4"
        style={{ background: "var(--bg)" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
            <Flame className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text)" }}>Révision ciblée</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Connectez-vous pour accéder à vos questions faibles et les réviser intelligemment.
            </p>
          </div>
          <Link href="/auth"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold w-full justify-center"
            style={{ background: "var(--text)", color: "var(--bg)" }}>
            <LogIn className="w-4 h-4" />
            Se connecter
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6 md:pt-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] uppercase tracking-[0.2em] mb-1.5" style={{ color: "var(--text-muted)" }}>
            Spaced repetition
          </p>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>Révision ciblée</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Vos questions ratées 2× ou plus, triées par priorité.
          </p>
        </motion.div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl border animate-pulse"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }} />
            ))}
          </div>
        ) : (
          <>
            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard value={stats.total_wrong} label="Questions faibles" icon={Target} delay={0} />
                <StatCard value={stats.weak_modules} label="Modules concernés" icon={BookOpen} delay={0.06} />
                <StatCard
                  value={stats.worst_module ? (stats.worst_module.length > 18 ? stats.worst_module.slice(0, 18) + "…" : stats.worst_module) : "—"}
                  label="Module le plus faible" icon={BarChart2} delay={0.12} />
              </div>
            )}

            {/* "All modules" shortcut */}
            {modules.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Link href="/revision/all">
                  <div className="group flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all cursor-pointer"
                    style={{ background: "var(--surface-alt)", borderColor: "var(--border-strong)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "var(--surface-hover)"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "var(--surface-alt)"}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--surface-active)", border: "1px solid var(--border-strong)" }}>
                      <Flame className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Tous les modules</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {stats?.total_wrong ?? 0} questions · priorité automatique
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                  </div>
                </Link>
              </motion.div>
            )}

            {/* Module list */}
            {modules.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.15em] px-1" style={{ color: "var(--text-muted)" }}>
                  Par module
                </p>
                {modules.map((m, i) => (
                  <motion.div key={m.module_id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 + i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                    <Link href={`/revision/${m.module_id}`}>
                      <div className="group flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all cursor-pointer"
                        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLDivElement).style.background = "var(--surface-hover)";
                          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)";
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.background = "var(--surface)";
                          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                        }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                          <BookOpen className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{m.module_name}</p>
                          <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                            {m.semester_name} · {m.wrong_count} erreurs
                          </p>
                        </div>
                        {/* Error count badge */}
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums flex-shrink-0"
                          style={{
                            background: m.wrong_count >= 10 ? "var(--error-subtle)" : "var(--warning-subtle)",
                            color: m.wrong_count >= 10 ? "var(--error)" : "var(--warning)",
                            border: `1px solid ${m.wrong_count >= 10 ? "var(--error-border)" : "var(--warning-border)"}`,
                          }}>
                          {m.wrong_count}
                        </span>
                        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              // Empty state
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="flex flex-col items-center text-center py-16 space-y-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                  <Target className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
                    Aucune question faible pour l&apos;instant
                  </p>
                  <p className="text-xs max-w-xs" style={{ color: "var(--text-muted)" }}>
                    Répondez à des QCM pour que vos erreurs répétées apparaissent ici.
                  </p>
                </div>
                <Link href="/semestres"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--text)", color: "var(--bg)" }}>
                  Commencer les QCM
                </Link>
              </motion.div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
