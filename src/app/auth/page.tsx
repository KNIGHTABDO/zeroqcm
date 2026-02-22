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
  const [faculty, setFaculty] = useState("FMPC");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const FACULTY_SEM: Record<string, string> = {
    FMPC: "s1", FMPR: "S1_FMPR", FMPM: "S1_FMPM", UM6SS: "S1_UM6", FMPDF: "s1_FMPDF",
  };

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (mode === "signin") {
      const { error: err } = await signIn(email, password);
      if (err) { setError(err); setLoading(false); }
      else router.replace("/semestres/s1");
    } else {
      if (!name.trim()) { setError("Entrez votre prénom"); setLoading(false); return; }
      const { error: err } = await signUp(email, password, name, faculty);
      if (err) { setError(err); setLoading(false); }
      else router.replace(`/semestres/${FACULTY_SEM[faculty] ?? "s1"}`);
    }
  }

  const inputCls = "w-full px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-colors";
  const inputStyle = { background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-sm transition-colors"
        style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
            <Stethoscope className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            {mode === "signin" ? "Connexion" : "Créer un compte"}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>ZeroQCM — Médecine Maroc</p>
        </div>

        <div className="rounded-2xl border p-6 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <form onSubmit={handle} className="space-y-3">
            <AnimatePresence>
              {mode === "signup" && (
                <motion.div key="signup-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                  <input type="text" placeholder="Votre prénom" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} style={inputStyle} required />
                  <select value={faculty} onChange={(e) => setFaculty(e.target.value)} className={inputCls} style={inputStyle}>
                    <option value="FMPC">FMPC — Casablanca</option>
                    <option value="FMPR">FMPR — Rabat</option>
                    <option value="FMPM">FMPM — Marrakech</option>
                    <option value="UM6SS">UM6SS — UM6</option>
                    <option value="FMPDF">FMPDF — Fès</option>
                  </select>
                </motion.div>
              )}
            </AnimatePresence>

            <input type="email" placeholder="Adresse email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} style={inputStyle} required />

            <div className="relative">
              <input type={showPw ? "text" : "password"} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls + " pr-11"} style={inputStyle} required minLength={6} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 disabled:opacity-50 transition-all">
              {loading ? "..." : mode === "signin" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>

          <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            {mode === "signin" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
            <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
              className="text-blue-400 hover:underline font-medium">
              {mode === "signin" ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
