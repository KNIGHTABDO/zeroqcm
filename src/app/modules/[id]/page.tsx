"use client";
import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Dumbbell, ArrowLeft, Clock, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ActivityCardSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

interface Activity {
  id: number; nom: string; type_activite: "exam" | "exercise"; total_questions: number; chapitre?: string;
}

export default function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const moduleId = parseInt(id);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [moduleName, setModuleName] = useState("");
  const [filter, setFilter] = useState<"all" | "exam" | "exercise">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("modules").select("nom").eq("id", moduleId).single(),
      supabase.from("activities").select("*").eq("module_id", moduleId).order("nom"),
    ]).then(([{ data: mod }, { data: acts }]) => {
      setModuleName(mod?.nom ?? `Module ${moduleId}`);
      setActivities(acts ?? []);
      setLoading(false);
    });
  }, [moduleId]);

  const filtered = activities
    .filter((a) => filter === "all" || a.type_activite === filter)
    .filter((a) => !search || a.nom.toLowerCase().includes(search.toLowerCase()));

  const exams = activities.filter((a) => a.type_activite === "exam").length;
  const exercises = activities.filter((a) => a.type_activite === "exercise").length;

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4 md:max-w-2xl">
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold">{moduleName || <span className="skeleton inline-block w-40 h-5 rounded-lg" />}</h1>
          {!loading && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {exams} examens · {exercises} exercices
            </p>
          )}
        </motion.div>

        {/* Search + filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Chercher une activité..."
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm border focus:outline-none transition-colors"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
            />
          </div>
          <div className="flex gap-2">
            {(["all", "exam", "exercise"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                  filter === f ? "bg-white text-black border-transparent" : "hover:bg-white/[0.04]")}
                style={{ borderColor: filter === f ? "transparent" : "var(--border)", color: filter === f ? "black" : "var(--text-secondary)" }}>
                {f === "all" ? "Tout" : f === "exam" ? "Examens" : "Exercices"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <ActivityCardSkeleton key={i} />)}
          </div>
        ) : (
          <motion.div initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Aucun résultat</p>
            ) : filtered.map((act) => (
              <motion.div key={act.id} variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}>
                <Link href={`/quiz/${act.id}`}>
                  <div className="rounded-2xl border px-5 py-4 transition-all cursor-pointer hover:bg-white/[0.06]"
                    style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                        act.type_activite === "exam" ? "bg-blue-500/10 border border-blue-500/20" : "bg-emerald-500/10 border border-emerald-500/20")}>
                        {act.type_activite === "exam"
                          ? <ClipboardList className="w-4 h-4 text-blue-400" />
                          : <Dumbbell className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{act.nom}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-lg",
                            act.type_activite === "exam" ? "text-blue-400 bg-blue-500/10" : "text-emerald-400 bg-emerald-500/10")}>
                            {act.type_activite === "exam" ? "Examen" : "Exercice"}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{act.total_questions} q</span>
                          {act.chapitre && <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>· {act.chapitre}</span>}
                        </div>
                      </div>
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
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
