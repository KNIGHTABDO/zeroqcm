"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, BookOpen, LogIn, Trash2, AlertTriangle, Check, Loader2, Target, TrendingUp, Award } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getUserStats, supabase } from "@/lib/supabase";
import Link from "next/link";
import { StatCardSkeleton } from "@/components/ui/Skeleton";

// ── Activity heatmap (last 12 weeks) ───────────────────────────────
function ActivityHeatmap({ data }: { data: Record<string, number> }) {
  const today = new Date();
  const weeks = 12;
  const days: { date: string; count: number }[] = [];

  for (let d = (weeks * 7) - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const key = date.toISOString().slice(0, 10);
    days.push({ date: key, count: data[key] ?? 0 });
  }

  const maxCount = Math.max(1, ...days.map(d => d.count));

  const getColor = (count: number) => {
    if (count === 0) return "var(--surface-alt)";
    const intensity = count / maxCount;
    if (intensity < 0.25) return "rgba(96,165,250,0.25)";
    if (intensity < 0.5)  return "rgba(96,165,250,0.50)";
    if (intensity < 0.75) return "rgba(96,165,250,0.75)";
    return "var(--accent)";
  };

  // Group into weeks of 7 days
  const weekGroups: typeof days[] = [];
  for (let w = 0; w < weeks; w++) {
    weekGroups.push(days.slice(w * 7, (w + 1) * 7));
  }

  const dayLabels = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div className="space-y-2">
      <div className="flex gap-1 items-start">
        {/* Day labels */}
        <div className="flex flex-col gap-1 pt-0.5 mr-1">
          {dayLabels.map((l, i) => (
            <div key={i} className="w-3 h-3 flex items-center justify-center text-[8px]"
              style={{ color: "var(--text-muted)" }}>
              {i % 2 === 0 ? l : ""}
            </div>
          ))}
        </div>
        {/* Cells */}
        <div className="flex gap-1 flex-1">
          {weekGroups.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1 flex-1">
              {week.map((day, di) => (
                <div
                  key={di}
                  title={`${day.date}: ${day.count} questions`}
                  className="rounded-[3px] cursor-default transition-all duration-150"
                  style={{
                    background: getColor(day.count),
                    aspectRatio: "1",
                    minWidth: 10,
                    border: "1px solid var(--border-subtle)",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Moins</span>
        {[0, 0.3, 0.6, 1].map((v, i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-[2px]"
            style={{ background: v === 0 ? "var(--surface-alt)" : `rgba(96,165,250,${v})` }} />
        ))}
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Plus</span>
      </div>
    </div>
  );
}

// ── Animated progress ring ─────────────────────────────────────────
function ProgressRing({
  value, max = 100, size = 72, stroke = 5,
  color = "var(--accent)", label, sublabel,
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
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke="var(--border)" strokeWidth={stroke} />
          <motion.circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text)" }}>
            {typeof value === "number" && value > 1000 ? `${Math.round(value/1000)}k` : value.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>{label}</p>
        {sublabel && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sublabel}</p>}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ total: 0, correct: 0, rate: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [moduleStats, setModuleStats] = useState<{ name: string; total: number; correct: number; rate: number }[]>([]);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  async function handleReset() {
    if (!user) return;
    setResetting(true);
    await fetch("/api/reset-stats", { method: "DELETE" });
    setResetting(false);
    setResetOpen(false);
    setResetDone(true);
    setStats({ total: 0, correct: 0, rate: 0, streak: 0 });
    setHeatmapData({});
    setModuleStats([]);
    setTimeout(() => setResetDone(false), 3000);
  }

  useEffect(() => {
    if (authLoading || !user) { setLoading(false); return; }

    // Load main stats
    getUserStats(user.id).then(s => { setStats(s); setLoading(false); });

    // Load heatmap data (answers per day, last 84 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 84);
    supabase
      .from("user_answers")
      .select("answered_at")
      .eq("user_id", user.id)
      .gte("answered_at", cutoff.toISOString())
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data ?? []).forEach((row: { answered_at: string }) => {
          const day = row.answered_at.slice(0, 10);
          counts[day] = (counts[day] ?? 0) + 1;
        });
        setHeatmapData(counts);
      });

    // Load per-module stats
    supabase
      .from("user_answers")
      .select("is_correct, activities(modules(nom))")
      .eq("user_id", user.id)
      .limit(2000)
      .then(({ data }) => {
        const map = new Map<string, { total: number; correct: number }>();
        (data ?? []).forEach((row: any) => {
          const name = row.activities?.modules?.nom ?? "Inconnu";
          const existing = map.get(name) ?? { total: 0, correct: 0 };
          map.set(name, {
            total: existing.total + 1,
            correct: existing.correct + (row.is_correct ? 1 : 0),
          });
        });
        const sorted = [...map.entries()]
          .map(([name, s]) => ({ name, ...s, rate: s.total > 0 ? Math.round(s.correct / s.total * 100) : 0 }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 8);
        setModuleStats(sorted);
      });
  }, [user, authLoading]);

  const rate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  const rings = [
    { value: stats.total, max: Math.max(stats.total, 500), color: "var(--accent)",   label: "Répondues", sublabel: "questions" },
    { value: rate,        max: 100,                         color: "var(--success)",  label: "Précision",  sublabel: `${stats.correct} correctes` },
    { value: stats.streak,max: Math.max(stats.streak, 30),  color: "var(--warning)",  label: "Série",      sublabel: "jours" },
  ];

  return (
    <main className="min-h-screen pb-safe" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 md:pt-8 space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Statistiques</h1>
              <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                Ton avancement en détail
              </p>
            </div>
            {stats.total > 0 && !resetDone && (
              <button
                onClick={() => setResetOpen(true)}
                className="p-2 rounded-xl transition-all"
                style={{ color: "var(--text-muted)" }}
                title="Réinitialiser"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {resetDone && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px]"
                style={{ background: "var(--success-subtle)", color: "var(--success)" }}>
                <Check className="w-3.5 h-3.5" /> Réinitialisé
              </div>
            )}
          </div>
        </motion.div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => <StatCardSkeleton key={i} />)}
          </div>
        )}

        {/* Not logged in */}
        {!loading && !user && (
          <div className="text-center py-12 space-y-3">
            <LogIn className="w-8 h-8 mx-auto" style={{ color: "var(--text-muted)" }} />
            <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
              Connecte-toi pour voir tes stats
            </p>
            <Link href="/auth" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium"
              style={{ background: "var(--accent)", color: "#fff" }}>
              Se connecter
            </Link>
          </div>
        )}

        {!loading && user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            {/* ── Rings row ── */}
            <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="grid grid-cols-3 gap-4">
                {rings.map((r, i) => (
                  <motion.div
                    key={r.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                  >
                    <ProgressRing {...r} />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ── Activity heatmap ── */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                  Activité (12 semaines)
                </h3>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {Object.values(heatmapData).reduce((a, b) => a + b, 0).toLocaleString()} total
                </span>
              </div>
              <ActivityHeatmap data={heatmapData} />
            </div>

            {/* ── Module breakdown ── */}
            {moduleStats.length > 0 && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                  Par module
                </h3>
                <div className="space-y-3">
                  {moduleStats.map((mod, i) => (
                    <motion.div
                      key={mod.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[12px] font-medium truncate flex-1 mr-2" style={{ color: "var(--text-secondary)" }}>
                          {mod.name}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                            {mod.total}q
                          </span>
                          <span
                            className="text-[11px] font-bold tabular-nums"
                            style={{ color: mod.rate >= 70 ? "var(--success)" : mod.rate >= 50 ? "var(--warning)" : "var(--error)" }}
                          >
                            {mod.rate}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background: mod.rate >= 70 ? "var(--success)" : mod.rate >= 50 ? "var(--warning)" : "var(--error)",
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${mod.rate}%` }}
                          transition={{ delay: i * 0.05 + 0.2, duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Empty state ── */}
            {stats.total === 0 && (
              <div className="text-center py-12 space-y-3">
                <BookOpen className="w-8 h-8 mx-auto" style={{ color: "var(--text-muted)" }} />
                <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
                  Commence à répondre aux QCM pour voir tes statistiques.
                </p>
                <Link href="/semestres"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium"
                  style={{ background: "var(--accent)", color: "#fff" }}>
                  Aller aux QCM
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Reset confirm ── */}
        <AnimatePresence>
          {resetOpen && (
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
              style={{ background: "var(--overlay)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
              onClick={() => setResetOpen(false)}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
                className="w-full max-w-sm p-5 rounded-2xl space-y-4"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-strong)" }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--error-subtle)", border: "1px solid var(--error-border)" }}>
                    <AlertTriangle className="w-5 h-5" style={{ color: "var(--error)" }} />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold" style={{ color: "var(--text)" }}>
                      Réinitialiser les stats ?
                    </p>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      Cette action est irréversible.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setResetOpen(false)}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-medium"
                    style={{ background: "var(--surface-alt)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5"
                    style={{ background: "var(--error)", color: "#fff" }}
                  >
                    {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {resetting ? "..." : "Réinitialiser"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
