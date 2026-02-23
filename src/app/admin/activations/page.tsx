"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Clock, CheckCircle, XCircle, User, RefreshCw, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";

const SEMESTER_MAP: Record<number, string> = { 1:"S1", 2:"S3", 3:"S5", 4:"S7", 5:"S9" };

type ActivationUser = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  faculty: string;
  annee_etude: number;
  created_at: string;
  activation: { status: string; requested_at: string | null; approved_at: string | null; updated_at: string } | null;
};

const STATUS_CFG = {
  pending:  { label: "En attente", color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)",  Icon: Clock },
  approved: { label: "Approuvé",   color: "#22c55e", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.2)",   Icon: CheckCircle },
  denied:   { label: "Refusé",     color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.15)",  Icon: XCircle },
};

const TABS = [
  { key: "pending",  label: "En attente" },
  { key: "approved", label: "Approuvés" },
  { key: "denied",   label: "Refusés" },
  { key: "all",      label: "Tous" },
] as const;

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}` };
}

export default function ActivationsPage() {
  const [users, setUsers]       = useState<ActivationUser[]>([]);
  const [counts, setCounts]     = useState<Record<string,number>>({});
  const [tab, setTab]           = useState<"pending"|"approved"|"denied"|"all">("pending");
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchUsers = useCallback(async (status: string, q: string) => {
    setLoading(true);
    const headers = await authHeader();
    const params  = new URLSearchParams({ status, limit: "100" });
    if (q) params.set("search", q);
    const res = await fetch(`/api/admin/users?${params}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
    }
    setLoading(false);
  }, []);

  const fetchCounts = useCallback(async () => {
    const headers = await authHeader();
    const res = await fetch("/api/admin/stats", { headers });
    if (res.ok) {
      const d = await res.json();
      setCounts({
        pending:  d.users.pending,
        approved: d.users.approved,
        denied:   d.users.denied,
        all:      d.users.total,
      });
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    fetchUsers(tab, search);
  }, [tab, search, fetchUsers, fetchCounts]);

  async function handleAction(userId: string, action: "approve" | "deny" | "revoke") {
    setActionLoading(userId + action);
    const headers = { ...(await authHeader()), "Content-Type": "application/json" };
    await fetch("/api/admin/activate", { method: "POST", headers, body: JSON.stringify({ userId, action }) });
    await Promise.all([fetchUsers(tab, search), fetchCounts()]);
    setActionLoading(null);
  }

  const filtered = search
    ? users.filter(u =>
        (u.full_name?.toLowerCase().includes(search.toLowerCase())) ||
        (u.username?.toLowerCase().includes(search.toLowerCase()))  ||
        (u.email?.toLowerCase().includes(search.toLowerCase()))
      )
    : users;

  return (
    <div className="min-h-screen px-5 py-8 lg:px-8" style={{ background: "#080808" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest mb-1"
          style={{ color: "rgba(255,255,255,0.3)" }}>Gestion</p>
        <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Activations</h1>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium flex-shrink-0 transition-all"
            style={{
              background: tab === t.key ? "rgba(255,255,255,0.08)" : "transparent",
              color:      tab === t.key ? "rgba(255,255,255,0.9)"  : "rgba(255,255,255,0.38)",
              border: tab === t.key ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
            }}>
            {t.label}
            {counts[t.key] !== undefined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold tabular-nums"
                style={{
                  background: tab === t.key ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
                  color:      tab === t.key ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
                }}>
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
        <button onClick={() => fetchUsers(tab, search)} disabled={loading}
          className="ml-auto p-2 rounded-xl flex-shrink-0 transition-all"
          style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "rgba(255,255,255,0.25)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email…"
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            border:     "1px solid rgba(255,255,255,0.08)",
            color:      "rgba(255,255,255,0.8)",
          }}
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border py-16 text-center"
          style={{ background: "#111", borderColor: "rgba(255,255,255,0.06)" }}>
          <User className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Aucun résultat</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
          {filtered.map((user, i) => {
            const status  = user.activation?.status ?? "none";
            const cfg     = STATUS_CFG[status as keyof typeof STATUS_CFG];
            const name    = user.full_name || user.username || user.id.slice(0,8);
            const sem     = user.annee_etude ? SEMESTER_MAP[user.annee_etude] : "—";
            const date    = user.activation?.requested_at
              ? new Date(user.activation.requested_at).toLocaleDateString("fr-FR",
                  { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
              : "Pas de demande";

            return (
              <motion.div key={user.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="rounded-2xl border p-4 lg:p-5 transition-all"
                style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>

                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
                    {name[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>{name}</p>
                      {cfg && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                          <cfg.Icon className="w-2.5 h-2.5" />
                          {cfg.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {user.email ?? "—"}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-[11px] px-2 py-0.5 rounded-md"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                        {user.faculty}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                        {sem}
                      </span>
                      <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>{date}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {status !== "approved" && (
                    <button onClick={() => handleAction(user.id, "approve")} disabled={!!actionLoading}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                      style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                      {actionLoading === user.id+"approve" ? "…" : "✓ Approuver"}
                    </button>
                  )}
                  {status !== "denied" && (
                    <button onClick={() => handleAction(user.id, "deny")} disabled={!!actionLoading}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                      style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>
                      {actionLoading === user.id+"deny" ? "…" : "✗ Refuser"}
                    </button>
                  )}
                  {status === "approved" && (
                    <button onClick={() => handleAction(user.id, "revoke")} disabled={!!actionLoading}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {actionLoading === user.id+"revoke" ? "…" : "Révoquer"}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}