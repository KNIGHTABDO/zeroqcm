"use client";

import { use, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle, XCircle, ChevronRight, Timer, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// ── Demo question data (replace with Supabase fetch) ──────────────────────
const DEMO_QUESTIONS = [
  {
    id: "q1",
    texte: "1- La première côte :",
    source_question: "2024 Décembre",
    source_type: "qcm",
    choices: [
      { id: "c1a", contenu: "A- Est la côte la plus courte", est_correct: true, pourcentage: 91.24, explication: "VRAI — La première côte est la plus courte et la plus courbée des côtes." },
      { id: "c1b", contenu: "B- S'articule avec T1 et T2", est_correct: true, pourcentage: 72.10, explication: "VRAI — Elle s'articule par sa tête avec les corps de T1 uniquement." },
      { id: "c1c", contenu: "C- Présente deux sillons pour les vaisseaux sous-claviers", est_correct: true, pourcentage: 68.50, explication: "VRAI — On distingue le sillon de la veine en avant et celui de l'artère en arrière du tubercule scalène antérieur." },
      { id: "c1d", contenu: "D- A deux faces et deux bords comme les autres côtes", est_correct: false, pourcentage: 11.36, explication: "FAUX — Elle présente deux faces (supérieure et inférieure) et deux bords (externe et interne), différents des côtes typiques." },
      { id: "c1e", contenu: "E- Son cartilage s'articule avec le sternum", est_correct: true, pourcentage: 84.20, explication: "VRAI — Le cartilage de la 1ère côte s'articule directement avec le manubrium sternal." },
    ],
  },
  {
    id: "q2",
    texte: "2- Concernant le muscle grand pectoral :",
    source_question: "2023 Rattrapage",
    source_type: "qcm",
    choices: [
      { id: "c2a", contenu: "A- Il prend son origine sur la clavicule", est_correct: true, pourcentage: 88.0, explication: "VRAI — Le faisceau claviculaire naît du 1/3 médial de la clavicule." },
      { id: "c2b", contenu: "B- Il s'insère sur le tubercule majeur de l'humérus", est_correct: false, pourcentage: 22.0, explication: "FAUX — Il s'insère sur la crête du tubercule majeur (grand trochanter huméral)." },
      { id: "c2c", contenu: "C- Il réalise l'adduction du bras", est_correct: true, pourcentage: 91.0, explication: "VRAI — Le grand pectoral est adducteur, rotateur interne et fléchisseur du bras." },
      { id: "c2d", contenu: "D- Il est innervé par le nerf thoracique long", est_correct: false, pourcentage: 15.0, explication: "FAUX — Il est innervé par les nerfs pectoraux médial et latéral (non par le nerf thoracique long, qui innerve le grand dentelé)." },
    ],
  },
];

type Phase = "quiz" | "revealed" | "result";

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const questions = DEMO_QUESTIONS;
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>("quiz");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [allResults, setAllResults] = useState<{ questionId: string; correct: boolean }[]>([]);

  const q = questions[current];
  const isLast = current === questions.length - 1;

  // Timer
  useEffect(() => {
    if (phase === "result") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Keyboard shortcuts
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (phase === "quiz") {
      const idx = ["1","2","3","4","5"].indexOf(e.key);
      if (idx !== -1 && q.choices[idx]) {
        toggleChoice(q.choices[idx].id);
      }
      if (e.key === "Enter" && selected.size > 0) confirm();
    }
    if (phase === "revealed" && (e.key === "Enter" || e.key === "ArrowRight")) {
      next();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected, current]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  function toggleChoice(id: string) {
    if (phase !== "quiz") return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function confirm() {
    if (selected.size === 0) return;
    const correctIds = new Set(q.choices.filter((c) => c.est_correct).map((c) => c.id));
    const isCorrect =
      selected.size === correctIds.size &&
      [...selected].every((id) => correctIds.has(id));
    setAllResults((prev) => [...prev, { questionId: q.id, correct: isCorrect }]);
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    setPhase("revealed");
  }

  function next() {
    if (isLast) {
      setPhase("result");
    } else {
      setCurrent((c) => c + 1);
      setSelected(new Set());
      setPhase("quiz");
    }
  }

  const progress = ((current + (phase === "revealed" ? 1 : 0)) / questions.length) * 100;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  // ── RESULT SCREEN ──────────────────────────────────────────────────────
  if (phase === "result") {
    const pct = Math.round((score.correct / score.total) * 100);
    const color = pct >= 70 ? "emerald" : pct >= 50 ? "amber" : "red";
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="text-center space-y-2">
            <Trophy className={cn(
              "w-12 h-12 mx-auto",
              color === "emerald" ? "text-emerald-400" : color === "amber" ? "text-amber-400" : "text-red-400"
            )} />
            <h2 className="text-2xl font-bold">{pct}%</h2>
            <p className="text-sm text-zinc-500">
              {score.correct}/{score.total} correctes · {mins}:{secs.toString().padStart(2, "0")}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setCurrent(0); setSelected(new Set()); setPhase("quiz"); setScore({correct:0,total:0}); setElapsed(0); setAllResults([]); }}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-white transition-all"
            >
              Recommencer
            </button>
            <button
              onClick={() => router.back()}
              className="flex-1 py-3.5 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 transition-all"
            >
              Terminer
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── QUIZ SCREEN ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 md:px-8">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <Timer className="w-3.5 h-3.5" />
          {mins}:{secs.toString().padStart(2, "0")}
        </div>
        <span className="text-xs text-zinc-600 font-medium">
          {current + 1}/{questions.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-4 md:px-8">
        <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="flex-1 flex flex-col justify-center px-4 py-6 md:px-8 md:items-center">
        <div className="w-full md:max-w-xl lg:max-w-2xl space-y-4">

          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Question text */}
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-2xl px-5 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-0.5">
                    {q.source_question}
                  </span>
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wide">QCM</span>
                </div>
                <p className="text-sm font-medium text-white leading-relaxed">{q.texte}</p>
                {phase === "quiz" && (
                  <p className="text-[10px] text-zinc-700">Sélectionnez toutes les réponses correctes</p>
                )}
              </div>

              {/* Choices */}
              <div className="space-y-2">
                {q.choices.map((choice, idx) => {
                  const isSelected = selected.has(choice.id);
                  const isCorrect = choice.est_correct;
                  const showFeedback = phase === "revealed";

                  let bg = "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08]";
                  if (showFeedback && isCorrect) bg = "bg-emerald-500/10 border-emerald-500/30";
                  else if (showFeedback && isSelected && !isCorrect) bg = "bg-red-500/10 border-red-500/30";
                  else if (!showFeedback && isSelected) bg = "bg-white/[0.12] border-white/20";

                  return (
                    <motion.button
                      key={choice.id}
                      onClick={() => toggleChoice(choice.id)}
                      disabled={phase === "revealed"}
                      whileTap={{ scale: phase === "quiz" ? 0.98 : 1 }}
                      className={cn(
                        "w-full text-left bg-[#0d0d0d] border rounded-xl px-4 py-3 transition-all",
                        bg
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Letter badge */}
                        <span className={cn(
                          "w-5 h-5 rounded-lg text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 border transition-colors",
                          showFeedback && isCorrect ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                          showFeedback && isSelected && !isCorrect ? "bg-red-500/20 text-red-400 border-red-500/30" :
                          isSelected ? "bg-white text-black border-transparent" :
                          "bg-white/[0.04] text-zinc-500 border-white/[0.06]"
                        )}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <div className="flex-1 space-y-1">
                          <p className={cn(
                            "text-sm leading-relaxed",
                            showFeedback && isCorrect ? "text-emerald-300" :
                            showFeedback && isSelected && !isCorrect ? "text-red-300" :
                            "text-zinc-200"
                          )}>
                            {choice.contenu}
                          </p>
                          {/* Explanation on reveal */}
                          {showFeedback && choice.explication && (
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="text-xs text-zinc-500 leading-relaxed"
                            >
                              {choice.explication}
                            </motion.p>
                          )}
                          {/* % stat */}
                          {showFeedback && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="h-0.5 flex-1 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    isCorrect ? "bg-emerald-500" : "bg-zinc-600"
                                  )}
                                  style={{ width: `${choice.pourcentage}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-zinc-600 w-8 text-right">{choice.pourcentage}%</span>
                            </div>
                          )}
                        </div>
                        {showFeedback && (
                          isCorrect
                            ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            : isSelected
                              ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                              : null
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Action button */}
          <div className="pt-2">
            {phase === "quiz" ? (
              <button
                onClick={confirm}
                disabled={selected.size === 0}
                className={cn(
                  "w-full py-3.5 rounded-2xl text-sm font-semibold transition-all",
                  selected.size > 0
                    ? "bg-white text-black hover:bg-zinc-100 active:bg-zinc-200"
                    : "bg-white/[0.04] text-zinc-600 cursor-not-allowed"
                )}
              >
                Confirmer
              </button>
            ) : (
              <button
                onClick={next}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 active:bg-zinc-200 transition-all flex items-center justify-center gap-2"
              >
                {isLast ? "Voir les résultats" : "Question suivante"}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Keyboard hint (desktop) */}
          <p className="text-center text-[10px] text-zinc-800 hidden lg:block">
            Clés: 1-5 pour sélectionner · Entrée pour confirmer/suivant
          </p>
        </div>
      </div>
    </div>
  );
}
