"use client";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import {
  Brain, Zap, BarChart2, MessageCircle, Shield, Sparkles, ArrowRight,
  BookOpen, TrendingUp, Flame,
} from "lucide-react";
import { Marquee } from "@/components/ui/Marquee";
import { useCounter } from "@/hooks/useCounter";
import { useAuth } from "@/components/auth/AuthProvider";

const HERO_IMG = "/images/hero.jpg";

// ── Features data ────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Brain,          num: "01", title: "IA intégrée",       desc: "Explication streamée par GPT-4 directement après chaque réponse." },
  { icon: Zap,            num: "02", title: "Multi-facultés",    desc: "FMPC · FMPR · FMPM · UM6SS · FMPDF — toutes les filières en un seul endroit." },
  { icon: BarChart2,      num: "03", title: "Statistiques",      desc: "Taux de réussite, séries quotidiennes et anneaux de progression animés." },
  { icon: MessageCircle,  num: "04", title: "Commentaires",      desc: "Discussions par question. Apprenez avec la communauté." },
  { icon: Shield,         num: "05", title: "Révision ciblée",   desc: "Détecte vos lacunes et vous les resoumet automatiquement." },
  { icon: Sparkles,       num: "06", title: "Accès immédiat",    desc: "Compte en quelques secondes. Aucune vérification e-mail." },
];

// ── Quranic ayah ──────────────────────────────────────────────────────────────
const AYAH_AR = "وَاللَّهُ أَخْرَجَكُم مِّن بُطُونِ أُمَّهَاتِكُمْ لَا تَعْلَمُونَ شَيْئًا وَجَعَلَ لَكُمُ السَّمْعَ وَالْأَبْصَارَ وَالْأَفْئِدَةَ";
const AYAH_SRC = "سورة النحل — الآية ٧٨";

const SUBJECTS = [
  "Embryologie","Biologie Cellulaire","Génétique","Histologie","Anatomie",
  "Biochimie","Physiologie","Microbiologie","Immunologie","Pharmacologie",
  "Sémiologie","Pathologie","Neurologie","Cardiologie","Radiologie",
];

// ── Hadith bilingual ──────────────────────────────────────────────────────────

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedCounter({ value, label }: { value: number; label: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const count = useCounter(value, 2200, inView);
  return (
    <div ref={ref} className="text-center">
      <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text)" }}>
        {count.toLocaleString("fr-FR")}
      </p>
      <p className="text-[10px] mt-1 uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

// ── Feature card with scroll-reveal ──────────────────────────────────────────
function FeatureCard({ icon: Icon, num, title, desc, index }: {
  icon: React.ElementType; num: string; title: string; desc: string; index: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col gap-4 px-5 py-6 rounded-2xl cursor-default select-none"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* number watermark */}
      <span className="absolute top-4 right-5 text-[11px] font-mono tabular-nums"
        style={{ color: "var(--text-disabled)" }}>
        {num}
      </span>
      {/* icon */}
      <div className="w-8 h-8 flex items-center justify-center rounded-xl"
        style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
        <Icon className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
      </div>
      <div>
        <p className="text-sm font-semibold tracking-tight mb-1.5" style={{ color: "var(--text)" }}>{title}</p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{desc}</p>
      </div>
      {/* hover shimmer line */}
      <div className="absolute bottom-0 left-0 right-0 h-px rounded-b-2xl transition-opacity opacity-0 group-hover:opacity-100"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />
    </motion.div>
  );
}

// ── Logged-in hero shortcuts ──────────────────────────────────────────────────
function LoggedInHero({ name }: { name: string }) {
  const firstName = name?.split(" ")[0] ?? "Étudiant";

  const quickLinks = [
    {
      href: "/semestres",
      icon: BookOpen,
      label: "Reprendre la révision",
      sublabel: "Continuez là où vous vous êtes arrêté",
    },
    {
      href: "/stats",
      icon: TrendingUp,
      label: "Mes statistiques",
      sublabel: "Taux de réussite · séries · progression",
    },
    {
      href: "/revision",
      icon: Flame,
      label: "Révision ciblée",
      sublabel: "Questions où vous peinez le plus",
    },
  ];

  return (
    <div className="flex flex-col items-center text-center w-full max-w-sm mx-auto space-y-7">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.5 }}>
        <p className="text-[11px] uppercase tracking-[0.2em] mb-3" style={{ color: "var(--text-muted)" }}>
          Bon retour
        </p>
        <h1 className="text-[30px] sm:text-[36px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
          {firstName}
        </h1>
      </motion.div>

      {/* Quick-link cards — spaced, premium */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full space-y-3">
        {quickLinks.map(({ href, icon: Icon, label, sublabel }, i) => (
          <motion.div
            key={href}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
            <Link href={href}>
              <div
                className="group flex items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all duration-200 cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.14)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
                }}
              >
                {/* icon container */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <Icon className="w-4 h-4" style={{ color: "rgba(255,255,255,0.7)" }} />
                </div>
                {/* text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold tracking-tight" style={{ color: "var(--text)" }}>{label}</p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{sublabel}</p>
                </div>
                {/* arrow */}
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-200"
                  style={{ color: "var(--text)" }} />
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user, profile } = useAuth();
  const isLoggedIn = !!user;
  const userName = profile?.full_name ?? profile?.username ?? user?.email?.split("@")[0] ?? "";

  return (
    <main className="pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden w-full min-h-[420px] sm:min-h-[520px] flex flex-col items-center justify-center px-4 pt-10 pb-10 text-center">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HERO_IMG} alt="" aria-hidden
            className="w-full h-full object-cover object-center"
            style={{ opacity: 0.08, filter: "saturate(0) brightness(0.5)" }} />
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.8) 100%)" }} />
        </div>

        <div className="relative z-10 w-full max-w-lg mx-auto space-y-7">
          {/* Logo mark */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
            className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="ZeroQCM"
              className="h-11 w-11 rounded-xl object-cover"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }} />
          </motion.div>

          {isLoggedIn ? (
            <LoggedInHero name={userName} />
          ) : (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.55, ease: [0.22,1,0.36,1] }}>
                <h1 className="text-[32px] sm:text-[44px] font-bold tracking-tight leading-[1.1]" style={{ color: "var(--text)" }}>
                  La révision médicale,<br />
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>réinventée.</span>
                </h1>
              </motion.div>
              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
                className="text-sm max-w-xs mx-auto leading-relaxed"
                style={{ color: "rgba(255,255,255,0.45)" }}>
                180 000 questions. 5 facultés. IA à chaque étape.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
                className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <Link href="/semestres"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-white text-black hover:bg-zinc-100 transition-all">
                  Commencer <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link href="/auth"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
                  style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>
                  Créer un compte
                </Link>
              </motion.div>
            </>
          )}

          {!isLoggedIn && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
              className="rounded-2xl grid grid-cols-3 divide-x px-2 py-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
              <AnimatedCounter value={180650} label="Questions" />
              <AnimatedCounter value={6369} label="Activités" />
              <AnimatedCounter value={5} label="Facultés" />
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Subject ticker ── */}
      <div className="py-3 border-y overflow-hidden w-full max-w-full" style={{ borderColor: "var(--border)" }}>
        <Marquee speed={28} className="gap-3">
          {SUBJECTS.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-full border whitespace-nowrap"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)", color: "var(--text-muted)" }}>
              <span className="w-1 h-1 rounded-full inline-block" style={{ background: "rgba(255,255,255,0.25)" }} />
              {s}
            </span>
          ))}
        </Marquee>
      </div>

      {/* ── Quranic Ayah — Arabic only, premium typography ── */}
      <section className="px-4 pt-14 pb-10 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl px-6 py-12 sm:px-10 sm:py-14 overflow-hidden text-center"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* top accent line */}
          <div className="absolute top-0 left-1/4 right-1/4 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }} />

          {/* Ayah */}
          <p
            dir="rtl"
            className="leading-[2.2] mb-6"
            style={{
              color: "rgba(255,255,255,0.92)",
              fontFamily: "'Scheherazade New', 'Noto Naskh Arabic', serif",
              fontSize: "clamp(1.35rem, 4vw, 1.85rem)",
              fontWeight: 400,
              letterSpacing: "0.01em",
            }}>
            {AYAH_AR}
          </p>

          {/* Source */}
          <p
            dir="rtl"
            style={{
              color: "rgba(255,255,255,0.28)",
              fontFamily: "'Noto Naskh Arabic', serif",
              fontSize: "0.8rem",
              letterSpacing: "0.03em",
            }}>
            {AYAH_SRC}
          </p>
        </motion.div>
      </section>

      {/* ── Features grid — numbered, scroll-reveal ── */}
      <section className="px-4 pb-14 max-w-2xl mx-auto">
        {/* section label */}
        <motion.p
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-[10px] uppercase tracking-[0.2em] text-center mb-8"
          style={{ color: "rgba(255,255,255,0.25)" }}>
          Fonctionnalités
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} index={i} />
          ))}
        </div>
      </section>

    </main>
  );
}
