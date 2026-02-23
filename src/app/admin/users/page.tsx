"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Users, CheckCircle, Clock, XCircle, Minus, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

const SEMESTER_MAP: Record<number, string> = { 1:"S1", 2:"S3", 3:"S5", 4:"S7", 5:"S9" };

type UserRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  faculty: string;
  annee_etude: number;
  created_at: string;
  activation: { status: string } | null;
};

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}` };
}

const STATUS_ICON = {
  approved: { Icon: CheckCircle, color: "#22c55e" },
  pending:  { Icon: Clock,       color: "#fbbf24" },
  denied:   { Icon: XCircle,     color: "#ef4444" },
};

export default function UsersPage() {
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async (q: string) => {
    setLoading(true);
    const headers = await authHeader();
    const params  = new URLSearchParams({ status: "all", limit: "100" });
    if (q) params.set("search", q);
    const res = await fetch(`/api/admin/users?${params}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(search); }, [search, fetchUsers]);

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
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Utilisateurs</h1>
          <span className="text-sm tabular-nums" style={{ color: "rgba(255,255,255,0.3)" }}>
            {total.toLocaleString()} inscrits
          </span>
        </div>
      </motion.div>

      {/* Search + refresh */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "rgba(255,255,255,0.25)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, email, username…"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border:     "1px solid rgba(255,255,255,0.08)",
              color:      "rgba(255,255,255,0.8)",
            }}
          />
        </div>
        <button onClick={() => fetchUsers(search)} disabled={loading}
          className="px-4 rounded-xl transition-all"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table — desktop */}
      <div className="hidden lg:block rounded-2xl border overflow-hidden"
        style={{ background: "#111", borderColor: "rgba(255,255,255,0.08)" }}>
        {/* Header */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {["Utilisateur","Email","Faculté","Semestre","Inscrit","Statut"].map(h => (
            <p key={h} className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.3)" }}>{h}</p>
          ))}
        </div>
        {/* Rows */}
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="h-14 border-b animate-pulse" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.04)" }} />
          ))
        ) : filtered.map((u, i) => {
          const name   = u.full_name || u.username || u.id.slice(0,8);
          const sem    = u.annee_etude ? SEMESTER_MAP[u.annee_etude] : "—";
          const joined = new Date(u.created_at).toLocaleDateString("fr-FR", { day:"numeric", month:"short", year:"2-digit" });
          const status = u.activation?.status;
          const cfg    = status ? STATUS_ICON[status as keyof typeof STATUS_ICON] : null;
          return (
            <div key={u.id}
              className={`grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-4 items-center px-5 py-3.5 ${i < filtered.length-1 ? "border-b" : ""}`}
              style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                  {name[0].toUpperCase()}
                </div>
                <span className="text-sm truncate" style={{ color: "rgba(255,255,255,0.8)" }}>{name}</span>
              </div>
              <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{u.email ?? "—"}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{u.faculty}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{sem}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{joined}</p>
              <div>
                {cfg ? (
                  <div className="flex items-center gap-1.5">
                    <cfg.Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                  </div>
                ) : (
                  <Minus className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.2)" }} />
                )}
              </div>
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

      {/* Cards — mobile */}
      <div className="lg:hidden space-y-2">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
          ))
        ) : filtered.map((u, i) => {
          const name   = u.full_name || u.username || u.id.slice(0,8);
          const sem    = u.annee_etude ? SEMESTER_MAP[u.annee_etude] : "—";
          const status = u.activation?.status;
          const cfg    = status ? STATUS_ICON[status as keyof typeof STATUS_ICON] : null;
          return (
            <motion.div key={u.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.25) }}
              className="rounded-2xl border p-4 flex items-center gap-3"
              style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                {name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{name}</p>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{u.email ?? "—"}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{u.faculty} · {sem}</p>
              </div>
              {cfg && <cfg.Icon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />}
            </motion.div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Aucun résultat</p>
          </div>
        )}
      </div>
    </div>
  );
}