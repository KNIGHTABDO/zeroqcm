"use client";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Users, CheckCircle, Clock, XCircle, Minus, RefreshCw,
         TrendingUp, BookOpen, MessageSquare, Calendar, X, ChevronRight,
         Activity, Award } from "lucide-react";
import { supabase } from "@/lib/supabase";

const SEM_MAP: Record<number,string> = {1:'S1',2:'S3',3:'S5',4:'S7',5:'S9'};

const STATUS_ICON = {
  approved: { Icon: CheckCircle, color: "#22c55e", label: "Approuvé" },
  pending:  { Icon: Clock,       color: "#fbbf24", label: "En attente" },
  denied:   { Icon: XCircle,     color: "#ef4444", label: "Refusé" },
};

type AdminUser = {
  id: string;
  username: string | null;
  full_name: string | null;
  faculty: string | null;
  annee_etude: number | null;
  created_at: string;
  activation_status: string | null;
  activation_approved_at: string | null;
  total_answers: number;
  correct_answers: number;
  accuracy_rate: number;
  active_days: number;
  quiz_sessions_total: number;
  quiz_sessions_completed: number;
  chat_messages_count: number;
  last_active: string | null;
};

function fmt(d: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", opts ?? { day:"numeric", month:"short", year:"2-digit" });
}
function daysAgo(d: string | null): string {
  if (!d) return "Jamais";
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return "Auj.";
  if (diff === 1) return "Hier";
  return `Il y a ${diff}j`;
}

// ---- Detail Drawer --------------------------------------------------------
function UserDrawer({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const name = user.full_name || user.username || user.id.slice(0,8);
  const sem  = user.annee_etude ? SEM_MAP[user.annee_etude] ?? `A${user.annee_etude}` : "—";
  const cfg  = user.activation_status ? STATUS_ICON[user.activation_status as keyof typeof STATUS_ICON] : null;

  const stats = [
    { label: "Réponses",     value: user.total_answers.toLocaleString() },
    { label: "Correctes",    value: user.correct_answers.toLocaleString() },
    { label: "Réussite",     value: `${user.accuracy_rate}%` },
    { label: "Jours actifs", value: user.active_days.toString() },
    { label: "Sessions",     value: user.quiz_sessions_total.toString() },
    { label: "Terminées",    value: user.quiz_sessions_completed.toString() },
    { label: "Msgs AI",      value: user.chat_messages_count.toString() },
    { label: "Dernière act.", value: daysAgo(user.last_active) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border overflow-hidden"
        style={{ background: "#111", borderColor: "rgba(255,255,255,0.1)", maxHeight: "90dvh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* Drag pill */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>
              {name[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-base" style={{ color: "rgba(255,255,255,0.9)" }}>{name}</p>
              {user.username && user.username !== user.full_name && (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>@{user.username}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="mt-1 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
            <X size={14} />
          </button>
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-1.5 px-5 pb-4">
          {user.faculty && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)" }}>
              <BookOpen size={9} />
              {user.faculty} · {sem}
            </span>
          )}
          {cfg && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: cfg.color }}>
              <cfg.Icon size={9} />{cfg.label}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>
            <Calendar size={9} />Inscrit {fmt(user.created_at)}
          </span>
          {user.activation_approved_at && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>
              <CheckCircle size={9} />Approuvé {fmt(user.activation_approved_at)}
            </span>
          )}
        </div>

        <div className="mx-5 mb-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }} />

        {/* Stats grid */}
        <div className="px-5 pb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>Statistiques</p>
          <div className="grid grid-cols-4 gap-2">
            {stats.map(s => (
              <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-sm font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.85)" }}>{s.value}</p>
                <p className="text-[9px] mt-0.5 leading-tight" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Accuracy bar */}
          {user.total_answers > 0 && (
            <div className="mt-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Taux de réussite</span>
                <span className="text-[10px] tabular-nums" style={{ color: "rgba(255,255,255,0.5)" }}>{user.accuracy_rate}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: user.accuracy_rate >= 70 ? "#22c55e" : user.accuracy_rate >= 50 ? "#fbbf24" : "#ef4444" }}
                  initial={{ width: 0 }} animate={{ width: `${user.accuracy_rate}%` }}
                  transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }} />
              </div>
            </div>
          )}

          {/* Session completion bar */}
          {user.quiz_sessions_total > 0 && (
            <div className="mt-3">
              <div className="flex justify-between mb-1.5">
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Sessions terminées</span>
                <span className="text-[10px] tabular-nums" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {user.quiz_sessions_completed} / {user.quiz_sessions_total}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div className="h-full rounded-full" style={{ background: "#3b82f6" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((user.quiz_sessions_completed/user.quiz_sessions_total)*100)}%` }}
                  transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }} />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---- Main Page ------------------------------------------------------------
export default function UsersPage() {
  const [users,    setUsers]    = useState<AdminUser[]>([]);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_admin_users");
    if (!error && data) setUsers(data as AdminUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = search
    ? users.filter(u =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.username?.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <div className="min-h-screen px-5 py-8 lg:px-8" style={{ background: "#080808" }}>

      {/* Header */}
      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest mb-1"
          style={{ color: "rgba(255,255,255,0.3)" }}>Gestion</p>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Utilisateurs</h1>
          <span className="text-sm tabular-nums" style={{ color: "rgba(255,255,255,0.3)" }}>
            {users.length.toLocaleString()} inscrits
          </span>
        </div>
      </motion.div>

      {/* Search + refresh */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "rgba(255,255,255,0.25)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher nom, username…"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }} />
        </div>
        <button onClick={fetchUsers} disabled={loading}
          className="px-4 rounded-xl transition-all"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block rounded-2xl border overflow-hidden"
        style={{ background: "#111", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {["Utilisateur","Faculté","Statut","Réponses","Réussite","Sessions","Dernière act.",""].map(h => (
            <p key={h} className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.3)" }}>{h}</p>
          ))}
        </div>
        {loading ? (
          [...Array(6)].map((_,i) => (
            <div key={i} className="h-14 border-b animate-pulse"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.04)" }} />
          ))
        ) : filtered.map((u, i) => {
          const name = u.full_name || u.username || u.id.slice(0,8);
          const sem  = u.annee_etude ? SEM_MAP[u.annee_etude] ?? `A${u.annee_etude}` : "—";
          const cfg  = u.activation_status ? STATUS_ICON[u.activation_status as keyof typeof STATUS_ICON] : null;
          return (
            <div key={u.id} onClick={() => setSelected(u)}
              className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-3.5 cursor-pointer transition-all hover:bg-white/[0.03] ${i < filtered.length-1 ? "border-b" : ""}`}
              style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                  {name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: "rgba(255,255,255,0.8)" }}>{name}</p>
                  {u.username && <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.25)" }}>@{u.username}</p>}
                </div>
              </div>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{u.faculty ?? "—"} · {sem}</p>
              <div>
                {cfg ? (
                  <div className="flex items-center gap-1">
                    <cfg.Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                    <span className="text-[11px]" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                ) : <Minus className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.2)" }} />}
              </div>
              <p className="text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.5)" }}>
                {u.total_answers.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", maxWidth: 48 }}>
                  <div className="h-full rounded-full" style={{
                    width: `${u.accuracy_rate}%`,
                    background: u.accuracy_rate >= 70 ? "#22c55e" : u.accuracy_rate >= 50 ? "#fbbf24" : u.total_answers > 0 ? "#ef4444" : "transparent"
                  }} />
                </div>
                <span className="text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.45)" }}>{u.accuracy_rate}%</span>
              </div>
              <p className="text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.4)" }}>
                {u.quiz_sessions_completed}/{u.quiz_sessions_total}
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{daysAgo(u.last_active)}</p>
              <ChevronRight className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.2)" }} />
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <Users className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.1)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Aucun utilisateur trouvé</p>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-2">
        {loading ? (
          [...Array(5)].map((_,i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
          ))
        ) : filtered.map((u, i) => {
          const name = u.full_name || u.username || u.id.slice(0,8);
          const sem  = u.annee_etude ? SEM_MAP[u.annee_etude] ?? `A${u.annee_etude}` : "—";
          const cfg  = u.activation_status ? STATUS_ICON[u.activation_status as keyof typeof STATUS_ICON] : null;
          return (
            <motion.div key={u.id}
              initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              transition={{ delay: Math.min(i*0.03, 0.25) }}
              onClick={() => setSelected(u)}
              className="rounded-2xl border p-4 cursor-pointer transition-all active:scale-[0.98]"
              style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
              {/* Row 1: avatar + name + status */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                  {name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{name}</p>
                    {cfg && <cfg.Icon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {u.faculty ?? "—"} · {sem} · Inscrit {fmt(u.created_at)}
                  </p>
                </div>
              </div>
              {/* Row 2: mini stats */}
              <div className="flex items-center gap-0 mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="flex-1 text-center">
                  <p className="text-sm font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.75)" }}>{u.total_answers.toLocaleString()}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Réponses</p>
                </div>
                <div className="w-px h-6" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="flex-1 text-center">
                  <p className="text-sm font-bold tabular-nums" style={{
                    color: u.accuracy_rate >= 70 ? "#22c55e" : u.accuracy_rate >= 50 ? "#fbbf24" : u.total_answers > 0 ? "#ef4444" : "rgba(255,255,255,0.75)"
                  }}>{u.accuracy_rate}%</p>
                  <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Réussite</p>
                </div>
                <div className="w-px h-6" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="flex-1 text-center">
                  <p className="text-sm font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.75)" }}>{u.quiz_sessions_total}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Sessions</p>
                </div>
                <div className="w-px h-6" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="flex-1 text-center">
                  <p className="text-sm font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.75)" }}>{u.active_days}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Jours act.</p>
                </div>
                <div className="w-px h-6" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="flex-1 text-center">
                  <p className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>{daysAgo(u.last_active)}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Activ.</p>
                </div>
              </div>
            </motion.div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Aucun résultat</p>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && <UserDrawer user={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
