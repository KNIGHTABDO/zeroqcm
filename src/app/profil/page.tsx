"use client";
import { useAuth } from "@/components/auth/AuthProvider";
import { motion } from "framer-motion";
import { User, LogIn, BookOpen, Target, Flame } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth();

  if (!user) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="text-center space-y-4">
        <User className="w-10 h-10 mx-auto text-zinc-600" />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Connectez-vous pour accéder à votre profil</p>
        <Link href="/auth" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 transition-all">
          <LogIn className="w-4 h-4" /> Se connecter
        </Link>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-6 text-center space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
            <span className="text-2xl font-bold text-blue-400">
              {(profile?.full_name ?? user.email ?? "?")[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: "var(--text)" }}>{profile?.full_name ?? "Étudiant FMPC"}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email}</p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
              {profile?.faculty ?? "FMPC"}
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
              S{profile?.annee_etude ?? 1}
            </span>
          </div>
        </motion.div>

        <Link href="/settings"
          className="flex items-center justify-between w-full px-5 py-4 rounded-2xl border transition-all hover:bg-white/[0.04]"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Paramètres & IA</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>→</span>
        </Link>

        <button onClick={signOut}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
          Se déconnecter
        </button>
      </div>
    </main>
  );
}
