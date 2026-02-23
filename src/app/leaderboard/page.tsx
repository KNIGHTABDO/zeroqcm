"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, CheckCircle, Loader2, Medal } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

interface LeaderEntry {
  user_id: string;
  display_name: string;
  total: number;
  correct: number;
  rate: number;
  streak: number;
  rank: number;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"score" | "streak">("score");
  const [myRank, setMyRank] = useState<number | null>(null);

  useEffect(() => { loadLeaderboard(); }, []);

  async function loadLeaderboard() {
    setLoading(true);
    // Fetch all user_answers grouped by user (Supabase doesn't have GROUP BY, use RPC or raw aggregation)
    const { data: answers } = await supabase
      .from("user_answers")
      .select("user_id, is_correct, answered_at");

    if (!answers?.length) { setLoading(false); return; }

    // Aggregate client-side
    const byUser = new Map<string, { total: number; correct: number; dates: string[] }>();
    for (const a of answers) {
      const entry = byUser.get(a.user_id) ?? { total: 0, correct: 0, dates: [] };
      entry.total++;
      if (a.is_correct) entry.correct++;
      const day = a.answered_at?.split("T")[0];
      if (day && !entry.dates.includes(day)) entry.dates.push(day);
      byUser.set(a.user_id, entry);
    }

    // Compute streaks
    function computeStreak(dates: string[]): number {
      const sorted = [...new Set(dates)].sort().reverse();
      let streak = 0;
      for (let i = 0; i < sorted.length; i++) {
        const expected = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
        if (sorted[i] === expected) streak++;
        else break;
      }
      return streak;
    }

    // Fetch display names from profiles
    const userIds = Array.from(byUser.keys());
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? []);

    const list: Omit<LeaderEntry, "rank">[] = Array.from(byUser.entries()).map(([uid, stats]) => {
      const p = profileMap.get(uid);
      return {
        user_id: uid,
        display_name: p?.full_name ?? p?.username ?? "Anonyme",
        total: stats.total,
        correct: stats.correct,
        rate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        streak: computeStreak(stats.dates),
      };
    });

    // Sort by score (correct answers) for ranking
    const ranked: LeaderEntry[] = list
      .sort((a, b) => b.correct - a.correct)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    setEntries(ranked);
    if (user) {
      const myEntry = ranked.find(e => e.user_id === user.id);
      setMyRank(myEntry?.rank ?? null);
    }
    setLoading(false);
  }

  const sorted = [...entries].sort((a, b) =>
    tab === "streak" ? b.streak - a.streak || b.correct - a.correct : b.correct - a.correct
  );

  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg)" }}>
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Classement</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {loading ? "Chargement…" : `${entries.length} étudiant${entries.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Trophy size={18} style={{ color: "#FFD700" }} />
          </div>
        </div>

        {/* My rank banner */}
        {!loading && user && myRank && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between px-4 py-3 rounded-2xl border"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>Votre rang</span>
            <span className="text-lg font-bold tabular-nums" style={{ color: "var(--text)" }}>#{myRank}</span>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {([["score", "Réponses correctes", CheckCircle], ["streak", "Série de jours", Flame]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: tab === key ? "var(--text)" : "transparent",
                color: tab === key ? "var(--bg)" : "var(--text-muted)",
              }}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Podium - top 3 */}
        {!loading && sorted.length >= 3 && (
          <div className="flex items-end justify-center gap-3 py-4">
            {[sorted[1], sorted[0], sorted[2]].map((e, i) => {
              const heights = ["h-20", "h-28", "h-16"];
              const podiumRanks = [2, 1, 3];
              const isMe = e.user_id === user?.id;
              return (
                <motion.div key={e.user_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{
                    background: isMe ? "var(--accent)" : "var(--surface-active)",
                    color: isMe ? "var(--bg)" : "var(--text)",
                    border: `2px solid ${medalColors[podiumRanks[i] - 1]}`,
                  }}>
                    {e.display_name.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-[10px] font-medium text-center truncate w-full" style={{ color: "var(--text)" }}>
                    {e.display_name.split(" ")[0]}
                  </p>
                  <div className={`w-full ${heights[i]} rounded-t-xl flex items-center justify-center flex-col gap-0.5`}
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", borderBottom: "none" }}>
                    <Medal size={14} style={{ color: medalColors[podiumRanks[i] - 1] }} />
                    <span className="text-xs font-bold tabular-nums" style={{ color: "var(--text)" }}>
                      {tab === "streak" ? `${e.streak}🔥` : e.correct}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Full list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <Trophy size={40} style={{ color: "var(--border-strong)", margin: "0 auto" }} />
            <p className="text-sm mt-3 font-medium" style={{ color: "var(--text)" }}>Pas encore de données</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Commencez à réviser pour apparaître ici</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((e, i) => {
              const isMe = e.user_id === user?.id;
              const displayRank = i + 1;
              return (
                <motion.div key={e.user_id}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all"
                  style={{
                    background: isMe ? "var(--surface-active)" : "var(--surface)",
                    borderColor: isMe ? "var(--border-strong)" : "var(--border)",
                  }}>
                  <span className="w-6 text-center text-sm font-bold tabular-nums flex-shrink-0"
                    style={{ color: displayRank <= 3 ? medalColors[displayRank - 1] : "var(--text-muted)" }}>
                    {displayRank <= 3 ? ["🥇","🥈","🥉"][displayRank - 1] : displayRank}
                  </span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: isMe ? "var(--accent)" : "var(--surface-active)", color: isMe ? "var(--bg)" : "var(--text)" }}>
                    {e.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                      {e.display_name} {isMe && <span className="text-[10px] font-normal" style={{ color: "var(--text-muted)" }}>• vous</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{e.total} réponses · {e.rate}% réussite</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text)" }}>
                      {tab === "streak" ? `${e.streak}` : e.correct}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {tab === "streak" ? "jours 🔥" : "correct"}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
