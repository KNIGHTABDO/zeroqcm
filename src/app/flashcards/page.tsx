"use client";
import { motion } from "framer-motion";
import { Layers, Wrench, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function FlashcardsPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--bg)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center text-center max-w-sm w-full gap-6"
      >
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Wrench className="w-7 h-7" style={{ color: "var(--text-muted)" }} />
        </div>

        {/* Text */}
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
            Flashcards en maintenance
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Cette fonctionnalité est temporairement indisponible pendant que nous effectuons des améliorations. Elle sera bientôt de retour.
          </p>
        </div>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: "var(--border)" }} />

        {/* Back link */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </Link>
      </motion.div>
    </div>
  );
}
