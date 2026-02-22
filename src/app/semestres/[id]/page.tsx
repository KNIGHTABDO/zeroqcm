"use client";
import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Module {
  id: number; nom: string; total_questions: number; total_activities: number;
}

const SEM_LABELS: Record<string, string> = {
  s1_fmpc: "S1 FMPC", s1_fmpdf: "S1 FMPDF",
  s1_fmpm: "S1 FMPM", s1_fmpr: "S1 FMPR", s1_um6: "S1 UM6SS",
};

export default function SemesterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("modules").select("*").eq("semester_id", id).order("nom")
      .then(({ data }) => { setModules(data ?? []); setLoading(false); });
  }, [id]);

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-5 md:max-w-2xl lg:max-w-3xl">
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-sm transition-colors" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold">{SEM_LABELS[id] ?? id.toUpperCase()}</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {modules.length} modules · {modules.reduce((s, m) => s + m.total_questions, 0).toLocaleString()} questions
          </p>
        </motion.div>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))
        ) : (
          <motion.div initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {modules.map((mod) => (
              <motion.div key={mod.id}
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
                <Link href={`/modules/${mod.id}`}>
                  <div className="rounded-2xl border px-5 py-4 transition-all cursor-pointer group hover:bg-white/[0.06]"
                    style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{mod.nom}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {mod.total_questions.toLocaleString()} questions · {mod.total_activities} activités
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 flex-shrink-0 transition-colors"
                        style={{ color: "var(--text-muted)" }} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </main>
  );
}
