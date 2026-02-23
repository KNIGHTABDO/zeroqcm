"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, BookOpen, LogIn } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getUserStats } from "@/lib/supabase";
import Link from "next/link";
import { StatCardSkeleton } from "@/components/ui/Skeleton";

// Animated SVG ring component
function ProgressRing({
  value, max = 100, size = 80, stroke = 6,
  color = "#3b82f6", label, sublabel,
}: {
  value: number; max?: number; size?: number; stroke?: number;
  color?: string; label: string; sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circ * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke="var(--border)" strokeWidth={stroke} />
          {/* Progress */}
          <motion.circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold" style={{ color: "var(--text)" }}>
            {value.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{label}</p>
        {sublabel && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sublabel}</p>}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ total: 0, correct: 0, rate: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      getUserStats(user.id).then((s) => { setStats(s); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, [user, authLoading]);

  const rings = [
    { value: stats.total, max: Math.max(stats.total, 500), color: "#3b82f6", label: "Répondues", sublabel: "questions" },
    { value: stats.correct, max: Math.max(stats.total, 1), color: "#10b981", label: "Correctes", sublabel: `${stats.total > 0 ? stats.rate : 0}%` },
    { value: stats.streak, max: Math.max(stats.streak, 30), color: "#f97316", label: "Série", sublabel: "jours" },
  ];

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-6 md:max-w-2xl lg:max-w-3xl">

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold">Statistiques</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Votre progression globale</p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : !user ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border p-8 text-center space-y-3"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <LogIn className="w-8 h-8 mx-auto" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Connectez-vous pour voir vos stats</p>
            <Link href="/auth"
              style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
              Se connecter
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Animated progress rings */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="rounded-2xl border px-6 py-6"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-around">
                {rings.map((ring, i) => (
                  <motion.div key={ring.label}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15 * i, duration: 0.4 }}>
                    <ProgressRing {...ring} size={80} stroke={6} />
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Rate bar */}
            {stats.total > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="rounded-2xl border px-5 py-4 space-y-3"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Taux de réussite global</p>
                  <span className={`text-sm font-bold ${stats.rate >= 70 ? "text-emerald-400" : stats.rate >= 50 ? "text-amber-400" : "text-red-400"}`}>
                    {stats.rate}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-active)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: stats.rate >= 70 ? "#10b981" : stats.rate >= 50 ? "#f59e0b" : "#ef4444" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.rate}%` }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
                  />
                </div>
                <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>{stats.correct} correctes</span>
                  <span>{stats.total - stats.correct} incorrectes</span>
                </div>
              </motion.div>
            )}

            {/* Streak card */}
            {stats.streak > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="rounded-2xl border px-5 py-4 flex items-center gap-4"
                style={{ background: "var(--warning-subtle)", borderColor: "var(--warning-border)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--warning-subtle)", border: "1px solid var(--warning-border)" }}>
                  <Flame className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-orange-400">
                    {stats.streak} jour{stats.streak > 1 ? "s" : ""} de suite 🔥
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    Continuez à réviser chaque jour !
                  </p>
                </div>
              </motion.div>
            )}

            {/* Empty state */}
            {stats.total === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                className="rounded-2xl border p-6 text-center space-y-3"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <BookOpen className="w-8 h-8 mx-auto" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Aucune question répondue pour le moment.
                </p>
                <Link href="/semestres/s1_fmpc"
                  style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
                  Commencer S1 FMPC
                </Link>
              </motion.div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
