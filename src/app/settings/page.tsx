"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Key, Brain, Sun, Moon, Globe, ChevronRight, Check, Eye, EyeOff, LogOut, Sparkles } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", sub: "Rapide · Gratuit", tag: "RECOMMANDÉ" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", sub: "Plus précis", tag: "" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", sub: "Meilleur · Payant", tag: "" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", sub: "OpenAI · Rapide", tag: "" },
  { id: "gpt-4o", label: "GPT-4o", sub: "OpenAI · Premium", tag: "" },
];

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [aiKey, setAiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [saved, setSaved] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  useEffect(() => {
    if (profile?.preferences) {
      setAiKey(profile.preferences.ai_key ?? "");
      setSelectedModel(profile.preferences.ai_model ?? "gemini-2.0-flash");
    } else {
      // Load from localStorage for non-logged users
      setAiKey(localStorage.getItem("fmpc-ai-key") ?? "");
      setSelectedModel(localStorage.getItem("fmpc-ai-model") ?? "gemini-2.0-flash");
    }
  }, [profile]);

  async function save() {
    localStorage.setItem("fmpc-ai-key", aiKey);
    localStorage.setItem("fmpc-ai-model", selectedModel);
    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        preferences: { ...profile?.preferences, ai_key: aiKey, ai_model: selectedModel },
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

  const currentModel = MODELS.find((m) => m.id === selectedModel) ?? MODELS[0];

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-5 md:max-w-2xl">

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold">Paramètres</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Personnalisez votre expérience</p>
        </motion.div>

        {/* AI Settings */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <Brain className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Intelligence Artificielle</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Clé API + modèle pour les explications</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Model selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Modèle</label>
              <button onClick={() => setModelOpen(!modelOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition-all hover:border-white/20"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "var(--text)" }}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>{currentModel.label}</span>
                  {currentModel.tag && (
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-lg">
                      {currentModel.tag}
                    </span>
                  )}
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform ${modelOpen ? "rotate-90" : ""}`}
                  style={{ color: "var(--text-muted)" }} />
              </button>
              {modelOpen && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  {MODELS.map((m) => (
                    <button key={m.id} onClick={() => { setSelectedModel(m.id); setModelOpen(false); }}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm border-b last:border-0 transition-all hover:bg-white/[0.04]"
                      style={{ borderColor: "rgba(255,255,255,0.04)", color: "var(--text)" }}>
                      <div className="text-left">
                        <p className="text-sm">{m.label}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{m.sub}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.tag && <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">{m.tag}</span>}
                        {selectedModel === m.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Clé API (optionnelle)</label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={aiKey}
                  onChange={(e) => setAiKey(e.target.value)}
                  placeholder="sk-... ou AIza..."
                  className="w-full rounded-xl px-3.5 py-2.5 pr-10 text-sm border focus:outline-none transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "var(--text)" }}
                />
                <button onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <p className="text-xs text-blue-400/90">Sans clé: modèle par défaut gratuit. Avec clé: votre quota personnel.</p>
              </div>
            </div>

            <button onClick={save}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${saved ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white text-black hover:bg-zinc-100"}`}>
              {saved ? "✓ Enregistré" : "Enregistrer"}
            </button>
          </div>
        </motion.div>

        {/* Appearance */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <Sun className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Apparence</p>
          </div>
          <button onClick={toggle}
            className="w-full flex items-center justify-between px-5 py-4 transition-all hover:bg-white/[0.04]">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="w-4 h-4 text-zinc-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
              <div className="text-left">
                <p className="text-sm" style={{ color: "var(--text)" }}>{theme === "dark" ? "Mode sombre" : "Mode clair"}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Basculer le thème</p>
              </div>
            </div>
            <div className={`w-10 h-5.5 rounded-full relative transition-all ${theme === "dark" ? "bg-blue-500" : "bg-zinc-300"}`}
              style={{ width: "42px", height: "24px" }}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${theme === "dark" ? "left-5" : "left-0.5"}`} />
            </div>
          </button>
        </motion.div>

        {/* Account */}
        {user && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <Settings className="w-4 h-4 text-zinc-400" />
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Compte</p>
            </div>
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text)" }}>{profile?.full_name ?? "Utilisateur"}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{user.email}</p>
            </div>
            <button onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-5 py-4 text-sm text-red-400 hover:bg-red-500/5 transition-all">
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </button>
          </motion.div>
        )}

        {!user && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <a href="/auth"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition-all">
              Créer un compte gratuit
            </a>
          </motion.div>
        )}
      </div>
    </main>
  );
}
