"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";

const SEMESTERS = [
  { id: "s1",       nom: "S1 FMPC",   questions: 10697, color: "blue"    },
  { id: "S1_FMPR",  nom: "S1 FMPR",   questions: 10495, color: "violet"  },
  { id: "S1_FMPM",  nom: "S1 FMPM",   questions: 8461,  color: "emerald" },
  { id: "S1_UM6",   nom: "S1 UM6SS",  questions: 7188,  color: "amber"   },
  { id: "s1_FMPDF", nom: "S1 FMPDF",  questions: 7144,  color: "rose"    },
];

const COLOR: Record<string, string> = {
  blue:    "bg-blue-500/10 border-blue-500/20 text-blue-400",
  violet:  "bg-violet-500/10 border-violet-500/20 text-violet-400",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  amber:   "bg-amber-500/10 border-amber-500/20 text-amber-400",
  rose:    "bg-rose-500/10 border-rose-500/20 text-rose-400",
};

export default function SemestresPage() {
  const total = SEMESTERS.reduce((s, x) => s + x.questions, 0);
  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-5 md:max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold">Semestres</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {total.toLocaleString()} questions · 5 facultés · 33 modules
          </p>
        </motion.div>
        <motion.div initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          className="space-y-2">
          {SEMESTERS.map((s) => (
            <motion.div key={s.id}
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
              <Link href={`/semestres/${s.id}`}>
                <div className="rounded-2xl border px-5 py-4 flex items-center gap-4 transition-all hover:bg-white/[0.06] cursor-pointer"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${COLOR[s.color]}`}>
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{s.nom}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {s.questions.toLocaleString()} questions
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}
