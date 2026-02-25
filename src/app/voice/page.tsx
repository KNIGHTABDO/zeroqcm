"use client";
import { motion } from "framer-motion";
import {
  Mic, Waveform, Languages, Zap, Brain, MessageSquare, Volume2, Sparkles
} from "lucide-react";

const FEATURES = [
  {
    icon: Mic,
    title: "Dictez vos r\u00e9ponses",
    desc: "Dites \u00ab A \u00bb, \u00ab r\u00e9ponse B \u00bb ou \u00ab troisi\u00e8me \u00bb \u2014 l\u2019IA vous comprend.",
  },
  {
    icon: Volume2,
    title: "Questions lues \u00e0 voix haute",
    desc: "Chaque question est \u00e9nonc\u00e9e clairement. R\u00e9visez les yeux ferm\u00e9s.",
  },
  {
    icon: Brain,
    title: "Mode examen oral",
    desc: "Simulez un examen oral avec feedback instantan\u00e9 apr\u00e8s chaque r\u00e9ponse.",
  },
  {
    icon: Languages,
    title: "Multilangue",
    desc: "Fran\u00e7ais, arabe, anglais \u2014 parlez dans la langue avec laquelle vous pensez.",
  },
  {
    icon: MessageSquare,
    title: "Explications vocales",
    desc: "Les explications des r\u00e9ponses sont aussi lues \u00e0 haute voix apr\u00e8s chaque question.",
  },
  {
    icon: Zap,
    title: "Session rapide",
    desc: "10 questions en mode mains libres. Id\u00e9al en transport, en marchant, partout.",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

export default function VoicePage() {
  return (
    <main
      className="min-h-screen pb-32 flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="max-w-lg mx-auto w-full px-5 pt-10 flex flex-col gap-8">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-col items-center text-center gap-5 pt-4"
        >
          {/* Animated mic orb */}
          <div className="relative flex items-center justify-center">
            {/* Outer pulse ring */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 110, height: 110,
                background: "var(--accent-subtle)",
                border: "1px solid var(--accent-border)",
              }}
              animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.2, 0.5] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Inner ring */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 82, height: 82,
                background: "var(--accent-subtle)",
                border: "1px solid var(--accent-border)",
              }}
              animate={{ scale: [1, 1.08, 1], opacity: [0.7, 0.35, 0.7] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            />
            {/* Core icon */}
            <div
              className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--accent)", boxShadow: "0 8px 32px var(--accent-subtle)" }}
            >
              <Mic size={28} color="white" />
            </div>
          </div>

          {/* Coming soon badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              background: "var(--warning-subtle)",
              color: "var(--warning)",
              border: "1px solid var(--warning-border)",
            }}
          >
            <Sparkles size={11} />
            Bient\u00f4t disponible
          </motion.div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
              Mode Voice
            </h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)", maxWidth: 320, margin: "8px auto 0" }}>
              R\u00e9visez vos QCM en mode mains libres \u2014 parlez, \u00e9coutez, apprenez.
              On finalise les derniers d\u00e9tails.
            </p>
          </div>
        </motion.div>

        {/* ── Waveform decoration ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="flex items-center justify-center gap-1"
          style={{ height: 36 }}
        >
          {[0.6, 0.9, 0.5, 1, 0.7, 0.85, 0.45, 0.95, 0.6, 0.75, 0.5, 0.8, 0.65].map((h, i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{ width: 3, background: "var(--accent)", opacity: 0.6 }}
              animate={{ scaleY: [h * 0.4, h, h * 0.4] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.1,
              }}
              initial={{ scaleY: h * 0.4, height: 36 }}
            />
          ))}
        </motion.div>

        {/* ── Feature grid ─────────────────────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-3"
        >
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <motion.div
              key={title}
              variants={itemVariants}
              className="flex items-start gap-4 px-4 py-4 rounded-2xl"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5"
                style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
              >
                <Icon size={16} style={{ color: "var(--accent)" }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </main>
  );
}
