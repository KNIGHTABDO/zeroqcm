"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award, BookOpen, Share2, Download, CheckCircle2,
  Loader2, ArrowLeft, Lock, ChevronRight, Star, Trophy
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Certificate {
  id: string; module_id: number; module_name: string;
  score_pct: number; total_answered: number; earned_at: string;
}
interface ModuleProgress {
  module_id: number; module_name: string;
  pct: number; answered: number; total_q: number;
  has_cert: boolean;
}
const CERT_THRESHOLD = 80; // need ≥80% accuracy to earn cert

// ─── Certificate Card ─────────────────────────────────────────────────────────
function CertCard({ cert, onShare }: { cert: Certificate; onShare: (cert: Certificate) => void }) {
  const date = new Date(cert.earned_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl p-5"
      style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.07) 0%, rgba(99,179,237,0.06) 100%)", border: "1px solid rgba(255,215,0,0.15)" }}>
      {/* Corner decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5"
        style={{ background: "radial-gradient(circle, #FFD700 0%, transparent 70%)" }} />

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.2)" }}>
            <Award size={22} style={{ color: "#FFD700" }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-tight mb-0.5" style={{ color: "var(--text)" }}>
              {cert.module_name}
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{date}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xl font-bold tabular-nums" style={{ color: "#FFD700" }}>{cert.score_pct}%</span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{cert.total_answered} rép.</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,215,0,0.1)" }}>
          <div className="h-full rounded-full" style={{ width: `${cert.score_pct}%`, background: "#FFD700" }} />
        </div>
        <button onClick={() => onShare(cert)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95"
          style={{ background: "rgba(255,215,0,0.12)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)" }}>
          <Share2 size={12} /> Partager
        </button>
      </div>
    </motion.div>
  );
}

// ─── Module Progress Card ─────────────────────────────────────────────────────
function ModuleProgressCard({
  mp, onEarn,
}: {
  mp: ModuleProgress;
  onEarn: (mp: ModuleProgress) => void;
}) {
  const canEarn = mp.pct >= CERT_THRESHOLD && !mp.has_cert;
  const pctWidth = `${Math.min(mp.pct, 100)}%`;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 transition-all"
      style={{ background: "var(--surface)", border: `1px solid ${canEarn ? "var(--success-border)" : "var(--border)"}` }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: mp.has_cert ? "rgba(255,215,0,0.1)" : "var(--surface-alt)", border: `1px solid ${mp.has_cert ? "rgba(255,215,0,0.15)" : "var(--border)"}` }}>
            {mp.has_cert ? <Award size={14} style={{ color: "#FFD700" }} /> : <BookOpen size={14} style={{ color: "var(--text-muted)" }} />}
          </div>
          <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{mp.module_name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-bold tabular-nums"
            style={{ color: mp.pct >= CERT_THRESHOLD ? "var(--success)" : mp.pct >= 50 ? "var(--warning)" : "var(--text-muted)" }}>
            {mp.pct}%
          </span>
          {canEarn && (
            <button onClick={() => onEarn(mp)}
              className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ background: "var(--success-subtle)", color: "var(--success)", border: "1px solid var(--success-border)" }}>
              <Award size={11} /> Obtenir
            </button>
          )}
          {mp.has_cert && <CheckCircle2 size={16} style={{ color: "#FFD700" }} />}
        </div>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
        <motion.div className="h-full rounded-full"
          style={{ background: mp.pct >= CERT_THRESHOLD ? "var(--success)" : mp.pct >= 50 ? "var(--warning)" : "var(--accent)" }}
          initial={{ width: 0 }} animate={{ width: pctWidth }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }} />
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {mp.answered} réponses · {mp.total_q} questions
        </span>
        {!mp.has_cert && mp.pct < CERT_THRESHOLD && (
          <span className="text-[10px] flex items-center gap-0.5" style={{ color: "var(--text-muted)" }}>
            <Lock size={9} /> {CERT_THRESHOLD - mp.pct}% de plus requis
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
function ShareModal({
  cert, userName, onClose,
}: {
  cert: Certificate; userName: string; onClose: () => void;
}) {
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const imageUrl = `/api/og/certificate?module=${encodeURIComponent(cert.module_name)}&score=${cert.score_pct}&name=${encodeURIComponent(userName)}&date=${encodeURIComponent(new Date(cert.earned_at).toLocaleDateString("fr-FR"))}`;

  async function handleCopyLink() {
    setCopying(true);
    const full = `${window.location.origin}${imageUrl}`;
    await navigator.clipboard.writeText(full);
    setTimeout(() => setCopying(false), 2000);
  }

  async function handleDownload() {
    setDownloading(true);
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `certificat-${cert.module_name.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    setDownloading(false);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "var(--overlay)" }} onClick={onClose}>
      <motion.div initial={{ y: 40, scale: 0.97 }} animate={{ y: 0, scale: 1 }}
        exit={{ y: 40, scale: 0.97 }} transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="w-full max-w-sm rounded-3xl p-5 space-y-4"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: "var(--text)" }}>Partager le certificat</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-70"
            style={{ background: "var(--surface)" }}>
            <ArrowLeft size={14} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Preview */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Certificat" className="w-full rounded-2xl"
          style={{ border: "1px solid var(--border)" }} />

        <div className="flex gap-2">
          <button onClick={handleCopyLink}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 border"
            style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}>
            {copying ? <CheckCircle2 size={14} style={{ color: "var(--success)" }} /> : <Share2 size={14} />}
            {copying ? "Copié !" : "Copier le lien"}
          </button>
          <button onClick={handleDownload} disabled={downloading}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {downloading ? "…" : "Télécharger"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CertificatesPage() {
  const { user, profile } = useAuth();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [progress, setProgress] = useState<ModuleProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"certs" | "progress">("certs");
  const [shareTarget, setShareTarget] = useState<Certificate | null>(null);
  const [earning, setEarning] = useState<number | null>(null);

  const userName = profile?.full_name || profile?.username || "Étudiant";

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);

    // Load certs
    const { data: certData } = await supabase
      .from("module_certificates")
      .select("*")
      .eq("user_id", user.id)
      .order("earned_at", { ascending: false });

    setCerts(certData ?? []);

    // Load all modules with user progress
    const { data: modules } = await supabase
      .from("modules")
      .select("id, nom")
      .order("nom")
      .limit(100);

    if (!modules?.length) { setLoading(false); return; }

    // Fetch user answers with module context (join via questions)
    const { data: answers, error: ansErr } = await supabase
      .from("user_answers")
      .select("is_correct, questions(module_id)")
      .eq("user_id", user.id);

    if (ansErr) { setLoading(false); return; }

    // Group by module_id in JS
    const byModule = new Map<number, { correct: number; total: number }>();
    for (const a of (answers ?? [])) {
      const moduleId = (a.questions as { module_id: number } | null)?.module_id;
      if (moduleId == null) continue;
      const cur = byModule.get(moduleId) ?? { correct: 0, total: 0 };
      byModule.set(moduleId, {
        total: cur.total + 1,
        correct: cur.correct + (a.is_correct ? 1 : 0),
      });
    }

    const results: ModuleProgress[] = [];
    for (const mod of modules) {
      const stats = byModule.get(mod.id);
      if (!stats || stats.total === 0) continue;
      const pct = Math.round((stats.correct / stats.total) * 100);
      const hasCert = (certData ?? []).some((c) => c.module_id === mod.id);
      results.push({
        module_id: mod.id,
        module_name: mod.nom,
        pct,
        answered: stats.total,
        total_q: stats.total,
        has_cert: hasCert,
      });
    }

    results.sort((a, b) => b.pct - a.pct);
    setProgress(results);
    setLoading(false);
  }

  async function handleEarnCert(mp: ModuleProgress) {
    if (!user || mp.pct < CERT_THRESHOLD || mp.has_cert) return;
    setEarning(mp.module_id);

    const { data, error } = await supabase.from("module_certificates").insert({
      user_id: user.id,
      module_id: mp.module_id,
      module_name: mp.module_name,
      score_pct: mp.pct,
      total_answered: mp.answered,
    }).select().single();

    setEarning(null);
    if (error || !data) return;

    setCerts((prev) => [data, ...prev]);
    setProgress((prev) => prev.map((p) => p.module_id === mp.module_id ? { ...p, has_cert: true } : p));
    setTab("certs");
    setShareTarget(data);
  }

  const eligibleCount = progress.filter((mp) => mp.pct >= CERT_THRESHOLD && !mp.has_cert).length;

  if (!user) {
    return (
      <main className="min-h-screen pb-24 flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-3 px-6">
          <Award size={36} className="mx-auto" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-muted)" }}>Connectez-vous pour voir vos certificats.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-lg mx-auto px-4 pt-8 lg:pt-10 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Certificats</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {loading ? "Chargement…" : `${certs.length} obtenu${certs.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.2)" }}>
            <Award size={18} style={{ color: "#FFD700" }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {([
            ["certs", "Mes certificats"],
            ["progress", `Progression${eligibleCount > 0 ? ` (${eligibleCount})` : ""}`],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: tab === key ? "var(--text)" : "transparent",
                color: tab === key ? "var(--bg)" : "var(--text-muted)",
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        )}

        {/* Certs tab */}
        {!loading && tab === "certs" && (
          <AnimatePresence>
            {certs.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center py-16 text-center space-y-3">
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <Trophy size={28} style={{ color: "var(--text-muted)" }} />
                </div>
                <p className="font-semibold" style={{ color: "var(--text)" }}>Aucun certificat encore</p>
                <p className="text-sm max-w-xs" style={{ color: "var(--text-muted)" }}>
                  Atteignez {CERT_THRESHOLD}% de réussite dans un module pour obtenir votre certificat.
                </p>
                <button onClick={() => setTab("progress")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 mt-1"
                  style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}>
                  Voir ma progression <ChevronRight size={14} />
                </button>
              </motion.div>
            ) : (
              <div key="list" className="space-y-3">
                {certs.map((cert, i) => (
                  <motion.div key={cert.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}>
                    <CertCard cert={cert} onShare={setShareTarget} />
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        )}

        {/* Progress tab */}
        {!loading && tab === "progress" && (
          <div className="space-y-2.5">
            {progress.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center space-y-2">
                <BookOpen size={28} style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Commencez à répondre à des questions pour voir votre progression.
                </p>
              </div>
            ) : (
              progress.map((mp, i) => (
                <motion.div key={mp.module_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}>
                  <ModuleProgressCard mp={mp}
                    onEarn={async (p) => { await handleEarnCert(p); }}
                  />
                  {earning === mp.module_id && (
                    <div className="flex items-center justify-center gap-2 mt-2 text-xs"
                      style={{ color: "var(--text-muted)" }}>
                      <Loader2 size={12} className="animate-spin" /> Enregistrement…
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {shareTarget && (
          <ShareModal key="share" cert={shareTarget} userName={userName} onClose={() => setShareTarget(null)} />
        )}
      </AnimatePresence>
    </main>
  );
}
