"use client";
import { motion, useInView } from "framer-motion";
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

const FEATURES = [
  {
    icon: Brain, title: "IA intégrée",
    desc: "Explication streamée par GPT-4 après chaque réponse.",
  },
  {
    icon: Zap, title: "Multi-facultés",
    desc: "FMPC · FMPR · FMPM · UM6SS · FMPDF — toutes les filières.",
  },
  {
    icon: BarChart2, title: "Statistiques",
    desc: "Taux de réussite, séries quotidiennes, anneaux de progression.",
  },
  {
    icon: MessageCircle, title: "Commentaires",
    desc: "Discussions sous chaque question. Apprenez ensemble.",
  },
  {
    icon: Shield, title: "Révision ciblée",
    desc: "Détecte vos lacunes et vous les resoumet automatiquement.",
  },
  {
    icon: Sparkles, title: "Accès instantané",
    desc: "Compte en quelques secondes. Aucune vérification e-mail.",
  },
];

const SUBJECTS = [
  "Embryologie","Biologie Cellulaire","Génétique","Histologie","Anatomie",
  "Biochimie","Physiologie","Microbiologie","Immunologie","Pharmacologie",
  "Sémiologie","Pathologie","Neurologie","Cardiologie","Radiologie",
];

// Hadith + study quotes (cycling or static — using first as hero quote)
const HADITH = "« Demandez la science du berceau jusqu'à la tombe. »";
const HADITH_SOURCE = "— Hadith";

function AnimatedCounter({ value, label }: { value: number; label: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const count = useCounter(value, 2200, inView);
  return (
    <div ref={ref} className="text-center">
      <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text)" }}>
        {count.toLocaleString("fr-FR")}
      </p>
      <p className="text-[11px] mt-0.5 uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

function LoggedInHero({ name }: { name: string }) {
  const firstName = name?.split(" ")[0] ?? "Étudiant";
  const quickLinks = [
    { href: "/semestres", icon: BookOpen, label: "Reprendre la révision" },
    { href: "/stats", icon: TrendingUp, label: "Mes statistiques" },
    { href: "/revision", icon: Flame, label: "Révision ciblée" },
  ];
  return (
    <div className="flex flex-col items-center text-center space-y-5">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <p className="text-[13px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
          Bon retour
        </p>
        <h1 className="text-[28px] sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          {firstName}
        </h1>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
        className="w-full max-w-xs space-y-1.5">
        {quickLinks.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}>
            <div className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-all cursor-pointer"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}>
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-secondary)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
            </div>
          </Link>
        ))}
      </motion.div>
    </div>
  );
}

export default function LandingPage() {
  const { user, profile } = useAuth();
  const isLoggedIn = !!user;
  const userName = profile?.full_name ?? profile?.username ?? user?.email?.split("@")[0] ?? "";

  return (
    <main className="pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden w-full min-h-[420px] sm:min-h-[500px] flex flex-col items-center justify-center px-4 pt-8 pb-8 text-center">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMG}
            alt=""
            aria-hidden
            className="w-full h-full object-cover object-center"
            style={{ opacity: 0.10, filter: "saturate(0) brightness(0.6)" }}
          />
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.75) 100%)" }} />
        </div>

        <div className="relative z-10 w-full max-w-lg mx-auto space-y-6">
          {/* Wordmark */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="ZeroQCM" className="h-10 w-10 rounded-lg object-cover" />
          </motion.div>

          {isLoggedIn ? (
            <LoggedInHero name={userName} />
          ) : (
            <>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
                <h1 className="text-[32px] sm:text-[42px] font-bold tracking-tight leading-[1.1]" style={{ color: "var(--text)" }}>
                  La révision médicale,<br />
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>réinventée.</span>
                </h1>
              </motion.div>

              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="text-sm max-w-xs mx-auto leading-relaxed"
                style={{ color: "rgba(255,255,255,0.5)" }}>
                180 000 questions. 5 facultés. IA à chaque étape.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <Link href="/semestres"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-white text-black hover:bg-zinc-100 transition-all">
                  Commencer
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link href="/auth"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
                  style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>
                  Créer un compte
                </Link>
              </motion.div>
            </>
          )}

          {/* Stats strip — guests only */}
          {!isLoggedIn && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
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
      <div className="py-3 border-y overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <Marquee speed={30} className="gap-3">
          {SUBJECTS.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-full border whitespace-nowrap"
              style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)", color: "var(--text-muted)" }}>
              <span className="w-1 h-1 rounded-full inline-block" style={{ background: "rgba(255,255,255,0.3)" }} />
              {s}
            </span>
          ))}
        </Marquee>
      </div>

      {/* ── Features ── */}
      <section className="px-4 py-12 max-w-2xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {FEATURES.map(({ icon: Icon, title, desc }, idx) => (
            <div key={title}
              className="px-5 py-5 space-y-2 transition-all"
              style={{ background: "var(--bg)" }}>
              <Icon className="w-4 h-4 mb-3" style={{ color: "rgba(255,255,255,0.5)" }} />
              <p className="text-sm font-semibold tracking-tight" style={{ color: "var(--text)" }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Hadith / Study quote ── */}
      <section className="px-4 pb-12 max-w-2xl mx-auto">
        <div className="rounded-2xl px-6 py-8 text-center space-y-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[11px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Sagesse</p>
          <blockquote className="text-base sm:text-lg font-medium leading-relaxed italic"
            style={{ color: "rgba(255,255,255,0.75)" }}>
            {HADITH}
          </blockquote>
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{HADITH_SOURCE}</p>
        </div>
      </section>

    </main>
  );
}
