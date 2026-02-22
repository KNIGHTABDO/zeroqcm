"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Target, Flame, TrendingUp, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SEMESTERS = [
  { id: "s1_fmpc", label: "S1", faculty: "FMPC", questions: 10697, modules: 6, color: "blue" },
  { id: "s2_fmpc", label: "S2", faculty: "FMPC", questions: 0, modules: 0, color: "blue", soon: true },
  { id: "s3_fmpc", label: "S3", faculty: "FMPC", questions: 0, modules: 0, color: "blue", soon: true },
];

const STATS = [
  { icon: Target, label: "Questions révisées", value: "—", color: "text-blue-400" },
  { icon: Flame, label: "Série active", value: "0 jours", color: "text-orange-400" },
  { icon: TrendingUp, label: "Taux de réussite", value: "—", color: "text-emerald-400" },
];

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-md mx-auto px-4 pt-6 pb-28 space-y-6 md:max-w-2xl lg:max-w-none lg:px-0">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-1"
        >
          <p className="text-xs text-zinc-600 tracking-widest uppercase">FMPC · Médecine</p>
          <h1 className="text-xl font-bold text-white">Bonjour 👋</h1>
          <p className="text-sm text-zinc-500">Prêt à réviser aujourd&apos;hui ?</p>
        </motion.div>

        {/* Quick stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="grid grid-cols-3 gap-2"
        >
          {STATS.map((s) => (
            <div key={s.label} className="bg-[#0d0d0d] border border-white/[0.06] rounded-2xl p-3 space-y-1">
              <s.icon className={cn("w-4 h-4", s.color)} />
              <p className="text-base font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-zinc-600 leading-tight">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Semesters */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-white">Semestres</p>
            <span className="text-xs text-zinc-600">FMPC</span>
          </div>

          <div className="space-y-2 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">
            {SEMESTERS.map((sem, i) => (
              <motion.div
                key={sem.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
              >
                {sem.soon ? (
                  <div className="bg-[#0d0d0d] border border-white/[0.04] rounded-2xl px-5 py-4 opacity-40 cursor-not-allowed">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-zinc-600" />
                          <p className="text-sm font-semibold text-zinc-400">{sem.label}</p>
                        </div>
                        <p className="text-xs text-zinc-600 mt-0.5">Bientôt disponible</p>
                      </div>
                      <span className="text-[10px] text-zinc-700 border border-zinc-800 rounded-lg px-2 py-1">SOON</span>
                    </div>
                  </div>
                ) : (
                  <Link href={`/semestres/${sem.id}`}>
                    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-2xl px-5 py-4 hover:bg-white/[0.06] active:bg-white/[0.08] transition-all cursor-pointer group">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                              <BookOpen className="w-3 h-3 text-blue-400" />
                            </div>
                            <p className="text-sm font-semibold text-white">{sem.label} · {sem.faculty}</p>
                          </div>
                          <p className="text-xs text-zinc-500">{sem.modules} modules · {sem.questions.toLocaleString()} questions</p>
                          {/* Progress bar */}
                          <div className="h-1 w-32 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full w-0 bg-blue-500 rounded-full" />
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                      </div>
                    </div>
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Quick start card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="bg-[#0d0d0d] border border-white/[0.06] rounded-2xl p-5 space-y-3"
        >
          <p className="text-sm font-semibold text-white">Démarrage rapide</p>
          <p className="text-xs text-zinc-600">Continuez là où vous vous êtes arrêté.</p>
          <Link href="/semestres/s1_fmpc">
            <button className="w-full py-3.5 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all mt-1">
              Commencer S1 FMPC
            </button>
          </Link>
        </motion.div>

      </div>
    </main>
  );
}
