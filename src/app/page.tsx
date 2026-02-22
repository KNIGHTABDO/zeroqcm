"use client";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import {
  Brain, Zap, BarChart2, MessageCircle, Shield, Sparkles, ArrowRight, Star,
} from "lucide-react";
import { Marquee } from "@/components/ui/Marquee";
import { useCounter } from "@/hooks/useCounter";

const HERO_IMG = "https://drive.google.com/uc?id=152UVX3jDqkWf88JN9G1OhKGBsf-2bK_Z&export=view";
const STUDY_IMG = "https://drive.google.com/uc?id=1RNvKT0tMRPqPweCMk18sDGT-ncNUn6LG&export=view";
const ANATOMY_IMG = "https://drive.google.com/uc?id=1zahKrj7hM_I2a_wD39cWrOz8FP9iDmrG&export=view";

const FEATURES = [
  {
    icon: Brain, title: "IA intégrée",
    desc: "Explications Gemini & GPT-4 streamées en temps réel après chaque réponse.",
    color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Zap, title: "Multi-facultés",
    desc: "5 facultés marocaines — FMPC, FMPR, FMPM, UM6SS, FMPDF.",
    color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: BarChart2, title: "Stats en direct",
    desc: "Taux de réussite, séries quotidiennes, anneaux de progression animés.",
    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: MessageCircle, title: "Commentaires",
    desc: "Discussions anonymes ou identifiées sous chaque question.",
    color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: Shield, title: "Révision ciblée",
    desc: "Algorithme qui détecte vos points faibles et vous les resoumet.",
    color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20",
  },
  {
    icon: Sparkles, title: "Sans inscription forcée",
    desc: "Accès instantané, pas de vérification e-mail. Créez un compte en 10 s.",
    color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20",
  },
];

function AnimatedCounter({ value, label }: { value: number; label: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const count = useCounter(value, 2200, inView);

  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl font-bold" style={{ color: "var(--text)" }}>
        {count.toLocaleString("fr-FR")}
      </p>
      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
        {/* Background radial glows */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)" }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)" }} />
        </div>

        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border mb-6"
            style={{
              background: "rgba(59,130,246,0.08)",
              borderColor: "rgba(59,130,246,0.2)",
              color: "#60a5fa",
            }}>
            <Star className="w-3 h-3 fill-current" />
            43 985 questions · 5 facultés marocaines
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight max-w-3xl leading-[1.1] mb-5">
          Révisez smarter.<br />
          <span style={{ background: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Progressez plus vite.
          </span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
          className="text-sm sm:text-base max-w-xl mx-auto mb-8 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}>
          La plateforme QCM des étudiants en médecine du Maroc — IA intégrée, révision ciblée, statistiques en temps réel.
        </motion.p>

        {/* CTA buttons */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link href="/semestres/s1_fmpc"
            className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-sm bg-white text-black hover:bg-zinc-100 active:bg-zinc-200 transition-all">
            Commencer S1 FMPC
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link href="/auth"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-sm border transition-all hover:bg-white/[0.06]"
            style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--text)" }}>
            Créer un compte
          </Link>
        </motion.div>

        {/* Hero image — floating brain with glow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.6 }}
          className="relative w-full max-w-sm mx-auto mb-8"
        >
          {/* Glow behind image */}
          <div className="absolute inset-0 rounded-3xl blur-2xl opacity-40"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%)" }} />
          {/* Floating animation wrapper */}
          <motion.div
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_IMG}
              alt="FMPC QCM — Brain"
              className="w-full max-h-72 object-contain mx-auto drop-shadow-2xl"
              style={{ filter: "drop-shadow(0 0 40px rgba(59,130,246,0.4))" }}
            />
          </motion.div>
        </motion.div>

        {/* Stats strip — animated counters */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          className="w-full max-w-lg mx-auto rounded-2xl border px-6 py-5 grid grid-cols-3 divide-x"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.08)",
            divideColor: "rgba(255,255,255,0.06)",
          }}>
          <AnimatedCounter value={43985} label="Questions" />
          <AnimatedCounter value={1038} label="Activités" />
          <AnimatedCounter value={5} label="Facultés" />
        </motion.div>
      </section>

      {/* ── Marquee ──────────────────────────────────────────────── */}
      <section className="py-6 border-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <Marquee />
      </section>

      {/* ── Feature grid ─────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 py-16 lg:py-20">
        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: "var(--text)" }}>Tout ce qu&apos;il vous faut</h2>
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>Conçu pour les étudiants marocains en médecine</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.06 * i }}
              className="rounded-2xl border p-5 space-y-3 hover:bg-white/[0.03] transition-colors"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${f.bg}`}>
                <f.icon className={`w-4.5 h-4.5 ${f.color}`} />
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{f.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Secondary images ─────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 pb-16 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { src: STUDY_IMG, label: "Étudiez efficacement, partout", sub: "Interface optimisée mobile & desktop" },
          { src: ANATOMY_IMG, label: "Anatomie & sciences fondamentales", sub: "5 facultés · 1 038 activités" },
        ].map((img, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.15 * i }}
            className="rounded-2xl overflow-hidden border relative group"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.label}
              className="w-full h-52 object-cover group-hover:scale-[1.03] transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-4">
              <p className="text-sm font-semibold text-white">{img.label}</p>
              <p className="text-xs text-white/60 mt-0.5">{img.sub}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* ── CTA bottom ───────────────────────────────────────────── */}
      <section className="border-t pb-28 pt-16 text-center px-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-md mx-auto space-y-5">
          <h2 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Prêt à commencer ?</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>43 985 questions, accès immédiat, sans vérification e-mail.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth"
              className="px-8 py-3.5 rounded-2xl font-semibold text-sm bg-white text-black hover:bg-zinc-100 transition-all">
              Créer un compte gratuit
            </Link>
            <Link href="/semestres/s1_fmpc"
              className="px-8 py-3.5 rounded-2xl font-semibold text-sm border transition-all hover:bg-white/[0.06]"
              style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--text)" }}>
              Explorer sans compte
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
