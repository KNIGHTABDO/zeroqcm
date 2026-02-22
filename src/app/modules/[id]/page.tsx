"use client";
import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Dumbbell, ArrowLeft, Clock, Search, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ActivityCardSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

interface Activity {
  id: number; nom: string; type_activite: "exam" | "exercise"; total_questions: number; chapitre?: string;
}

export default function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const moduleId = parseInt(id);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [moduleName, setModuleName] = useState("");
  const [tab, setTab] = useState<"exercise" | "exam">("exercise");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [weakCount, setWeakCount] = useState<number | null>(null);

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

  // Load weak question count for this module (only if user is logged in)
  useEffect(() => {
    if (!user) return;
    fetch(`/api/weak-questions?userId=${user.id}&moduleId=${moduleId}`)
      .then((r) => r.json())
      .then((d) => setWeakCount(d.count ?? 0))
      .catch(() => setWeakCount(0));
  }, [user, moduleId]);

  const filtered = activities
    .filter((a) => a.type_activite === tab)
    .filter((a) => !search || a.nom.toLowerCase().includes(search.toLowerCase()));

  const exams = activities.filter((a) => a.type_activite === "exam").length;
  const exercises = activities.filter((a) => a.type_activite === "exercise").length;
  const tabCount = tab === "exercise" ? exercises : exams;

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4 md:max-w-2xl">
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold">{moduleName}</h1>
          {!loading && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {exercises} cours · {exams} examens
            </p>
          )}
        </motion.div>

        {/* Révision ciblée CTA */}
        {user && weakCount !== null && weakCount > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Link href={`/revision/${moduleId}`}>
              <div className="rounded-2xl border px-5 py-4 flex items-center gap-4 transition-all hover:bg-orange-500/10 cursor-pointer"
                style={{ background: "rgba(249,115,22,0.06)", borderColor: "rgba(249,115,22,0.25)" }}>
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-orange-400">Révision ciblée</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {weakCount} question{weakCount > 1 ? "s" : ""} ratée{weakCount > 1 ? "s" : ""} 2× ou plus
                  </p>
                </div>
                <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-lg flex-shrink-0">
                  COMMENCER
                </span>
              </div>
            </Link>
          </motion.div>
        )}

        {/* Tab: Par cours | Par exam */}
        <div className="flex rounded-2xl border p-1 gap-1" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          {(["exercise", "exam"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("flex-1 py-2 rounded-xl text-xs font-semibold transition-all",
                tab === t ? "bg-blue-600 text-white shadow" : "hover:bg-white/[0.04]")}
              style={{ color: tab === t ? "white" : "var(--text-secondary)" }}>
              {t === "exercise" ? `Par cours (${exercises})` : `Par exam (${exams})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "exercise" ? "Chercher un cours..." : "Chercher un examen..."}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm border focus:outline-none transition-colors"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <ActivityCardSkeleton key={i} />)}</div>
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
