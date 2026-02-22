"use client";
import { use, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CheckCircle, XCircle, ChevronRight,
  Timer, Trophy, Brain, Check, Target
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { submitAnswer } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { QuizImage } from "@/components/ui/QuizImage";

type Choice = { id: string; id_choix: number; contenu: string; est_correct: boolean; pourcentage: number; explication: string | null };
type Question = { id: string; texte: string; image_url: string | null; choices: Choice[] };
type Phase = "quiz" | "revealed" | "result";

export default function RevisionPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [noWeakQ, setNoWeakQ] = useState(false);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>("quiz");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [aiExplanation, setAiExplanation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetch("/api/weak-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, moduleId: moduleId !== "all" ? parseInt(moduleId) : undefined }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.questions?.length) { setNoWeakQ(true); } else { setQuestions(d.questions); }
        setLoading(false);
      });
  }, [user, moduleId]);

  const q = questions[current];
  const isLast = current === questions.length - 1;

  useEffect(() => {
    if (phase === "result" || loading) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase, loading]);

  async function getAiExplanation() {
    if (!q) return;
    setAiLoading(true); setAiExplanation("");
    const aiKey = localStorage.getItem("fmpc-ai-key") ?? "";
    const aiModel = localStorage.getItem("fmpc-ai-model") ?? "gemini-2.0-flash";
    const correctChoices = q.choices.filter((c) => c.est_correct).map((c) => c.contenu).join(", ");
    const prompt = `Question QCM médecine: "${q.texte}"\nRéponses correctes: ${correctChoices}\nExplique brièvement en français (max 100 mots) pourquoi.`;
    try {
      const res = await fetch("/api/ai-explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, model: aiModel, key: aiKey }) });
      const reader = res.body?.getReader(); const dec = new TextDecoder();
      if (!reader) return;
      while (true) { const { done, value } = await reader.read(); if (done) break; setAiExplanation((p) => p + dec.decode(value)); }
    } catch { setAiExplanation("Erreur IA"); }
    setAiLoading(false);
  }

  function confirm() {
    if (!q || !selected.size) return;
    const correctIds = new Set(q.choices.filter((c) => c.est_correct).map((c) => c.id));
    const isCorrect = selected.size === correctIds.size && [...selected].every((id) => correctIds.has(id));
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    setPhase("revealed");
    if (user) submitAnswer({ userId: user.id, questionId: q.id, activityId: 0, selectedChoiceIds: [...selected], isCorrect, timeSpent: elapsed });
    getAiExplanation();
  }

  function next() {
    if (isLast) { setPhase("result"); return; }
    setCurrent((c) => c + 1); setSelected(new Set()); setPhase("quiz"); setAiExplanation("");
  }

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!q) return;
    if (phase === "quiz") {
      const idx = ["1","2","3","4","5"].indexOf(e.key);
      if (idx !== -1 && q.choices[idx]) setSelected((p) => { const n = new Set(p); n.has(q.choices[idx].id) ? n.delete(q.choices[idx].id) : n.add(q.choices[idx].id); return n; });
      if (e.key === "Enter" && selected.size > 0) confirm();
    }
    if (phase === "revealed" && e.key === "Enter") next();
  }, [phase, selected, q]);

  useEffect(() => { window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }, [handleKey]);

  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - (touchStartY.current ?? 0);
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && dx < -50 && phase === "revealed") next();
    touchStartX.current = null;
  }

  const mins = Math.floor(elapsed / 60); const secs = elapsed % 60;
  const progress = ((current + (phase !== "quiz" ? 1 : 0)) / Math.max(1, questions.length)) * 100;
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Analyse de vos erreurs...</p>
      </div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="text-center space-y-3">
        <Target className="w-10 h-10 text-zinc-600 mx-auto" />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Connectez-vous pour accéder à la révision ciblée</p>
        <a href="/auth" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 transition-all">Se connecter</a>
      </div>
    </div>
  );

  if (noWeakQ) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="text-center space-y-4 max-w-xs">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <CheckCircle className="w-7 h-7 text-emerald-400" />
        </div>
        <div>
          <p className="text-base font-bold" style={{ color: "var(--text)" }}>Aucune question faible !</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Vous n\'avez pas encore de questions ratées 2 fois ou plus dans ce module. Continuez à pratiquer !
          </p>
        </div>
        <button onClick={() => router.back()} className="px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-100 transition-all">Retour</button>
      </div>
    </div>
  );

  if (phase === "result") {
    const color = pct >= 70 ? "emerald" : pct >= 50 ? "amber" : "red";
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm text-center space-y-5">
          <div className={cn("w-16 h-16 rounded-2xl mx-auto flex items-center justify-center", color === "emerald" ? "bg-emerald-500/10 border border-emerald-500/30" : color === "amber" ? "bg-amber-500/10 border border-amber-500/30" : "bg-red-500/10 border border-red-500/30")}>
            <Trophy className={cn("w-8 h-8", color === "emerald" ? "text-emerald-400" : color === "amber" ? "text-amber-400" : "text-red-400")} />
          </div>
          <div>
            <p className="text-5xl font-bold" style={{ color: "var(--text)" }}>{pct}%</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{score.correct}/{score.total} · {mins}:{secs.toString().padStart(2,"0")}</p>
            <p className="text-xs mt-0.5 text-orange-400">Révision ciblée</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setCurrent(0); setSelected(new Set()); setPhase("quiz"); setScore({correct:0,total:0}); setElapsed(0); setAiExplanation(""); }} className="flex-1 py-3.5 rounded-xl text-sm font-semibold border transition-all hover:bg-white/[0.04]" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Recommencer</button>
            <button onClick={() => router.back()} className="flex-1 py-3.5 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 transition-all">Terminer</button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="min-h-screen flex flex-col select-none" style={{ background: "var(--bg)" }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" style={{ color: "var(--text-muted)" }}><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex items-center gap-2">
          {score.total > 0 && (
            <span className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border", pct >= 70 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : pct >= 50 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-red-400 bg-red-500/10 border-red-500/20")}>
              <Check className="w-3 h-3" />{score.correct}/{score.total}
            </span>
          )}
          <span className="text-xs font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-1">Révision ciblée</span>
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}><Timer className="w-3.5 h-3.5" />{mins}:{secs.toString().padStart(2,"0")}</div>
      </div>
      {/* Progress */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,165,0,0.1)" }}>
            <motion.div className="h-full rounded-full" style={{ background: "#f97316" }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
          </div>
          <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{current+1}/{questions.length}</span>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 flex flex-col justify-between px-4 py-3 md:items-center overflow-y-auto">
        <div className="w-full md:max-w-xl space-y-3">
          <AnimatePresence mode="wait">
            <motion.div key={current} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="space-y-3">
              <div className="rounded-2xl border px-5 py-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text)" }}>{q.texte}</p>
                {q.image_url && <img src={q.image_url} alt="" className="mt-3 w-full max-h-48 object-contain rounded-xl" />}
                {phase === "quiz" && <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>{q.choices.filter(c=>c.est_correct).length > 1 ? `${q.choices.filter(c=>c.est_correct).length} réponses correctes` : "1 réponse correcte"}</p>}
              </div>
              <div className="space-y-2">
                {q.choices.map((choice, idx) => {
                  const isSel = selected.has(choice.id); const correct = choice.est_correct; const reveal = phase === "revealed";
                  return (
                    <motion.button key={choice.id} onClick={() => phase === "quiz" && setSelected((p) => { const n = new Set(p); n.has(choice.id) ? n.delete(choice.id) : n.add(choice.id); return n; })} disabled={phase === "revealed"} whileTap={{ scale: phase === "quiz" ? 0.99 : 1 }}
                      className="w-full text-left rounded-xl px-4 py-3 border transition-all"
                      style={{ background: reveal && correct ? "rgba(16,185,129,0.07)" : reveal && isSel && !correct ? "rgba(239,68,68,0.07)" : isSel ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)", borderColor: reveal && correct ? "rgba(16,185,129,0.35)" : reveal && isSel && !correct ? "rgba(239,68,68,0.35)" : isSel ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.06)" }}>
                      <div className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 border" style={{ background: isSel ? "white" : "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: isSel ? "black" : "var(--text-muted)" }}>{String.fromCharCode(65+idx)}</span>
                        <p className="text-sm flex-1 leading-relaxed" style={{ color: reveal && correct ? "#34d399" : reveal && isSel && !correct ? "#f87171" : "var(--text)" }}>{choice.contenu}</p>
                        {reveal && (correct ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" /> : isSel ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /> : null)}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              {phase === "revealed" && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border px-5 py-4 space-y-2" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-2"><Brain className="w-3.5 h-3.5 text-blue-400" /><span className="text-xs font-semibold text-blue-400">Explication IA</span>{aiLoading && <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div>}</div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{aiExplanation || (!aiLoading ? "Ajoutez votre clé IA dans les paramètres." : "")}{aiLoading && <span className="inline-block w-0.5 h-3 bg-zinc-500 animate-pulse ml-0.5 align-middle" />}</p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="w-full md:max-w-xl pt-4">
          {phase === "quiz" ? (
            <button onClick={confirm} disabled={!selected.size} className={cn("w-full py-4 rounded-2xl text-sm font-semibold transition-all", selected.size > 0 ? "bg-white text-black hover:bg-zinc-100" : "cursor-not-allowed")} style={{ background: selected.size > 0 ? "white" : "rgba(255,255,255,0.04)", color: selected.size > 0 ? "black" : "var(--text-muted)" }}>Confirmer</button>
          ) : (
            <button onClick={next} className="w-full py-4 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 transition-all flex items-center justify-center gap-2">{isLast ? "Voir les résultats" : "Suivant"}<ChevronRight className="w-4 h-4" /></button>
          )}
        </div>
      </div>
    </div>
  );
}
