"use client";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import {
  Brain, Zap, BarChart2, MessageCircle, Shield, Sparkles, ArrowRight, Star,
} from "lucide-react";
import { Marquee } from "@/components/ui/Marquee";
import { useCounter } from "@/hooks/useCounter";

const HERO_IMG = "https://lh3.googleusercontent.com/d/152UVX3jDqkWf88JN9G1OhKGBsf-2bK_Z";
const STUDY_IMG = "https://lh3.googleusercontent.com/d/1RNvKT0tMRPqPweCMk18sDGT-ncNUn6LG";
const ANATOMY_IMG = "https://lh3.googleusercontent.com/d/1zahKrj7hM_I2a_wD39cWrOz8FP9iDmrG";

const FEATURES = [
  {
    icon: Brain, title: "IA intégrée",
    desc: "Explications Gemini & GPT-4 streamées après chaque réponse.",
    color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Zap, title: "Multi-facultés",
    desc: "5 facultés marocaines — FMPC, FMPR, FMPM, UM6SS, FMPDF.",
    color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: BarChart2, title: "Stats en direct",
    desc: "Taux de réussite, séries quotidiennes, anneaux animés.",
    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: MessageCircle, title: "Commentaires",
    desc: "Discussions anonymes ou identifiées sous chaque question.",
    color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: Shield, title: "Révision ciblée",
    desc: "Détecte vos points faibles et vous les resoumet.",
    color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20",
  },
  {
    icon: Sparkles, title: "Sans blocage",
    desc: "Accès instantané, compte en 10 s, pas de vérification e-mail.",
    color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20",
  },
];

function AnimatedCounter({ value, label }: { value: number; label: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const count = useCounter(value, 2200, inView);
  return (
    <div ref={ref} className="text-center">
      <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>
        {count.toLocaleString("fr-FR")}
      </p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden w-full px-4 pt-10 pb-6 text-center">
        {/* Subtle glow — contained, won't cause blank space */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)" }} />

        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border mb-4"
            style={{ background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.2)", color: "#60a5fa" }}>
            <Star className="w-2.5 h-2.5 fill-current" />
            43 985 questions · 5 facultés
          </span>
        </motion.div>

        {/* Hero image — compact, above the fold */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="relative mx-auto mb-4 w-36 h-36 sm:w-48 sm:h-48"
        >
          <div className="absolute inset-0 rounded-full blur-2xl opacity-50"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.6) 0%, transparent 70%)" }} />
          <motion.img
            src={HERO_IMG} alt="FMPC QCM"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10 w-full h-full object-contain drop-shadow-2xl"
            style={{ filter: "drop-shadow(0 0 28px rgba(59,130,246,0.45))" }}
          />
        </motion.div>

        {/* Title */}
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
          className="text-[26px] sm:text-4xl font-extrabold tracking-tight leading-[1.15] mb-3">
          Révisez smarter.<br />
          <span style={{ background: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Progressez plus vite.
          </span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="text-sm max-w-xs mx-auto mb-5 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}>
          La plateforme QCM des étudiants en médecine du Maroc — IA, révision ciblée, stats.
        </motion.p>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
          className="flex flex-col sm:flex-row gap-2.5 justify-center mb-6">
          <Link href="/semestres"
            className="group inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-white text-black hover:bg-zinc-100 transition-all">
            Commencer maintenant
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link href="/auth"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm border transition-all hover:bg-white/[0.06]"
            style={{ borderColor: "rgba(255,255,255,0.14)", color: "var(--text)" }}>
            Créer un compte
          </Link>
        </motion.div>

        {/* Stats strip */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}
          className="rounded-2xl border grid grid-cols-3 divide-x px-2 py-4"
          style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
          <AnimatedCounter value={43985} label="Questions" />
          <AnimatedCounter value={1038} label="Activités" />
          <AnimatedCounter value={5} label="Facultés" />
        </motion.div>
      </section>

      {/* ── Marquee ── */}
      <section className="py-4 border-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <Marquee />
      </section>

      {/* ── Features ── */}
      <section className="px-4 py-8">
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">Tout ce qu&apos;il vous faut</h2>
          <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}>Conçu pour les étudiants marocains en médecine</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.05 * i }}
              className={`rounded-2xl border p-4 space-y-2 ${f.bg}`}>
              <f.icon className={`w-4 h-4 ${f.color}`} />
              <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{f.title}</p>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── AI images ── */}
      <section className="px-4 pb-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { src: STUDY_IMG, label: "Étudiez efficacement", sub: "Interface optimisée mobile & desktop" },
          { src: ANATOMY_IMG, label: "Anatomie & sciences", sub: "5 facultés · 1 038 activités" },
        ].map((img, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.1 * i }}
            className="rounded-2xl overflow-hidden border relative group"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.label}
              className="w-full h-40 object-cover group-hover:scale-[1.03] transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-3">
              <p className="text-xs font-semibold text-white">{img.label}</p>
              <p className="text-[10px] text-white/60 mt-0.5">{img.sub}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* ── CTA bottom ── */}
      <section className="border-t pt-8 pb-4 text-center px-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-sm mx-auto space-y-4">
          <h2 className="text-xl font-bold">Prêt à commencer ?</h2>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>43 985 questions, accès immédiat, sans vérification e-mail.</p>
          <div className="flex flex-col gap-2.5">
            <Link href="/auth"
              className="px-6 py-3 rounded-xl font-semibold text-sm bg-white text-black hover:bg-zinc-100 transition-all">
              Créer un compte gratuit
            </Link>
            <Link href="/semestres"
              className="px-6 py-3 rounded-xl font-semibold text-sm border transition-all hover:bg-white/[0.06]"
              style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--text)" }}>
              Explorer sans compte
            </Link>
          </div>
        </motion.div>
      </section>

    </main>
  );
}
