"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Clock, Lock, ArrowRight, RefreshCw, LogOut, Send } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

type ActivationStatus = "loading" | "inactive" | "pending" | "approved" | "denied";

interface ActivationData {
  status: ActivationStatus;
  requested_at: string | null;
  approved_at:  string | null;
}

export default function ActivatePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData]           = useState<ActivationData>({ status: "loading", requested_at: null, approved_at: null });
  const [requesting, setRequesting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0); // seconds remaining

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    const { data: row } = await supabase
      .from("activation_keys")
      .select("status, requested_at, approved_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (row) {
      setData({ status: row.status as ActivationStatus, requested_at: row.requested_at, approved_at: row.approved_at });
    } else {
      setData({ status: "inactive", requested_at: null, approved_at: null });
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/auth"); return; }
    if (user) fetchStatus();
  }, [user, authLoading, fetchStatus, router]);

  // Poll every 10s when pending
  useEffect(() => {
    if (data.status !== "pending") return;
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [data.status, fetchStatus]);

  // Auto-redirect if approved
  useEffect(() => {
    if (data.status === "approved") {
      const timer = setTimeout(() => router.push("/semestres"), 3000);
      return () => clearTimeout(timer);
    }
  }, [data.status, router]);

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  async function handleRequest() {
    setRequesting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/activate/request", {
        method:  "POST",
        headers: { "Authorization": `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erreur inconnue");
      } else {
        setData(prev => ({ ...prev, status: "pending", requested_at: new Date().toISOString() }));
      }
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setRequesting(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || requesting) return;
    setRequesting(true);
    setError(null);
    try {
      // Reset row so the request route treats it as a fresh request
      await supabase.from("activation_keys").delete().eq("user_id", user!.id);
      setData(prev => ({ ...prev, status: "inactive" }));
      // Re-submit
      await handleRequest();
      setResendCooldown(60);
    } catch {
      setError("Erreur lors du renvoi. Réessayez.");
      setRequesting(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const avatar      = (profile?.full_name || profile?.username || user?.email || "?")[0].toUpperCase();
  const displayName = profile?.full_name || profile?.username || user?.email?.split("@")[0] || "Utilisateur";

  const statusConfig = {
    loading:  { color: "rgba(255,255,255,0.2)",  label: "Chargement…", Icon: Clock,        pulse: false },
    inactive: { color: "rgba(255,255,255,0.15)", label: "Non activé",  Icon: Lock,         pulse: false },
    pending:  { color: "rgba(251,191,36,0.9)",   label: "En attente",  Icon: Clock,        pulse: true  },
    approved: { color: "rgba(34,197,94,0.9)",    label: "Activé",      Icon: CheckCircle,  pulse: false },
    denied:   { color: "rgba(239,68,68,0.9)",    label: "Refusé",      Icon: XCircle,      pulse: false },
  };
  const cfg = statusConfig[data.status] || statusConfig.inactive;

  if (authLoading || data.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden"
      style={{ background: "var(--bg)" }}>

      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm space-y-6"
      >
        {/* Logo */}
        <div className="flex justify-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
              <rect width="48" height="48" rx="14" fill="white" />
              <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="black"
                fontSize="22" fontWeight="800" fontFamily="system-ui,-apple-system,sans-serif">Z</text>
            </svg>
          </motion.div>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-3xl border overflow-hidden"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {/* User info */}
          <div className="px-6 pt-6 pb-5 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.08)", color: "var(--text)" }}>
                {avatar}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{displayName}</p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{user?.email}</p>
              </div>
              {/* Status badge */}
              <div className="ml-auto flex-shrink-0">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold relative ${cfg.pulse ? "overflow-visible" : ""}`}
                  style={{ background: `${cfg.color}18`, color: cfg.color.replace("0.9","1").replace("0.15","rgba(255,255,255,0.6)").replace("0.2","rgba(255,255,255,0.4)") }}>
                  {cfg.pulse && (
                    <span className="absolute inset-0 rounded-xl animate-ping opacity-30"
                      style={{ background: cfg.color }} />
                  )}
                  <cfg.Icon className="w-3 h-3 relative z-10" />
                  <span className="relative z-10">{cfg.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status content */}
          <div className="px-6 py-6">
            <AnimatePresence mode="wait">
              {data.status === "inactive" && (
                <motion.div key="inactive" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="space-y-4 text-center">
                  <div className="space-y-1.5">
                    <p className="text-base font-semibold" style={{ color: "var(--text)" }}>
                      Activez votre compte
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      ZeroQCM nécessite une activation manuelle pour garantir l&apos;accès aux étudiants de médecine.
                    </p>
                  </div>
                  {error && (
                    <p className="text-xs py-2 px-3 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                      {error}
                    </p>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleRequest}
                    disabled={requesting}
                    className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                    style={{ background: "var(--text)", color: "var(--bg)" }}>
                    {requesting ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" />Envoi en cours…</>
                    ) : (
                      <>Demander l&apos;activation<ArrowRight className="w-4 h-4" /></>
                    )}
                  </motion.button>
                </motion.div>
              )}

              {data.status === "pending" && (
                <motion.div key="pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="space-y-4 text-center">
                  <div className="flex justify-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center relative"
                      style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                      <span className="absolute inset-0 rounded-2xl animate-ping opacity-20"
                        style={{ background: "rgba(251,191,36,0.5)" }} />
                      <Clock className="w-6 h-6 relative z-10" style={{ color: "#fbbf24" }} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-base font-semibold" style={{ color: "var(--text)" }}>Demande envoyée ✓</p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      En attente d&apos;approbation par l&apos;administrateur.
                    </p>
                    {data.requested_at && (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Envoyée le {new Date(data.requested_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                    Cette page se met à jour automatiquement…
                  </p>
                  {error && (
                    <p className="text-xs py-2 px-3 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                      {error}
                    </p>
                  )}
                  {/* Resend button */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleResend}
                    disabled={requesting || resendCooldown > 0}
                    className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                    style={{ background: "rgba(251,191,36,0.08)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
                    {requesting ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Renvoi en cours…</>
                    ) : resendCooldown > 0 ? (
                      <><Clock className="w-3.5 h-3.5" />Renvoyer ({resendCooldown}s)</>
                    ) : (
                      <><Send className="w-3.5 h-3.5" />Renvoyer la demande</>
                    )}
                  </motion.button>
                </motion.div>
              )}

              {data.status === "approved" && (
                <motion.div key="approved" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="space-y-4 text-center">
                  <div className="flex justify-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <CheckCircle className="w-7 h-7" style={{ color: "#22c55e" }} />
                    </motion.div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-base font-semibold" style={{ color: "var(--text)" }}>Compte activé ✓</p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Bienvenue sur ZeroQCM ! Redirection en cours…
                    </p>
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={() => router.push("/semestres")}
                    className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                    Accéder à ZeroQCM <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              )}

              {data.status === "denied" && (
                <motion.div key="denied" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="space-y-4 text-center">
                  <div className="flex justify-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <XCircle className="w-7 h-7" style={{ color: "#ef4444" }} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-base font-semibold" style={{ color: "var(--text)" }}>Demande refusée</p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Votre demande d&apos;activation a été refusée. Contactez l&apos;administrateur.
                    </p>
                  </div>
                  {error && (
                    <p className="text-xs py-2 px-3 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>{error}</p>
                  )}
                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={handleRequest}
                    disabled={requesting}
                    className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--text)", border: "1px solid var(--border)" }}>
                    {requesting ? <><RefreshCw className="w-4 h-4 animate-spin" />Envoi…</> : <>Renvoyer la demande</>}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Logout button — always visible */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border)", background: "transparent" }}>
            <LogOut className="w-3.5 h-3.5" />
            {loggingOut ? "Déconnexion…" : "Se déconnecter"}
          </motion.button>
        </motion.div>

        {/* Footer note */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-center text-xs" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
          ZeroQCM est réservé aux étudiants en médecine.
        </motion.p>
      </motion.div>
    </div>
  );
}
