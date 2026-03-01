// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Brain, Sun, Moon, Check, LogOut, ChevronDown, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface GhModel {
  id: string;
  name: string;
  publisher: string;
  tier?: string;
  is_default?: boolean;
  is_default?: boolean;
}

function modelLabel(id: string): string {
  return id.replace(/-/g, " ");
}

const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "#10b981", Anthropic: "#d4a27f", Google: "#4285f4",
  Meta: "#0866ff", Mistral: "#ff7000", Microsoft: "#00a4ef",
  Cohere: "#39594D", AI21: "#7c3aed", xAI: "#1da1f2", DeepSeek: "#3b82f6",
};

// ── Confirmation Modal ─────────────────────────────────────────────────────
function ResetConfirmModal({
  open, onClose, onConfirm, loading,
}: { open: boolean; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto rounded-t-3xl border-t border-x p-6 space-y-5"
            style={{ background: "var(--bg)", borderColor: "var(--border)" }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: "var(--border-strong)" }} />

            {/* Icon */}
            <div className="flex flex-col items-center text-center gap-3 pt-1">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--error-subtle)", border: "1px solid var(--error-border)" }}>
                <AlertTriangle className="w-6 h-6" style={{ color: "var(--error)" }} />
              </div>
              <div>
                <h2 className="text-base font-bold mb-1.5" style={{ color: "var(--text)" }}>
                  Réinitialiser les statistiques ?
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Toutes vos réponses, votre progression et votre série de jours seront supprimées
                  de façon <span className="font-semibold" style={{ color: "var(--text)" }}>permanente</span>.
                  Cette action est irréversible.
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2.5 pt-1">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                style={{ background: "var(--error)", color: "white" }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {loading ? "Suppression…" : "Oui, tout supprimer"}
              </motion.button>
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-semibold border transition-all"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "transparent" }}
              >
                Annuler
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();

  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [models, setModels] = useState<GhModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [saved, setSaved] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const s = (profile?.preferences as Record<string, string> | undefined)?.ai_model ?? "gpt-4.1-mini";
    setSelectedModel(s);
  }, [profile]);

  useEffect(() => {
    fetch("/api/gh-models")
      .then(r => r.json())
      .then((data: GhModel[]) => {
        // Admin-curated from ai_models_config — order preserved
        setModels(data);
      })
      .catch(() => setModels([
        { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", publisher: "OpenAI", tier: "standard", is_default: true },
        { id: "gpt-4o", name: "GPT-4o", publisher: "OpenAI", tier: "premium" },
      ] as GhModel[]))
      .finally(() => setLoadingModels(false));
  }, []);

  useEffect(() => {
    if (modelOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({ position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 });
    }
  }, [modelOpen]);

  useEffect(() => {
    if (!modelOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node) || dropdownRef.current?.contains(e.target as Node)) return;
      setModelOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [modelOpen]);

  async function save() {
    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        preferences: { ...(profile?.preferences as Record<string, unknown> | undefined), ai_model: selectedModel },
      });
      await refreshProfile();
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleResetConfirm() {
    if (!user) return;
    setResetting(true);
    await supabase.from("user_answers").delete().eq("user_id", user.id);
    setResetting(false);
    setResetOpen(false);
    setResetDone(true);
    setTimeout(() => setResetDone(false), 3000);
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  const current = models.find(m => m.id === selectedModel) ?? { id: selectedModel, name: modelLabel(selectedModel) };

  return (
    <>
      <ResetConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleResetConfirm}
        loading={resetting}
      />

      <div className="min-h-screen pb-24" style={{ background: "var(--bg)" }}>
        <div className="max-w-lg mx-auto px-4 pt-8 space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Paramètres</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Personnalisez votre expérience</p>
          </div>

          {/* Reset success banner */}
          <AnimatePresence>
            {resetDone && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: "var(--success-subtle)", border: "1px solid var(--success-border)" }}>
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: "var(--success)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--success)" }}>
                  Statistiques réinitialisées avec succès.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── AI Section ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border p-4 space-y-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Brain size={15} style={{ color: "var(--accent)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Intelligence Artificielle</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Modèle</label>
              <button ref={triggerRef} onClick={() => setModelOpen(v => !v)} disabled={loadingModels}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition-all disabled:opacity-50"
                style={{ background: "var(--surface-alt)", borderColor: modelOpen ? "var(--border-strong)" : "var(--border)", color: "var(--text)" }}>
                <span className="flex items-center gap-2">
                  {loadingModels && <Loader2 size={13} className="animate-spin" style={{ color: "var(--text-muted)" }} />}
                  {loadingModels ? "Chargement…" : (current.name || modelLabel(current.id))}
                </span>
                <ChevronDown size={14} style={{ color: "var(--text-muted)", transform: modelOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
              </button>
              {modelOpen && (
                <div ref={dropdownRef} style={{ ...dropdownStyle, background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "12px", overflow: "hidden", boxShadow: "var(--shadow)" }}>
                  {/* Search input */}
                  <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Rechercher un modèle…"
                      value={modelSearch}
                      onChange={e => setModelSearch(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg outline-none"
                      style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)", caretColor: "var(--accent)" }}
                    />
                  </div>
                  {/* Model list */}
                  <div style={{ overflowY: "auto", maxHeight: "220px" }}>
                    {models
                      .filter(m => {
                        if (!modelSearch) return true;
                        const q = modelSearch.toLowerCase();
                        return (m.name || m.id).toLowerCase().includes(q) || (m.publisher ?? "").toLowerCase().includes(q);
                      })
                      .map(m => (
                        <button key={m.id} onClick={() => { setSelectedModel(m.id); setModelOpen(false); setModelSearch(""); }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors"
                          style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text)", background: selectedModel === m.id ? "var(--surface-active)" : "transparent" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-hover)")}
                          onMouseLeave={e => (e.currentTarget.style.background = selectedModel === m.id ? "var(--surface-active)" : "transparent")}>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: PROVIDER_COLORS[m.publisher] ?? "rgba(255,255,255,0.3)" }} />
                              {m.name || modelLabel(m.id)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {m.publisher && (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PROVIDER_COLORS[m.publisher] ?? "rgba(255,255,255,0.3)" }} />
                                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{m.publisher}</span>
                                  {m.tier === "premium" && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc" }}>PRO</span>}
                                  {(m as GhModel & { is_default?: boolean }).is_default && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>défaut</span>}
                                </div>
                              )}
                              {(m as GhModel & { supports_tools?: boolean }).supports_tools && <span className="text-[10px] px-1 rounded" style={{ background: "rgba(99,179,237,0.1)", color: "var(--accent)" }}>tools</span>}
                              {(m as GhModel & { supports_vision?: boolean }).supports_vision && <span className="text-[10px] px-1 rounded" style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7" }}>vision</span>}
                            </div>
                          </div>
                          {selectedModel === m.id && <Check size={13} style={{ color: "var(--accent)" }} />}
                        </button>
                      ))}
                    {models.filter(m => {
                      if (!modelSearch) return true;
                      const q = modelSearch.toLowerCase();
                      return (m.name || m.id).toLowerCase().includes(q) || (m.publisher ?? "").toLowerCase().includes(q);
                    }).length === 0 && (
                      <div className="px-4 py-4 text-xs text-center" style={{ color: "var(--text-muted)" }}>
                        Aucun modèle trouvé
                      </div>
                    )}
                  </div>
                </div>
              )}
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Alimenté par{" "}
                <span style={{ color: "var(--accent)" }}>Copilot API</span>
                {" "}— gratuit, aucune clé requise.
              </p>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={save}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: saved ? "var(--success-subtle)" : "var(--text)", color: saved ? "var(--success)" : "var(--bg)", border: saved ? "1px solid var(--success-border)" : "none" }}>
              {saved ? "✓ Enregistré" : "Enregistrer"}
            </motion.button>
          </motion.div>

          {/* ── Appearance ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-2xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-3">
              {theme === "dark" ? <Moon size={15} style={{ color: "var(--accent)" }} /> : <Sun size={15} style={{ color: "var(--accent)" }} />}
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Apparence</span>
            </div>
            <button onClick={toggle}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition-all"
              style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}>
              <span>{theme === "dark" ? "Mode clair" : "Mode sombre"}</span>
              <div className="relative w-10 h-5 rounded-full transition-colors"
                style={{ background: theme === "dark" ? "var(--accent)" : "var(--surface-active)" }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: theme === "dark" ? "translateX(20px)" : "translateX(2px)" }} />
              </div>
            </button>
          </motion.div>

          {/* ── Données (reset stats) ── */}
          {user && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="rounded-2xl border p-4 space-y-3"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <Trash2 size={15} style={{ color: "var(--text-muted)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Données</span>
              </div>
              <div className="px-1">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Supprimez toutes vos réponses, votre progression et votre série de révision. Cette action est permanente.
                </p>
              </div>
              <button onClick={() => setResetOpen(true)}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all"
                style={{ borderColor: "var(--error-border)", color: "var(--error)", background: "var(--error-subtle)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--error-subtle)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--error)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--error-subtle)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--error-border)"; }}>
                <Trash2 size={14} />
                Réinitialiser les statistiques
              </button>
            </motion.div>
          )}

          {/* ── Account ── */}
          {user && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="rounded-2xl border p-4 space-y-3"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <Settings size={15} style={{ color: "var(--accent)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Compte</span>
              </div>
              <div className="px-1 space-y-0.5">
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{profile?.full_name ?? "Utilisateur"}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email}</p>
              </div>
              <button onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-all hover:border-red-500/30 hover:bg-red-500/5"
                style={{ borderColor: "var(--border)", color: "rgb(239,68,68)" }}>
                <LogOut size={14} />
                Se déconnecter
              </button>
            </motion.div>
          )}

          {!user && (
            <div className="text-center">
              <a href="/auth" className="text-sm underline underline-offset-2" style={{ color: "var(--accent)" }}>
                Créer un compte gratuit
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
