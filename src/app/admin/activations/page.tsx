"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Clock, CheckCircle, XCircle, User, RefreshCw } from "lucide-react";
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
  pending:  { label: "En attente", color: "var(--warning)", bg: "var(--warning-subtle)",  border: "var(--warning-border)",  Icon: Clock },
  approved: { label: "Approuvé",   color: "var(--success)", bg: "var(--success-subtle)",   border: "var(--success-border)",   Icon: CheckCircle },
  denied:   { label: "Refusé",     color: "var(--error)", bg: "var(--error-subtle)",   border: "var(--error-border)",  Icon: XCircle },
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
  // #37: pagination
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(false);
  // #38: bulk actions
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchUsers = useCallback(async (status: string, q: string, p: number = 1, append = false) => {
    if (!append) setLoading(true);
    const headers = await authHeader();
    const PAGE_SIZE = 30;
    const params  = new URLSearchParams({ status, limit: String(PAGE_SIZE), offset: String((p - 1) * PAGE_SIZE) });
    if (q) params.set("search", q);
    const res = await fetch(`/api/admin/users?${params}`, { headers });
    if (res.ok) {
      const data = await res.json();
      const newUsers = data.users ?? [];
      setUsers(prev => append ? [...prev, ...newUsers] : newUsers);
      setHasMore(newUsers.length === PAGE_SIZE);
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
    setPage(1);
    setSelected(new Set());
    fetchCounts();
    fetchUsers(tab, search, 1, false);
  }, [tab, search, fetchUsers, fetchCounts]);

  async function bulkAction(action: "approve" | "deny") {
    if (!selected.size) return;
    setBulkLoading(true);
    const headers = { ...(await authHeader()), "Content-Type": "application/json" };
    await Promise.all(
      [...selected].map(userId =>
        fetch("/api/admin/activate", { method: "POST", headers, body: JSON.stringify({ userId, action }) })
      )
    );
    setSelected(new Set());
    await Promise.all([fetchUsers(tab, search, 1, false), fetchCounts()]);
    setPage(1);
    setBulkLoading(false);
  }

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
    <div className="min-h-screen px-5 py-8 lg:px-8" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest mb-1"
          style={{ color: "var(--text-muted)" }}>Gestion</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Activations</h1>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium flex-shrink-0 transition-all"
            style={{
              background: tab === t.key ? "var(--border)" : "transparent",
              color:      tab === t.key ? "var(--text)"  : "var(--text-muted)",
              border: tab === t.key ? "1px solid var(--border)" : "1px solid transparent",
            }}>
            {t.label}
            {counts[t.key] !== undefined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold tabular-nums"
                style={{
                  background: tab === t.key ? "var(--border)" : "var(--surface-alt)",
                  color:      tab === t.key ? "var(--text-secondary)" : "var(--text-muted)",
                }}>
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
        <button onClick={() => fetchUsers(tab, search)} disabled={loading}
          className="ml-auto p-2 rounded-xl flex-shrink-0 transition-all"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "var(--text-disabled)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email…"
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
          style={{
            background: "var(--surface-alt)",
            border:     "1px solid var(--border)",
            color:      "var(--text)",
          }}
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--surface-alt)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border py-16 text-center"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <User className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-disabled)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucun résultat</p>
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
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

                <div className="flex items-start gap-3">
                  {/* Checkbox for bulk select */}
                  <button
                    onClick={() => setSelected(prev => {
                      const s = new Set(prev);
                      if (s.has(user.id)) s.delete(user.id); else s.add(user.id);
                      return s;
                    })}
                    className="mt-1 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
                    style={{ background: selected.has(user.id) ? "var(--text)" : "var(--border)", border: "1px solid var(--border)" }}>
                    {selected.has(user.id) && <span style={{ color: "var(--bg)", fontSize: "10px", fontWeight: 900 }}>✓</span>}
                  </button>
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "var(--border)", color: "var(--text-secondary)" }}>
                    {name[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{name}</p>
                      {cfg && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                          <cfg.Icon className="w-2.5 h-2.5" />
                          {cfg.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                      {user.email ?? "—"}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-[11px] px-2 py-0.5 rounded-md"
                        style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}>
                        {user.faculty}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md"
                        style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}>
                        {sem}
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--text-disabled)" }}>{date}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {status !== "approved" && (
                    <button onClick={() => handleAction(user.id, "approve")} disabled={!!actionLoading}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                      style={{ background: "var(--success-subtle)", color: "var(--success)", border: "1px solid var(--success-border)" }}>
                      {actionLoading === user.id+"approve" ? "…" : "✓ Approuver"}
                    </button>
                  )}
                  {status !== "denied" && (
                    <button onClick={() => handleAction(user.id, "deny")} disabled={!!actionLoading}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                      style={{ background: "var(--error-subtle)", color: "var(--error)", border: "1px solid var(--error-border)" }}>
                      {actionLoading === user.id+"deny" ? "…" : "✗ Refuser"}
                    </button>
                  )}
                  {status === "approved" && (
                    <button onClick={() => handleAction(user.id, "revoke")} disabled={!!actionLoading}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                      style={{ background: "var(--surface-alt)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      {actionLoading === user.id+"revoke" ? "…" : "Révoquer"}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>

          {/* Load more */}
          {hasMore && (
            <div className="pt-3 pb-2">
              <button
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  fetchUsers(tab, search, nextPage, true);
                }}
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "var(--border)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                Charger plus
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk action toolbar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
            </span>
            <button
              onClick={() => bulkAction("approve")}
              disabled={bulkLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: "var(--success-subtle)", color: "var(--success)", border: "1px solid var(--success-border)" }}>
              {bulkLoading ? "…" : "Approuver"}
            </button>
            <button
              onClick={() => bulkAction("deny")}
              disabled={bulkLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: "var(--error-subtle)", color: "var(--error)", border: "1px solid var(--error-border)" }}>
              {bulkLoading ? "…" : "Refuser"}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ color: "var(--text-muted)" }}>
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}