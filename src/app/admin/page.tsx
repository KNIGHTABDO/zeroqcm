"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Clock, CheckCircle, XCircle, BookOpen, Activity, ChevronRight } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Stats {
  users:    { total: number; pending: number; approved: number; denied: number };
  platform: { questions: number; answers: number };
  recent:   Array<{
    user_id: string; status: string; requested_at: string;
    profile: { full_name: string | null; username: string | null; faculty: string; annee_etude: number } | null;
  }>;
}

const SEMESTER_MAP: Record<number, string> = { 1:"S1", 2:"S3", 3:"S5", 4:"S7", 5:"S9" };

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}` };
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(value / 30);
    const t = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplayed(start);
      if (start >= value) clearInterval(t);
    }, 20);
    return () => clearInterval(t);
  }, [value]);
  return <>{displayed.toLocaleString()}</>;
}

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 border relative overflow-hidden"
      style={{ background: "#111", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ background: `radial-gradient(circle at 80% 20%, ${color}, transparent 60%)` }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
            {label}
          </p>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `${color}14`, border: `1px solid ${color}22` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </div>
        <p className="text-3xl font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.95)" }}>
          <AnimatedNumber value={value} />
        </p>
        {sub && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

export default function AdminPage() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    const headers = await authHeader();
    const res = await fetch("/api/admin/stats", { headers });
    if (res.ok) setStats(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  async function handleAction(userId: string, action: "approve" | "deny") {
    setActionLoading(userId + action);
    const headers = { ...(await authHeader()), "Content-Type": "application/json" };
    await fetch("/api/admin/activate", { method: "POST", headers, body: JSON.stringify({ userId, action }) });
    await fetchStats();
    setActionLoading(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#080808" }}>
        <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
      </div>
    );
  }

  const s = stats;

  return (
    <div className="min-h-screen px-5 py-8 lg:px-8" style={{ background: "#080808" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest mb-1"
          style={{ color: "rgba(255,255,255,0.3)" }}>Vue d&apos;ensemble</p>
        <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>
          Tableau de bord
        </h1>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
        <StatCard label="En attente"    value={s?.users.pending  ?? 0} icon={Clock}         color="#fbbf24" sub="demandes actives" />
        <StatCard label="Approuvés"     value={s?.users.approved ?? 0} icon={CheckCircle}   color="#22c55e" sub="comptes actifs" />
        <StatCard label="Refusés"       value={s?.users.denied   ?? 0} icon={XCircle}       color="#ef4444" sub="demandes" />
        <StatCard label="Utilisateurs"  value={s?.users.total    ?? 0} icon={Users}         color="#60a5fa" sub="inscrits" />
        <StatCard label="Questions"     value={s?.platform.questions ?? 0} icon={BookOpen}  color="#a78bfa" sub="dans la base" />
        <StatCard label="Réponses"      value={s?.platform.answers   ?? 0} icon={Activity}  color="#34d399" sub="soumises" />
      </div>

      {/* Recent pending activations */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
            Demandes en attente
          </h2>
          <Link href="/admin/activations"
            className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.35)" }}>
            Voir tout <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {!s?.recent.length ? (
          <div className="rounded-2xl border py-12 text-center"
            style={{ background: "#111", borderColor: "rgba(255,255,255,0.06)" }}>
            <CheckCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(34,197,94,0.4)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Aucune demande en attente</p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: "#111", borderColor: "rgba(255,255,255,0.08)" }}>
            {s.recent.map((req, i) => {
              const name    = req.profile?.full_name || req.profile?.username || req.user_id.slice(0,8);
              const faculty = req.profile?.faculty ?? "—";
              const sem     = req.profile?.annee_etude ? SEMESTER_MAP[req.profile.annee_etude] : "—";
              const date    = req.requested_at
                ? new Date(req.requested_at).toLocaleDateString("fr-FR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })
                : "—";
              const loadingApprove = actionLoading === req.user_id + "approve";
              const loadingDeny    = actionLoading === req.user_id + "deny";
              return (
                <div key={req.user_id}
                  className={`flex items-center gap-3 px-5 py-4 ${i < s.recent.length - 1 ? "border-b" : ""}`}
                  style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
                    {name[0].toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{name}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {faculty} · {sem} · {date}
                    </p>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleAction(req.user_id, "approve")} disabled={!!actionLoading}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                      {loadingApprove ? "…" : "Approuver"}
                    </button>
                    <button onClick={() => handleAction(req.user_id, "deny")} disabled={!!actionLoading}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>
                      {loadingDeny ? "…" : "Refuser"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}