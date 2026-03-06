"use client";
import { use, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ClipboardList, Dumbbell, ArrowLeft, Clock, Search, Target, CheckCircle } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ActivityCardSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

interface Activity {
  id: number; nom: string; type_activite: "exam" | "exercise"; total_questions: number; chapitre?: string;
}

type Progress = {
  activity_id: number;
  answered: number;
  correct: number;
};

function ModuleActivitiesPageInner({ params }: { params: Promise<{ id: string; moduleId: string }> }) {
  const { id: semId, moduleId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const modId = parseInt(moduleId);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [moduleName, setModuleName] = useState("");
  const [progress, setProgress] = useState<Record<number, Progress>>({});
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"exercise" | "exam">(() => {
    const t = searchParams.get("tab");
    return t === "exam" ? "exam" : "exercise";
  });

  function switchTab(t: "exercise" | "exam") {
    setTab(t);
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", t);
    router.replace(`/semestres/${semId}/${moduleId}?${p.toString()}`, { scroll: false });
  }
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [weakCount, setWeakCount] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [{ data: mod }, { data: acts }] = await Promise.all([
        supabase.from("modules").select("nom").eq("id", modId).maybeSingle(),
        supabase.from("activities").select("id, nom, type_activite, total_questions, chapitre").eq("module_id", modId).order("id"),
      ]);

      setModuleName(mod?.nom ?? `Module ${modId}`);
      const actList = (acts ?? []) as Activity[];
      setActivities(actList);

      if (user && actList.length > 0) {
        const actIds = actList.map((a) => a.id);
        const { data: ans } = await supabase
          .from("user_answers")
          .select("is_correct, questions!inner(activities!inner(id))")
          .eq("user_id", user.id)
          .in("questions.activities.id", actIds);

        const prog: Record<number, Progress> = {};
        (ans ?? []).forEach((a: any) => {
          const aid = a.questions?.activities?.id;
          if (!aid) return;
          if (!prog[aid]) prog[aid] = { activity_id: aid, answered: 0, correct: 0 };
          prog[aid].answered++;
          if (a.is_correct) prog[aid].correct++;
        });
        setProgress(prog);
      }

      setLoading(false);
    }
    load();
  }, [semId, moduleId, user]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/weak-questions?userId=${user.id}&moduleId=${modId}`)
      .then((r) => r.json())
      .then((d) => setWeakCount(d.count ?? 0))
      .catch(() => setWeakCount(0));
  }, [user, modId]);

  const filtered = activities
    .filter((a) => a.type_activite === tab)
    .filter((a) => !search || a.nom.toLowerCase().includes(search.toLowerCase()));

  const exams = activities.filter((a) => a.type_activite === "exam").length;
  const exercises = activities.filter((a) => a.type_activite === "exercise").length;

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4 md:max-w-2xl">
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> Retour
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
            <Link strokeWidth={1.5} href={`/revision/${modId}`}>
              <div className="rounded-2xl border px-5 py-4 flex items-center gap-4 transition-all hover:bg-orange-500/10 cursor-pointer"
                style={{ background: "rgba(249,115,22,0.06)", borderColor: "rgba(249,115,22,0.25)" }}>
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <Target strokeWidth={1.5} className="w-5 h-5 text-orange-400" />
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

        {/* Tabs: Par cours | Par exam */}
        <div className="flex rounded-2xl border p-1 gap-1" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          {(["exercise", "exam"] as const).map((t) => (
            <button key={t} onClick={() => switchTab(t)}
              className={cn("flex-1 py-2 rounded-xl text-xs font-semibold transition-all",
                tab === t ? "" : "hover:bg-white/[0.04]")}
              style={{ color: tab === t ? "white" : "var(--text-secondary)" }}>
              {t === "exercise" ? `Par cours (${exercises})` : `Par exam (${exams})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
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
            ) : filtered.map((act) => {
              const prog = progress[act.id];
              const answered = prog?.answered ?? 0;
              const correct = prog?.correct ?? 0;
              const pct = act.total_questions > 0 ? Math.round((answered / act.total_questions) * 100) : 0;
              const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : null;
              const isComplete = pct >= 100;

              return (
                <motion.div key={act.id} variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}>
                  <Link strokeWidth={1.5} href={`/quiz/${act.id}`}>
                    <div className="rounded-2xl border px-5 py-4 transition-all cursor-pointer hover:bg-white/[0.06]"
                      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                          act.type_activite === "exam" ? "" : "bg-emerald-500/10 border border-emerald-500/20")
                    style={{ background: act.type_activite === "exam" ? "var(--surface-alt)" : undefined, border: act.type_activite === "exam" ? "1px solid var(--border)" : undefined }})}>
                          {act.type_activite === "exam"
                            ? <ClipboardList className="w-4 h-4" strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
                            : <Dumbbell className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>{act.nom}</p>
                            {isComplete && <CheckCircle strokeWidth={1.5} className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--success)" }} />}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-lg",
                              act.type_activite === "exam" ? "" : "bg-emerald-500/10 text-emerald-400")}>
                              {act.type_activite === "exam" ? "Examen" : "Exercice"}
                            </span>
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{act.total_questions} q</span>
                            {act.chapitre && <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>· {act.chapitre}</span>}
                            {accuracy !== null && (
                              <span className="text-[11px] font-semibold"
                                style={{ color: accuracy >= 70 ? "var(--success)" : accuracy >= 50 ? "var(--warning)" : "var(--error)" }}>
                                {accuracy}% juste
                              </span>
                            )}
                          </div>
                          {act.total_questions > 0 && answered > 0 && (
                            <div className="mt-2">
                              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                                <motion.div className="h-full rounded-full"
                                  style={{ background: isComplete ? "var(--success)" : "var(--accent)" }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.6, ease: "easeOut" }}
                                />
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>{answered}/{act.total_questions}</span>
                                <span className="text-[10px] font-medium" style={{ color: pct > 0 ? "var(--text-secondary)" : "var(--text-disabled)" }}>
                                  {isComplete ? "✓ Terminé" : `${pct}%`}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        {!isComplete && <Clock strokeWidth={1.5} className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </main>
  );
}

import { Suspense } from "react";
export default function ModuleActivitiesPage({ params }: { params: Promise<{ id: string; moduleId: string }> }) {
  return (
    <Suspense fallback={null}>
      <ModuleActivitiesPageInner params={params} />
    </Suspense>
  );
}
