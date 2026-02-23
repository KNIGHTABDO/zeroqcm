"use client";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Settings, Brain, Sun, Moon, Check, LogOut, ChevronDown, Loader2 } from "lucide-react";
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

// Curated list of good chat/text models from GitHub Models
const PREFERRED_ORDER = [
  "gpt-4o",
  "gpt-4o-mini",
  "o3",
  "o3-mini",
  "o4-mini",
  "Meta-Llama-3.3-70B-Instruct",
  "Meta-Llama-3.1-405B-Instruct",
  "Mistral-Large-2",
  "Phi-4",
  "Phi-4-mini",
  "Cohere-Command-R-Plus-08-2024",
];

function isTextModel(m: GhModel) {
  const t = (m.task ?? "").toLowerCase();
  const ty = (m.model_type ?? "").toLowerCase();
  return (
    t.includes("chat") ||
    t.includes("text-generation") ||
    t.includes("text") ||
    ty.includes("chat") ||
    (!t && !ty)
  );
}

function modelLabel(id: string): string {
  return id
    .replace(/-/g, " ")
    .replace(/(\d+)b/i, "$1B")
    .replace(/gpt 4o mini/i, "GPT-4o Mini")
    .replace(/gpt 4o/i, "GPT-4o")
    .replace(/o3 mini/i, "o3-mini")
    .replace(/o4 mini/i, "o4-mini");
}

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();

  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [models, setModels] = useState<GhModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelOpen, setModelOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  // Ref for the trigger button — used to position the dropdown correctly
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // Load saved model preference
  useEffect(() => {
    const saved =
      (profile?.preferences as Record<string, string> | undefined)?.ai_model ??
      localStorage.getItem("fmpc-ai-model") ??
      "gpt-4o-mini";
    setSelectedModel(saved);
  }, [profile]);

  // Fetch available models from GitHub Models via our proxy route
  useEffect(() => {
    fetch("/api/gh-models")
      .then((r) => r.json())
      .then((data: GhModel[]) => {
        const chat = data.filter(isTextModel);
        chat.sort((a, b) => {
          const ai = PREFERRED_ORDER.indexOf(a.id);
          const bi = PREFERRED_ORDER.indexOf(b.id);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return -1;
          if (bi !== -1) return 1;
          return a.id.localeCompare(b.id);
        });
        setModels(chat);
      })
      .catch(() => {
        setModels([
          { id: "gpt-4o-mini", name: "GPT-4o Mini" },
          { id: "gpt-4o", name: "GPT-4o" },
          { id: "o3-mini", name: "o3-mini" },
          { id: "Meta-Llama-3.3-70B-Instruct", name: "Llama 3.3 70B" },
          { id: "Phi-4", name: "Phi-4" },
        ] as GhModel[]);
      })
      .finally(() => setLoadingModels(false));
  }, []);

  // When dropdown opens, calculate the position of the trigger so we can
  // render the panel with `position: fixed` — this escapes all stacking
  // contexts and guarantees it renders on top of everything.
  useEffect(() => {
    if (modelOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  }, [modelOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!modelOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
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
        preferences: {
          ...(profile?.preferences as Record<string, unknown> | undefined),
          ai_model: selectedModel,
        },
      });
      await refreshProfile();
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  const current = models.find((m) => m.id === selectedModel) ?? { id: selectedModel, name: modelLabel(selectedModel) };

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg)" }}>
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            Paramètres
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Personnalisez votre expérience
          </p>
        </div>

        {/* ── AI Section ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-4 space-y-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Brain size={15} style={{ color: "var(--accent)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Intelligence Artificielle
            </span>
          </div>

          {/* Model picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Modèle
            </label>

            {/* Trigger button */}
            <button
              ref={triggerRef}
              onClick={() => setModelOpen((v) => !v)}
              disabled={loadingModels}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition-all disabled:opacity-50"
              style={{
                background: "var(--surface-alt)",
                borderColor: modelOpen ? "var(--border-strong)" : "var(--border)",
                color: "var(--text)",
              }}
            >
              <span className="flex items-center gap-2">
                {loadingModels ? (
                  <Loader2 size={13} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                ) : null}
                {loadingModels ? "Chargement…" : (current.name || modelLabel(current.id))}
              </span>
              <ChevronDown
                size={14}
                style={{
                  color: "var(--text-muted)",
                  transform: modelOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                }}
              />
            </button>

            {/* Dropdown panel — rendered with position:fixed so it escapes all
                stacking contexts. Background uses var(--bg) for full opacity. */}
            {modelOpen && models.length > 0 && (
              <div
                ref={dropdownRef}
                style={{
                  ...dropdownStyle,
                  background: "var(--bg)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "12px",
                  overflow: "hidden",
                  overflowY: "auto",
                  maxHeight: "260px",
                  boxShadow: "var(--shadow)",
                }}
              >
                {models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setModelOpen(false); }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors"
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      color: "var(--text)",
                      background: selectedModel === m.id ? "var(--surface-active)" : "transparent",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = selectedModel === m.id ? "var(--surface-active)" : "transparent")}
                  >
                    <div>
                      <div className="font-medium">{m.name || modelLabel(m.id)}</div>
                      {m.publisher && (
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {m.publisher}
                        </div>
                      )}
                    </div>
                    {selectedModel === m.id && <Check size={13} style={{ color: "var(--accent)" }} />}
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Alimenté par{" "}
              <a
                href="https://github.com/marketplace/models"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
                style={{ color: "var(--accent)" }}
              >
                GitHub Models
              </a>{" "}
              — gratuit, aucune clé requise.
            </p>
          </div>

          {/* Save */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={save}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: saved ? "var(--success-subtle)" : "var(--text)",
              color: saved ? "var(--success)" : "var(--bg)",
              border: saved ? "1px solid var(--success-border)" : "none",
            }}
          >
            {saved ? "✓ Enregistré" : "Enregistrer"}
          </motion.button>
        </motion.div>

        {/* ── Appearance ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            {theme === "dark" ? <Moon size={15} style={{ color: "var(--accent)" }} /> : <Sun size={15} style={{ color: "var(--accent)" }} />}
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Apparence
            </span>
          </div>
          <button
            onClick={toggle}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition-all"
            style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <span>{theme === "dark" ? "Mode sombre" : "Mode clair"}</span>
            <div
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{ background: theme === "dark" ? "var(--accent)" : "var(--surface-active)" }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: theme === "dark" ? "translateX(20px)" : "translateX(2px)" }}
              />
            </div>
          </button>
        </motion.div>

        {/* ── Account ── */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border p-4 space-y-3"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <Settings size={15} style={{ color: "var(--accent)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                Compte
              </span>
            </div>
            <div className="px-1 space-y-0.5">
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                {profile?.full_name ?? "Utilisateur"}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {user.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-all hover:border-red-500/30 hover:bg-red-500/5"
              style={{ borderColor: "var(--border)", color: "rgb(239,68,68)" }}
            >
              <LogOut size={14} />
              Se déconnecter
            </button>
          </motion.div>
        )}

        {!user && (
          <div className="text-center">
            <a
              href="/auth"
              className="text-sm underline underline-offset-2"
              style={{ color: "var(--accent)" }}
            >
              Créer un compte gratuit
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
