"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Trophy, Flame, CheckCircle, Loader2, Medal, Calendar, BookOpen, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

interface LeaderEntry {
  user_id: string;
  display_name: string;
  total: number;
  correct: number;
  rate: number;
  active_days: number;
  faculty: string | null;
  annee_etude: number | null;
  last_active: string | null;
  rank: number;
}

// Intentional semantic rank colors (gold / silver / bronze) — not rainbow styling
const MEDAL_COLORS = ["#D4A017", "#8A9BA8", "#A0714F"] as const;

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "Actif auj.";
  if (diff === 1) return "Actif hier";
  return `Il y a ${diff}j`;
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
    const { data, error } = await supabase.rpc("get_leaderboard");
    if (error || !data?.length) { setLoading(false); return; }
    const ranked: LeaderEntry[] = (data as Omit<LeaderEntry, "rank">[]).map(
      (e, i) => ({ ...e, rank: i + 1 })
    );
    setEntries(ranked);
    if (user) {
      const myEntry = ranked.find(e => e.user_id === user.id);
      setMyRank(myEntry?.rank ?? null);
    }
    setLoading(false);
  }

  const sorted = [...entries].sort((a, b) =>
    tab === "streak" ? b.active_days - a.active_days || b.correct - a.correct : b.correct - a.correct
  );

  return (
    <div className="min-h-screen pb-28" style={{ background: "var(--bg)" }}>
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>Classement</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {loading ? "Chargement…" : `${entries.length} étudiant${entries.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          {/* Trophy icon — decorative, neutral */}
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Trophy size={18} style={{ color: "var(--text-muted)" }} />
          </div>
        </div>

        {/* My rank banner */}
        {!loading && user && myRank && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between px-4 py-3 rounded-2xl border"
            style={{
              background: "var(--surface)",
              borderColor: "var(--accent-border)",
              borderLeftWidth: "3px",
              borderLeftColor: "var(--accent)",
            }}>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Votre rang</span>
            <span className="text-lg font-bold tabular-nums" style={{ color: "var(--accent)" }}>#{myRank}</span>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 p-1 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {([
            ["score", "Réponses correctes", CheckCircle],
            ["streak", "Jours actifs", Flame],
          ] as const).map(([key, label, Icon]) => (
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

        {/* Podium top 3 */}
        {!loading && sorted.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-end justify-center gap-3 pt-2 pb-4"
          >
            {[sorted[1], sorted[0], sorted[2]].map((e, i) => {
              const heights = ["h-20", "h-28", "h-16"];
              const podiumRanks = [2, 1, 3];
              const isMe = e.user_id === user?.id;
              const medalColor = MEDAL_COLORS[podiumRanks[i] - 1];
              return (
                <motion.div
                  key={e.user_id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 flex flex-col items-center gap-1.5"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{
                    background: isMe ? "var(--accent)" : "var(--surface-alt)",
                    color: isMe ? "var(--bg)" : "var(--text)",
                    border: `2px solid ${medalColor}`,
                  }}>
                    {e.display_name.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-[10px] font-semibold text-center truncate w-full" style={{ color: "var(--text)" }}>
                    {e.display_name.split(" ")[0]}
                  </p>
                  {e.faculty && (
                    <p className="text-[9px] text-center truncate w-full" style={{ color: "var(--text-muted)" }}>
                      {e.faculty}{e.annee_etude ? ` S${e.annee_etude}` : ""}
                    </p>
                  )}
                  {/* Podium block */}
                  <div className={`w-full ${heights[i]} rounded-t-xl flex items-center justify-center flex-col gap-0.5`}
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", borderBottom: "none" }}>
                    {/* Medal icon — intentional rank color */}
                    <Medal size={14} style={{ color: medalColor }} />
                    <span className="text-xs font-bold tabular-nums" style={{ color: "var(--text)" }}>
                      {tab === "streak" ? `${e.active_days}` : e.correct}
                    </span>
                    <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                      {tab === "streak" ? "jours" : `${e.rate}%`}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Separator */}
        {!loading && sorted.length >= 3 && (
          <div className="h-px" style={{ background: "var(--border)" }} />
        )}

        {/* Full list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <Trophy size={36} className="mx-auto mb-3" style={{ color: "var(--border-strong)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Pas encore de données</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Commencez à réviser pour apparaître ici</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((e, i) => {
              const isMe = e.user_id === user?.id;
              const displayRank = i + 1;
              const medals = ["🥇", "🥈", "🥉"];
              const rankColor = displayRank <= 3 ? MEDAL_COLORS[displayRank - 1] : "var(--text-muted)";
              return (
                <motion.div
                  key={e.user_id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025, duration: 0.3 }}
                  className="px-4 py-3 rounded-2xl border transition-colors"
                  style={{
                    background: isMe ? "var(--surface-active)" : "var(--surface)",
                    borderColor: isMe ? "var(--border-strong)" : "var(--border)",
                  }}
                >
                  {/* Top row */}
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <span className="w-6 text-center text-sm font-bold tabular-nums flex-shrink-0"
                      style={{ color: rankColor }}>
                      {displayRank <= 3 ? medals[displayRank - 1] : displayRank}
                    </span>
                    {/* Avatar initial */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        background: isMe ? "var(--accent)" : "var(--surface-alt)",
                        color: isMe ? "var(--bg)" : "var(--text)",
                      }}>
                      {e.display_name.charAt(0).toUpperCase()}
                    </div>
                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/profil?id=${e.user_id}`}
                          className="text-sm font-semibold truncate hover:underline decoration-dotted"
                          style={{ color: "var(--text)" }}>
                          {e.display_name}
                        </Link>
                        {isMe && (
                          <span className="text-[10px] font-normal flex-shrink-0" style={{ color: "var(--text-muted)" }}>· vous</span>
                        )}
                      </div>
                      {/* Faculty + last active */}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {(e.faculty || e.annee_etude) && (
                          <span className="text-[10px] flex items-center gap-0.5" style={{ color: "var(--text-muted)" }}>
                            <BookOpen size={9} />
                            {e.faculty ?? ""}{e.faculty && e.annee_etude ? " · " : ""}{e.annee_etude ? `S${e.annee_etude}` : ""}
                          </span>
                        )}
                        {e.last_active && (
                          <span className="text-[10px] flex items-center gap-0.5" style={{ color: "var(--text-muted)" }}>
                            <Calendar size={9} />
                            {daysAgo(e.last_active)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Score */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text)" }}>
                        {tab === "streak" ? e.active_days : e.correct}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {tab === "streak" ? "jours" : "correct"}
                      </p>
                    </div>
                  </div>

                  {/* Stats bar */}
                  <div className="flex items-center gap-3 mt-2.5 pt-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-1 flex-1">
                      <TrendingUp size={10} style={{ color: "var(--text-muted)" }} />
                      <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                        {e.rate}% réussite
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-1">
                      <CheckCircle size={10} style={{ color: "var(--text-muted)" }} />
                      <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                        {e.total} réponses
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-1">
                      <Flame size={10} style={{ color: "var(--text-muted)" }} />
                      <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                        {e.active_days}j actifs
                      </span>
                    </div>
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
