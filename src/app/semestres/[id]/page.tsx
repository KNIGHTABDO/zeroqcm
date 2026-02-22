"use client";
import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ModuleCardSkeleton } from "@/components/ui/Skeleton";

interface Module {
  id: number;
  nom: string;
  total_questions: number;
  total_activities: number;
  description: string | null;
}

interface Semester {
  semestre_id: string;
  nom: string;
  faculty: string;
  total_questions: number;
  total_modules: number;
}

export default function SemesterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const semId = decodeURIComponent(id);
  const router = useRouter();
  const [semester, setSemester] = useState<Semester | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase
        .from("semesters")
        .select("semestre_id, nom, faculty, total_questions, total_modules")
        .eq("semestre_id", semId)
        .single(),
      supabase
        .from("modules")
        .select("id, nom, total_questions, total_activities, description")
        .eq("semester_id", semId)
        .order("nom"),
    ]).then(([{ data: sem }, { data: mods }]) => {
      setSemester(sem);
      setModules(mods ?? []);
      setLoading(false);
    });
  }, [semId]);

  const totalQ = semester?.total_questions ?? modules.reduce((s, m) => s + (m.total_questions || 0), 0);

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-5 md:max-w-2xl lg:max-w-3xl">
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold">{semester?.nom ?? semId}</h1>
          {!loading && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {modules.length} modules · {totalQ.toLocaleString()} questions
            </p>
          )}
        </motion.div>

        {loading ? (
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {Array.from({ length: 6 }).map((_, i) => <ModuleCardSkeleton key={i} />)}
          </div>
        ) : modules.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucun module trouvé</p>
          </div>
        ) : (
          <motion.div
            initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0"
          >
            {modules.map((mod) => (
              <motion.div key={mod.id} variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
                <Link href={`/modules/${mod.id}`}>
                  <div className="rounded-2xl border px-5 py-4 transition-all cursor-pointer hover:bg-white/[0.06]"
                    style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                          {mod.nom}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {mod.total_questions?.toLocaleString()} questions · {mod.total_activities} activités
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
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
