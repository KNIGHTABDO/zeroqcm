"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { BookOpen, Brain, BarChart2, Sparkles, ChevronRight, Star, Users, Target, Zap, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

const FEATURES = [
  { icon: Brain, title: "IA explique chaque réponse", desc: "Corrections instantanées avec l'intelligence artificielle. Comprenez, ne mémorisez pas.", color: "blue" },
  { icon: Target, title: "10 697 questions S1", desc: "Tous les examens passés de la FMPC — Normale, Rattrapage, depuis 2013.", color: "emerald" },
  { icon: BarChart2, title: "Statistiques en temps réel", desc: "Taux de réussite par module, série d'étude, questions faibles — visibles en un coup d'œil.", color: "violet" },
  { icon: Zap, title: "Mode examen ultra-rapide", desc: "Interface plein-écran sans distraction. Vos doigts sur les touches, votre cerveau sur les questions.", color: "amber" },
];

const STATS_DISPLAY = [
  { value: "10 697", label: "Questions S1" },
  { value: "240", label: "Sessions d'examen" },
  { value: "100%", label: "Gratuit" },
  { value: "≪0.6s", label: "Temps de chargement" },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>

      {/* Hero */}
      <section className="relative overflow-hidden min-h-[90vh] flex flex-col items-center justify-center px-4 pt-20 pb-16 lg:pt-32">
        {/* BG glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-500/[0.07] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-500/[0.05] rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs text-blue-300 font-medium">S1 FMPC · 10 697 questions disponibles</span>
          </motion.div>

          {/* Title */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              Révisez comme<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
                jamais avant.
              </span>
            </h1>
          </motion.div>

          {/* Sub */}
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="text-base md:text-lg max-w-xl mx-auto leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            La plateforme QCM premium pour les étudiants de la FMPC.
            Interface obsédante, corrections IA, statistiques précises.
          </motion.p>

          {/* CTA */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {user ? (
              <Link href="/semestres/s1_fmpc"
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm shadow-xl shadow-blue-500/20 transition-all">
                Continuer S1 FMPC
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link href="/auth"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm shadow-xl shadow-blue-500/20 transition-all">
                  Commencer gratuitement
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/semestres/s1_fmpc"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border font-semibold text-sm transition-all hover:bg-white/[0.04]"
                  style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                  Voir S1 FMPC
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </motion.div>
        </div>

        {/* Hero Image */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }}
          className="relative mt-12 w-full max-w-2xl mx-auto">
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://drive.google.com/uc?export=view&id=152UVX3jDqkWf88JN9G1OhKGBsf-2bK_Z"
              alt="FMPC QCM hero"
              className="w-full h-48 md:h-72 object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        </motion.div>
      </section>

      {/* Stats strip */}
      <section className="py-10 border-y" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-3xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS_DISPLAY.map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
                className="text-center">
                <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{s.value}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Conçu pour ceux qui veulent vraiment progresser</h2>
            <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>Pas une app de révision de plus. Une arme.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}
                className="rounded-2xl px-5 py-5 space-y-3 border transition-all hover:bg-white/[0.02]"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                  ${f.color === "blue" ? "bg-blue-500/10 border border-blue-500/20" :
                    f.color === "emerald" ? "bg-emerald-500/10 border border-emerald-500/20" :
                    f.color === "violet" ? "bg-violet-500/10 border border-violet-500/20" :
                    "bg-amber-500/10 border border-amber-500/20"}`}>
                  <f.icon className={`w-4 h-4
                    ${f.color === "blue" ? "text-blue-400" :
                      f.color === "emerald" ? "text-emerald-400" :
                      f.color === "violet" ? "text-violet-400" :
                      "text-amber-400"}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{f.title}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="py-16 px-4">
        <div className="max-w-md mx-auto text-center space-y-5">
          <Sparkles className="w-8 h-8 text-blue-400 mx-auto" />
          <h2 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Prêt à changer votre façon de réviser ?</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Gratuit. Sans pub. Pour vous.</p>
          <Link href={user ? "/semestres/s1_fmpc" : "/auth"}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm shadow-xl shadow-blue-500/20 transition-all">
            {user ? "Continuer mes révisions" : "Créer un compte gratuit"}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t text-center" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          © 2026 FMPC QCM · Université Hassan II Casablanca · Fait avec ❤️ pour les étudiants
        </p>
      </footer>
    </main>
  );
}
