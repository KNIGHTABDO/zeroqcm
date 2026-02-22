"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Stethoscope, ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (mode === "signin") {
      const { error } = await signIn(email, password);
      if (error) setError(error);
      else router.replace("/semestres/s1_fmpc");
    } else {
      if (!name.trim()) { setError("Entrez votre prénom"); setLoading(false); return; }
      const { error } = await signUp(email, password, name);
      if (error) setError(error);
      else router.replace("/semestres/s1_fmpc");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      {/* Back */}
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-sm transition-colors"
        style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
            <Stethoscope className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            {mode === "signin" ? "Connexion" : "Créer un compte"}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>FMPC QCM — Médecine Casablanca</p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border p-6 space-y-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <form onSubmit={handle} className="space-y-3">
            <AnimatePresence>
              {mode === "signup" && (
                <motion.input
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  type="text"
                  placeholder="Votre prénom"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm border focus:outline-none transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "var(--text)" }}
                />
              )}
            </AnimatePresence>
            <input type="email" placeholder="Email universitaire" value={email}
              onChange={(e) => setEmail(e.target.value)} required
              className="w-full rounded-xl px-3.5 py-2.5 text-sm border focus:outline-none transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "var(--text)" }} />
            <div className="relative">
              <input type={showPw ? "text" : "password"} placeholder="Mot de passe" value={password}
                onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="w-full rounded-xl px-3.5 py-2.5 pr-10 text-sm border focus:outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "var(--text)" }} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "var(--text-muted)" }}>
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-400 px-1">{error}</p>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-60 mt-1">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Chargement...
                </span>
              ) : mode === "signin" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
          {mode === "signin" ? "Pas encore de compte ?" : "Déjà inscrit ?"}
          {" "}
          <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
            {mode === "signin" ? "Créer un compte" : "Se connecter"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
