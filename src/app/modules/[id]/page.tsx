"use client";

import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Dumbbell, ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Activity {
  id: number;
  nom: string;
  type: "exam" | "exercise";
  questions: number;
  chapitre?: string;
}

// Example data (will be from Supabase after scrape)
const MODULE_ACTIVITIES: Record<number, { name: string; activities: Activity[] }> = {
  26: {
    name: "Anatomie 1",
    activities: [
      { id: 2370, nom: "Rattrapage 2025", type: "exam", questions: 50 },
      { id: 2369, nom: "Normale 2025", type: "exam", questions: 50 },
      { id: 1230, nom: "Myologie", type: "exercise", questions: 93, chapitre: "Anatomie 1" },
    ],
  },
};

export default function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const moduleId = parseInt(id);
  const data = MODULE_ACTIVITIES[moduleId];
  const [filter, setFilter] = useState<"all" | "exam" | "exercise">("all");

  const activities = (data?.activities ?? []).filter(
    (a) => filter === "all" || a.type === filter
  );

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-md mx-auto px-4 pt-6 pb-28 space-y-5 md:max-w-2xl lg:max-w-3xl">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold">{data?.name ?? `Module ${id}`}</h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            {data?.activities.length ?? 0} activités disponibles
          </p>
        </motion.div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["all", "exam", "exercise"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                filter === f
                  ? "bg-white text-black border-transparent"
                  : "bg-white/[0.04] text-zinc-400 border-white/[0.06] hover:bg-white/[0.08]"
              )}
            >
              {f === "all" ? "Tout" : f === "exam" ? "Examens" : "Exercices"}
            </button>
          ))}
        </div>

        {/* Activity list */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          className="space-y-2"
        >
          {activities.map((act) => (
            <motion.div
              key={act.id}
              variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
            >
              <Link href={`/quiz/${act.id}`}>
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-2xl px-5 py-4 hover:bg-white/[0.06] active:bg-white/[0.08] transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                      act.type === "exam"
                        ? "bg-blue-500/10 border border-blue-500/20"
                        : "bg-emerald-500/10 border border-emerald-500/20"
                    )}>
                      {act.type === "exam"
                        ? <ClipboardList className="w-4 h-4 text-blue-400" />
                        : <Dumbbell className="w-4 h-4 text-emerald-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{act.nom}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-lg",
                          act.type === "exam"
                            ? "text-blue-400 bg-blue-500/10"
                            : "text-emerald-400 bg-emerald-500/10"
                        )}>
                          {act.type === "exam" ? "Examen" : "Exercice"}
                        </span>
                        <span className="text-xs text-zinc-600">{act.questions} questions</span>
                        {act.chapitre && (
                          <span className="text-xs text-zinc-700">· {act.chapitre}</span>
                        )}
                      </div>
                    </div>
                    <Clock className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 flex-shrink-0 transition-colors" />
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
