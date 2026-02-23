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
  description?: string;
  publisher?: string;
  model_type?: string;
  task?: string;
}

const PREFERRED_ORDER = [
  "gpt-4o", "gpt-4o-mini", "o3", "o3-mini", "o4-mini",
  "Meta-Llama-3.3-70B-Instruct", "Meta-Llama-3.1-405B-Instruct",
  "Mistral-Large-2", "Phi-4", "Phi-4-mini", "Cohere-Command-R-Plus-08-2024",
];

function isTextModel(m: GhModel) {
  const t = (m.task ?? "").toLowerCase();
  const ty = (m.model_type ?? "").toLowerCase();
  return t.includes("chat") || t.includes("text-generation") || t.includes("text") || ty.includes("chat") || (!t && !ty);
}

function modelLabel(id: string): string {
  return id.replace(/-/g, " ").replace(/(\d+)b/i, "$1B").replace(/gpt 4o mini/i, "GPT-4o Mini")
    .replace(/gpt 4o/i, "GPT-4o").replace(/o3 mini/i, "o3-mini").replace(/o4 mini/i, "o4-mini");
}

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
  const [saved, setSaved] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const s = (profile?.preferences as Record<string, string> | undefined)?.ai_model ??
      localStorage.getItem("fmpc-ai-model") ?? "gpt-4o-mini";
    setSelectedModel(s);
  }, [profile]);

  useEffect(() => {
    fetch("/api/gh-models")
      .then(r => r.json())
      .then((data: GhModel[]) => {
        const chat = data.filter(isTextModel);
        chat.sort((a, b) => {
          const ai = PREFERRED_ORDER.indexOf(a.id), bi = PREFERRED_ORDER.indexOf(b.id);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return -1; if (bi !== -1) return 1;
          return a.id.localeCompare(b.id);
        });
        setModels(chat);
      })
      .catch(() => setModels([
        { id: "gpt-4o-mini", name: "GPT-4o Mini" }, { id: "gpt-4o", name: "GPT-4o" },
        { id: "o3-mini", name: "o3-mini" }, { id: "Meta-Llama-3.3-70B-Instruct", name: "Llama 3.3 70B" },
        { id: "Phi-4", name: "Phi-4" },
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
    localStorage.setItem("fmpc-ai-model", selectedModel);
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
              {modelOpen && models.length > 0 && (
                <div ref={dropdownRef} style={{ ...dropdownStyle, background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "12px", overflow: "hidden", overflowY: "auto", maxHeight: "260px", boxShadow: "var(--shadow)" }}>
                  {models.map(m => (
                    <button key={m.id} onClick={() => { setSelectedModel(m.id); setModelOpen(false); }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors"
                      style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text)", background: selectedModel === m.id ? "var(--surface-active)" : "transparent" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-hover)")}
                      onMouseLeave={e => (e.currentTarget.style.background = selectedModel === m.id ? "var(--surface-active)" : "transparent")}>
                      <div>
                        <div className="font-medium">{m.name || modelLabel(m.id)}</div>
                        {m.publisher && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{m.publisher}</div>}
                      </div>
                      {selectedModel === m.id && <Check size={13} style={{ color: "var(--accent)" }} />}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Alimenté par{" "}
                <a href="https://github.com/marketplace/models" target="_blank" rel="noopener noreferrer"
                  className="underline underline-offset-2" style={{ color: "var(--accent)" }}>GitHub Models</a>
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
              <span>{theme === "dark" ? "Mode sombre" : "Mode clair"}</span>
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
