"use client";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import {
  Brain, Zap, BarChart2, MessageCircle, Shield, Sparkles, ArrowRight, Star,
  BookOpen, TrendingUp, Flame,
} from "lucide-react";
import { Marquee } from "@/components/ui/Marquee";
import { useCounter } from "@/hooks/useCounter";
import { useAuth } from "@/components/auth/AuthProvider";

const HERO_IMG = "/images/hero.jpg";
const STUDY_IMG = "/images/study.jpg";
const ANATOMY_IMG = "/images/anatomy.jpg";

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

const SUBJECTS = [
  "Embryologie","Biologie Cellulaire","Génétique","Histologie","Anatomie",
  "Biochimie","Physiologie","Microbiologie","Immunologie","Pharmacologie",
  "Sémiologie","Pathologie","Neurologie","Cardiologie","Radiologie",
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

// Logged-in personalized hero content
function LoggedInHero({ name }: { name: string }) {
  const firstName = name?.split(" ")[0] ?? "Étudiant";
  const quickLinks = [
    { href: "/semestres", icon: BookOpen, label: "Reprendre la révision", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { href: "/stats", icon: TrendingUp, label: "Mes statistiques", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { href: "/revision", icon: Flame, label: "Révision ciblée", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  ];
  return (
    <div className="flex flex-col items-center text-center space-y-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h1 className="text-[26px] sm:text-3xl font-extrabold tracking-tight">
          Bon retour,{" "}
          <span style={{ background: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {firstName}
          </span>{" "}👋
        </h1>
        <p className="text-sm mt-1.5" style={{ color: "var(--text-secondary)" }}>
          Prêt à continuer votre révision ?
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
        className="w-full max-w-xs space-y-2">
        {quickLinks.map(({ href, icon: Icon, label, color, bg }) => (
          <Link key={href} href={href}>
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all hover:bg-white/[0.06] cursor-pointer ${bg}`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-auto" style={{ color: "var(--text-muted)" }} />
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
  const userName = profile?.username ?? user?.email?.split("@")[0] ?? "";

  return (
    <main className="pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>

      {/* ── Hero — full background image ── */}
      <section className="relative overflow-hidden w-full min-h-[420px] sm:min-h-[500px] flex flex-col items-center justify-center px-4 pt-8 pb-8 text-center">
        {/* Full-bleed background image */}
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMG}
            alt=""
            aria-hidden
            className="w-full h-full object-cover object-center"
            style={{ opacity: 0.18, filter: "saturate(0.7)" }}
          />
          {/* Dark gradient overlay for text legibility */}
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(9,9,11,0.55) 0%, rgba(9,9,11,0.15) 40%, rgba(9,9,11,0.7) 100%)" }} />
          {/* Blue glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)" }} />
        </div>

        <div className="relative z-10 w-full max-w-lg mx-auto space-y-5">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border"
              style={{ background: "rgba(59,130,246,0.1)", borderColor: "rgba(59,130,246,0.25)", color: "#60a5fa" }}>
              <Star className="w-2.5 h-2.5 fill-current" />
              161 688 questions · 4 semestres · 5 facultés
            </span>
          </motion.div>

          {/* Conditional hero content */}
          {isLoggedIn ? (
            <LoggedInHero name={userName} />
          ) : (
            <>
              <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="text-[28px] sm:text-4xl font-extrabold tracking-tight leading-[1.15]">
                Révisez <span className="text-white">smarter.</span><br />
                <span style={{ background: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Progressez plus vite.
                </span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                className="text-sm max-w-xs mx-auto leading-relaxed"
                style={{ color: "rgba(255,255,255,0.65)" }}>
                La plateforme QCM des étudiants en médecine du Maroc — IA, révision ciblée, stats.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
                className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <Link href="/semestres"
                  className="group inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-white text-black hover:bg-zinc-100 transition-all">
                  Commencer maintenant
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link href="/auth"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm border transition-all hover:bg-white/[0.08]"
                  style={{ borderColor: "rgba(255,255,255,0.2)", color: "white" }}>
                  Créer un compte
                </Link>
              </motion.div>
            </>
          )}

          {/* Stats strip */}
          {!isLoggedIn && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
              className="rounded-2xl border grid grid-cols-3 divide-x px-2 py-4"
              style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}>
              <AnimatedCounter value={161688} label="Questions" />
              <AnimatedCounter value={6369} label="Activités" />
              <AnimatedCounter value={5} label="Facultés" />
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Subject ticker ── */}
      <div className="py-3 border-y overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <Marquee speed={35} className="gap-3">
          {SUBJECTS.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-full border whitespace-nowrap"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", color: "var(--text-muted)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400/50 inline-block" />
              {s}
            </span>
          ))}
        </Marquee>
      </div>

      {/* ── Features ── */}
      <section className="px-4 py-10 max-w-2xl mx-auto space-y-4">
        <h2 className="text-lg font-bold text-center mb-6">Tout ce dont vous avez besoin</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title}
              className="rounded-2xl border px-5 py-4 space-y-2 transition-all hover:bg-white/[0.03]"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Screenshots / study image ── */}
      <section className="px-4 pb-10 max-w-2xl mx-auto">
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={STUDY_IMG} alt="Révision" className="w-full object-cover max-h-48 sm:max-h-64"
            style={{ opacity: 0.8 }} />
        </div>
      </section>
    </main>
  );
}
