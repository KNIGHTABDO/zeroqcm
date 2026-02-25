"use client";
import { motion } from "framer-motion";
import {
  Mic, Languages, Zap, Brain, MessageSquare, Volume2, Sparkles
} from "lucide-react";

const FEATURES = [
  {
    icon: Mic,
    title: "Dictez vos réponses",
    desc: "Dites « A », « réponse B » ou « troisième » — l’IA vous comprend.",
  },
  {
    icon: Volume2,
    title: "Questions lues à voix haute",
    desc: "Chaque question est énoncée clairement. Révisez les yeux fermés.",
  },
  {
    icon: Brain,
    title: "Mode examen oral",
    desc: "Simulez un examen oral avec feedback instantané après chaque réponse.",
  },
  {
    icon: Languages,
    title: "Multilangue",
    desc: "Français, arabe, anglais — parlez dans la langue avec laquelle vous pensez.",
  },
  {
    icon: MessageSquare,
    title: "Explications vocales",
    desc: "Les explications des réponses sont aussi lues à haute voix après chaque question.",
  },
  {
    icon: Zap,
    title: "Session rapide",
    desc: "10 questions en mode mains libres. Idéal en transport, en marchant, partout.",
  },
];

export default function VoicePage() {
  return (
    <main
      className="min-h-screen pb-32 flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="max-w-lg mx-auto w-full px-5 pt-10 flex flex-col gap-8">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center text-center gap-5 pt-4"
        >
          {/* Pulsing mic orb */}
          <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
              animate={{ scale: [1, 1.14, 1], opacity: [0.6, 0.15, 0.6] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ width: 90, height: 90, background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
              animate={{ scale: [1, 1.09, 1], opacity: [0.8, 0.3, 0.8] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.45 }}
            />
            <div
              className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--accent)" }}
            >
              <Mic size={28} color="white" />
            </div>
          </div>

          {/* Coming soon badge */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              background: "var(--warning-subtle)",
              color: "var(--warning)",
              border: "1px solid var(--warning-border)",
            }}
          >
            <Sparkles size={11} />
            Bientôt disponible
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
              Mode Voice
            </h1>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "var(--text-secondary)", maxWidth: 300, margin: "8px auto 0" }}
            >
              Révisez vos QCM en mode mains libres — parlez, écoutez, apprenez.
              On finalise les derniers détails.
            </p>
          </div>
        </motion.div>

        {/* Animated waveform bars */}
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
              style={{ width: 3, height: 36, background: "var(--accent)", opacity: 0.55 }}
              animate={{ scaleY: [h * 0.35, h, h * 0.35] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }}
            />
          ))}
        </motion.div>

        {/* Feature cards */}
        <div className="flex flex-col gap-3">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 + i * 0.07, ease: "easeOut" }}
              className="flex items-start gap-4 px-4 py-4 rounded-2xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5"
                style={{
                  background: "var(--accent-subtle)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                <Icon size={16} style={{ color: "var(--accent)" }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </main>
  );
}
