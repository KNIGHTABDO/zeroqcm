"use client";

import { use } from "react";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Hardcoded S1 FMPC modules (populated by scraper)
const MODULES: Record<string, { id: number; nom: string; questions: number; activities: number }[]> = {
  s1_fmpc: [
    { id: 26, nom: "Anatomie 1", questions: 1212, activities: 41 },
    { id: 28, nom: "Biologie - Génétique fondamentale", questions: 2290, activities: 35 },
    { id: 29, nom: "Biophysique", questions: 1061, activities: 32 },
    { id: 30, nom: "Chimie - Biochimie", questions: 2491, activities: 42 },
    { id: 31, nom: "Méthodologies & Terminologie", questions: 1486, activities: 40 },
    { id: 32, nom: "Santé publique & Biostatistiques", questions: 2157, activities: 50 },
  ],
};

export default function SemesterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const modules = MODULES[id] ?? [];

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-md mx-auto px-4 pt-6 pb-28 space-y-5 md:max-w-2xl lg:max-w-3xl">

        {/* Back + title */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <h1 className="text-xl font-bold">S1 FMPC</h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            {modules.length} modules · {modules.reduce((s, m) => s + m.questions, 0).toLocaleString()} questions
          </p>
        </motion.div>

        {/* Module list */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
          className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0"
        >
          {modules.map((mod) => (
            <motion.div
              key={mod.id}
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            >
              <Link href={`/modules/${mod.id}`}>
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-2xl px-5 py-4 hover:bg-white/[0.06] active:bg-white/[0.08] transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{mod.nom}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        {mod.questions.toLocaleString()} questions · {mod.activities} activités
                      </p>
                      <div className="h-0.5 w-full bg-white/[0.04] rounded-full mt-2 overflow-hidden">
                        <div className="h-full w-0 bg-blue-500 rounded-full transition-all" />
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 flex-shrink-0 transition-colors" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}
