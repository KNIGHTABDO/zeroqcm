"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Target, Flame, Clock, TrendingUp, BookOpen, LogIn } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getUserStats } from "@/lib/supabase";
import Link from "next/link";
import { StatCardSkeleton } from "@/components/ui/Skeleton";

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

  const items = [
    { icon: Target, label: "Questions répondues", value: stats.total.toLocaleString(), color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { icon: TrendingUp, label: "Taux de réussite", value: stats.total > 0 ? `${stats.rate}%` : "—", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { icon: Flame, label: "Série active", value: `${stats.streak}j`, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    { icon: Clock, label: "Réponses correctes", value: stats.correct.toLocaleString(), color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  ];

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-5 md:max-w-2xl lg:max-w-3xl">
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
            className="rounded-2xl border p-8 text-center space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <LogIn className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Connectez-vous pour voir vos stats</p>
            <Link href="/auth"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 transition-all">
              Se connecter
            </Link>
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {items.map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i }}
                  className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${s.bg}`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{s.value}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                </motion.div>
              ))}
            </div>
            {stats.total === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                className="rounded-2xl border p-6 text-center space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <BookOpen className="w-8 h-8 mx-auto text-zinc-600" />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Aucune question répondue pour le moment.
                </p>
                <Link href="/semestres/s1_fmpc"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 transition-all">
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
