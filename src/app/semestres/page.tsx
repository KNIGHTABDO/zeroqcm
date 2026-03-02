"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { BookOpen, ChevronRight, Lock, Flame, Target, Clock, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

function parseSNum(id: string): number {
  const m = id.match(/[sS](\d+)/);
  return m ? parseInt(m[1]) : 0;
}

type SemRow = {
  semestre_id: string;
  nom: string;
  faculty: string;
  total_questions: number;
};

type UserStats = {
  streak: number;
  total: number;
  correct: number;
};

type LastSession = {
  module_name: string;
  activity_name: string;
  activity_id: number;
} | null;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

const stagger = {
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};
const item = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

function SemestresPageInner() {
  const { user, profile } = useAuth();
  const [semesters, setSemesters] = useState<SemRow[]>([]);
  const [userSNum, setUserSNum] = useState<number | null>(null);
  const [stats, setStats] = useState<UserStats>({ streak: 0, total: 0, correct: 0 });
  const [lastSession, setLastSession] = useState<LastSession>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<number | null>(() => {
    const s = searchParams.get("s");
    return s ? parseInt(s) : null;
  });
  const [loading, setLoading] = useState(true);

  function applyFilter(val: number | null) {
    setSelectedFilter(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val !== null) params.set("s", String(val));
    else params.delete("s");
    router.replace(`/semestres?${params.toString()}`, { scroll: false });
  }

  // Load user profile
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("annee_etude").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.annee_etude) {
          const YEAR_TO_SNUM: Record<number, number> = {1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10};
          setUserSNum(YEAR_TO_SNUM[data.annee_etude as number] ?? 0);
        }
      });
  }, [user]);

  // Load stats
  useEffect(() => {
    if (!user) return;
    supabase.from("user_stats").select("streak,total_answers,correct_answers")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStats({
            streak: data.streak ?? 0,
            total: data.total_answers ?? 0,
            correct: data.correct_answers ?? 0,
          });
        }
      });
  }, [user]);

  // Load last session
  useEffect(() => {
    if (!user) return;
    supabase.from("user_answers")
      .select("activity_id, activities(nom, modules(nom))")
      .eq("user_id", user.id)
      .order("answered_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.activity_id && data.activities) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const act = (data.activities as unknown as { nom: string; modules?: { nom: string } | null });
          setLastSession({
            activity_id: data.activity_id,
            activity_name: act.nom,
            module_name: act.modules?.nom ?? "",
          });
        }
      });
  }, [user]);

  // Load semesters
  useEffect(() => {
    supabase.from("semesters").select("semestre_id,nom,faculty,total_questions")
      .order("semestre_id")
      .then(({ data }) => {
        setSemesters(data ?? []);
        setLoading(false);
      });
  }, []);

  const availableSNums = [...new Set(semesters.map((s) => parseSNum(s.semestre_id)))].sort((a, b) => a - b);
  const filtered = selectedFilter
    ? semesters.filter((s) => parseSNum(s.semestre_id) === selectedFilter)
    : semesters;
  const total = filtered.reduce((sum, s) => sum + (s.total_questions || 0), 0);

  const displayName = profile?.full_name?.split(" ")[0] ?? profile?.username ?? "Étudiant";
  const rate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  return (
    <main
      className="min-h-screen pb-safe"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-6 md:pt-8 space-y-6">

        {/* ── Hero greeting ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-1"
        >
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            {getGreeting()},
          </p>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            {displayName} 👋
          </h1>
          {loading ? null : (
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {total.toLocaleString()} questions disponibles · {filtered.length} sections
            </p>
          )}
        </motion.div>

        {/* ── Stats row ── */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-3 gap-3"
          >
            {[
              {
                icon: Flame,
                value: `${stats.streak}j`,
                label: "Série",
                color: "var(--warning)",
                subtle: "var(--warning-subtle)",
                border: "var(--warning-border)",
              },
              {
                icon: Target,
                value: `${rate}%`,
                label: "Précision",
                color: "var(--success)",
                subtle: "var(--success-subtle)",
                border: "var(--success-border)",
              },
              {
                icon: BookOpen,
                value: stats.total.toLocaleString(),
                label: "Réponses",
                color: "var(--accent)",
                subtle: "var(--accent-subtle)",
                border: "var(--accent-border)",
              },
            ].map(({ icon: Icon, value, label, color, subtle, border }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 py-4 rounded-xl"
                style={{ background: subtle, border: `1px solid ${border}` }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-lg font-bold tabular-nums" style={{ color: "var(--text)" }}>
                  {value}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {label}
                </span>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Continue last session ── */}
        <AnimatePresence>
          {lastSession && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, delay: 0.10 }}
            >
              <Link
                href={`/quiz/${lastSession.activity_id}`}
                className="flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-150"
                style={{
                  background: "var(--accent-subtle)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--accent)", }}
                  >
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px]" style={{ color: "var(--accent)" }}>Continuer</p>
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text)" }}>
                      {lastSession.activity_name}
                    </p>
                    {lastSession.module_name && (
                      <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                        {lastSession.module_name}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Quick actions ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12 }}
          className="grid grid-cols-2 gap-2"
        >
          <Link
            href="/chatwithai"
            className="flex items-center gap-2.5 px-3 py-3 rounded-xl transition-all duration-150"
            style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
          >
            <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
            <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Chat IA
            </span>
          </Link>
          <Link
            href="/flashcards"
            className="flex items-center gap-2.5 px-3 py-3 rounded-xl transition-all duration-150"
            style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
          >
            <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: "var(--success)" }} />
            <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Flashcards
            </span>
          </Link>
        </motion.div>

        {/* ── S-filter tabs ── */}
        {!loading && availableSNums.length > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex gap-2 flex-wrap"
          >
            <button
              onClick={() => applyFilter(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150"
              style={{
                background: !selectedFilter ? "var(--surface-active)" : "transparent",
                borderColor: !selectedFilter ? "var(--border-strong)" : "var(--border)",
                color: !selectedFilter ? "var(--text)" : "var(--text-muted)",
              }}
            >
              Tous
            </button>
            {availableSNums.map((n) => {
              const isActive = selectedFilter === n;
              return (
                <button
                  key={n}
                  onClick={() => applyFilter(n)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150"
                  style={{
                    background: isActive ? "var(--accent-subtle)" : "transparent",
                    borderColor: isActive ? "var(--accent-border)" : "var(--border)",
                    color: isActive ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  S{n}
                  {userSNum === n && (
                    <span className="ml-1 text-[9px] opacity-70">mon sem.</span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}

        {/* ── Semester cards ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl skeleton" />
            ))}
          </div>
        ) : (
          <motion.div
            className="space-y-2"
            variants={stagger}
            initial="initial"
            animate="animate"
          >
            {filtered.map((sem) => {
              const href = `/semestres/${encodeURIComponent(sem.semestre_id)}`;
              const semNum = parseSNum(sem.semestre_id);
              const isUserSem = userSNum === semNum;
              return (
                <motion.div key={sem.semestre_id} variants={item}>
                  <Link
                    href={href}
                    className="flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-150 group"
                    style={{
                      background: isUserSem ? "var(--surface-alt)" : "var(--surface)",
                      border: isUserSem ? "1px solid var(--border-strong)" : "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] font-bold"
                        style={{
                          background: isUserSem ? "var(--accent-subtle)" : "var(--surface-active)",
                          color: isUserSem ? "var(--accent)" : "var(--text-muted)",
                          border: isUserSem ? "1px solid var(--accent-border)" : "1px solid var(--border)",
                        }}
                      >
                        S{semNum}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold truncate" style={{ color: "var(--text)" }}>
                          {sem.nom}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {(sem.total_questions ?? 0).toLocaleString()} questions
                          </span>
                          {isUserSem && (
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                              style={{
                                background: "var(--accent-subtle)",
                                color: "var(--accent)",
                              }}
                            >
                              Mon sem.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className="w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
                      style={{ color: "var(--text-muted)" }}
                    />
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </main>
  );
}

// Wrap in Suspense for useSearchParams
import { Suspense } from "react";
export default function SemestresPage() {
  return (
    <Suspense>
      <SemestresPageInner />
    </Suspense>
  );
}
