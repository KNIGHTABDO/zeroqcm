"use client";

import { motion } from "framer-motion";
import { Target, Flame, Clock, TrendingUp, BookOpen } from "lucide-react";

const PLACEHOLDERS = [
  { icon: Target, label: "Questions répondues", value: "0", sub: "total" },
  { icon: TrendingUp, label: "Taux de réussite", value: "—", sub: "global" },
  { icon: Flame, label: "Série d'étude", value: "0 jours", sub: "consécutifs" },
  { icon: Clock, label: "Temps total", value: "0 min", sub: "d'étude" },
];

export default function StatsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-md mx-auto px-4 pt-6 pb-28 space-y-6 md:max-w-2xl lg:max-w-3xl">

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold">Statistiques</h1>
          <p className="text-xs text-zinc-600 mt-0.5">Votre progression globale</p>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3 md:grid-cols-4"
        >
          {PLACEHOLDERS.map((s) => (
            <div key={s.label} className="bg-[#0d0d0d] border border-white/[0.06] rounded-2xl p-4 space-y-2">
              <s.icon className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-[10px] text-zinc-600">{s.sub}</p>
              </div>
              <p className="text-xs text-zinc-500">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Modules breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0d0d0d] border border-white/[0.06] rounded-2xl overflow-hidden"
        >
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
            <BookOpen className="w-4 h-4 text-zinc-400" />
            <p className="text-sm font-semibold text-white">Par module</p>
          </div>
          {["Anatomie 1", "Biologie - Génétique", "Biophysique", "Chimie - Biochimie"].map((mod) => (
            <div key={mod} className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04] last:border-0">
              <p className="text-sm text-zinc-400">{mod}</p>
              <div className="flex items-center gap-3">
                <div className="w-24 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-blue-500 rounded-full" />
                </div>
                <span className="text-xs text-zinc-600 w-8 text-right">0%</span>
              </div>
            </div>
          ))}
        </motion.div>

      </div>
    </main>
  );
}
