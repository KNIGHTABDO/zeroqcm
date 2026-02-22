"use client";
import { use, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle, XCircle, ChevronRight, Timer, Trophy, Brain, MessageCircle, Send, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase, getActivityWithQuestions, submitAnswer, getComments, addComment } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import Image from "next/image";

type Choice = { id: string; id_choix: number; contenu: string; est_correct: boolean; pourcentage: number; explication: string | null; };
type Question = { id: string; texte: string; image_url: string | null; source_question: string | null; source_type: string; correction: string | null; choices: Choice[]; };
type Phase = "quiz" | "revealed" | "result";

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const activityId = parseInt(id);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [activityName, setActivityName] = useState("");
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>("quiz");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [aiExplanation, setAiExplanation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<{ id: string; content: string; is_anonymous: boolean; created_at: string; profiles: { username: string | null; } | null }[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentAnon, setCommentAnon] = useState(false);

  useEffect(() => {
    async function load() {
      const { activity, questions: qs } = await getActivityWithQuestions(activityId);
      setActivityName(activity?.nom ?? "QCM");
      setQuestions(qs as Question[]);
      setLoading(false);
    }
    load();
  }, [activityId]);

  const q = questions[current];
  const isLast = current === questions.length - 1;

  // Timer
  useEffect(() => {
    if (phase === "result" || loading) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase, loading]);

  // AI explanation
  async function getAiExplanation() {
    if (!q) return;
    setAiLoading(true);
    setAiExplanation("");
    const aiKey = localStorage.getItem("fmpc-ai-key") ?? "";
    const aiModel = localStorage.getItem("fmpc-ai-model") ?? "gemini-2.0-flash";
    const correctChoices = q.choices.filter((c) => c.est_correct).map((c) => c.contenu).join(", ");
    const prompt = `Question de médecine FMPC: "${q.texte}"\nRéponses correctes: ${correctChoices}\nExplique en français de façon claire et concise (max 150 mots) pourquoi ces réponses sont correctes.`;
    try {
      const res = await fetch("/api/ai-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: aiModel, key: aiKey }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiExplanation((prev) => prev + decoder.decode(value));
      }
    } catch {
      setAiExplanation("Erreur lors de la connexion à l\'IA. Vérifiez votre clé dans les paramètres.");
    }
    setAiLoading(false);
  }

  // Comments
  async function loadComments() {
    if (!q) return;
    const data = await getComments(q.id);
    setComments(data as typeof comments);
  }

  async function postComment() {
    if (!user || !commentText.trim() || !q) return;
    await addComment({ questionId: q.id, userId: user.id, content: commentText, isAnonymous: commentAnon });
    setCommentText("");
    loadComments();
  }

  // Keyboard
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!q) return;
    if (phase === "quiz") {
      const idx = ["1","2","3","4","5"].indexOf(e.key);
      if (idx !== -1 && q.choices[idx]) {
        setSelected((prev) => {
          const next = new Set(prev);
          next.has(q.choices[idx].id) ? next.delete(q.choices[idx].id) : next.add(q.choices[idx].id);
          return next;
        });
      }
      if (e.key === "Enter" && selected.size > 0) confirm();
    }
    if (phase === "revealed" && (e.key === "Enter" || e.key === "ArrowRight")) next();
  }, [phase, selected, q]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  function confirm() {
    if (!q || selected.size === 0) return;
    const correctIds = new Set(q.choices.filter((c) => c.est_correct).map((c) => c.id));
    const isCorrect = selected.size === correctIds.size && [...selected].every((id) => correctIds.has(id));
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    setPhase("revealed");
    if (user) submitAnswer({ userId: user.id, questionId: q.id, activityId, selectedChoiceIds: [...selected], isCorrect, timeSpent: elapsed });
    getAiExplanation();
  }

  function next() {
    if (isLast) { setPhase("result"); return; }
    setCurrent((c) => c + 1);
    setSelected(new Set());
    setPhase("quiz");
    setAiExplanation("");
    setCommentsOpen(false);
  }

  const progress = ((current + (phase === "revealed" ? 1 : 0)) / Math.max(1, questions.length)) * 100;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="space-y-4 text-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement des questions...</p>
      </div>
    </div>
  );

  if (phase === "result") {
    const color = pct >= 70 ? "emerald" : pct >= 50 ? "amber" : "red";
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm space-y-6 text-center">
          <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center
            ${color === "emerald" ? "bg-emerald-500/10 border border-emerald-500/30" : color === "amber" ? "bg-amber-500/10 border border-amber-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
            <Trophy className={`w-8 h-8 ${color === "emerald" ? "text-emerald-400" : color === "amber" ? "text-amber-400" : "text-red-400"}`} />
          </div>
          <div>
            <p className="text-4xl font-bold" style={{ color: "var(--text)" }}>{pct}%</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {score.correct}/{score.total} correctes · {mins}:{secs.toString().padStart(2, "0")}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{activityName}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setCurrent(0); setSelected(new Set()); setPhase("quiz"); setScore({correct:0,total:0}); setElapsed(0); setAiExplanation(""); }}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold border transition-all hover:bg-white/[0.04]"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}>
              Recommencer
            </button>
            <button onClick={() => router.back()}
              className="flex-1 py-3.5 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 transition-all">
              Terminer
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 md:px-8">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{activityName}</p>
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          <Timer className="w-3.5 h-3.5" />
          {mins}:{secs.toString().padStart(2, "0")}
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 md:px-8">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div className="h-full bg-blue-500 rounded-full"
              animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
          </div>
          <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
            {current + 1}/{questions.length}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between px-4 py-4 md:px-8 md:items-center overflow-y-auto">
        <div className="w-full md:max-w-xl lg:max-w-2xl space-y-4">
          <AnimatePresence mode="wait">
            <motion.div key={current} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22 }} className="space-y-3">

              {/* Question */}
              <div className="rounded-2xl px-5 py-4 border space-y-3"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                {q.source_question && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-0.5">
                      {q.source_question}
                    </span>
                    {q.source_type === "qcm" && (
                      <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>QCM</span>
                    )}
                  </div>
                )}
                <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text)" }}>{q.texte}</p>
                {q.image_url && (
                  <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={q.image_url} alt="Question illustration" className="w-full max-h-48 object-contain"
                      style={{ background: "var(--surface)" }} />
                  </div>
                )}
                {phase === "quiz" && (
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Sélectionnez toutes les réponses correctes · {q.choices.filter(c => c.est_correct).length} attendue(s)
                  </p>
                )}
              </div>

              {/* Choices */}
              <div className="space-y-2">
                {q.choices.map((choice, idx) => {
                  const isSelected = selected.has(choice.id);
                  const correct = choice.est_correct;
                  const reveal = phase === "revealed";

                  let borderStyle = "border-white/[0.06]";
                  let bgStyle = "rgba(255,255,255,0.02)";
                  if (reveal && correct) { borderStyle = "rgba(16,185,129,0.3)"; bgStyle = "rgba(16,185,129,0.08)"; }
                  else if (reveal && isSelected && !correct) { borderStyle = "rgba(239,68,68,0.3)"; bgStyle = "rgba(239,68,68,0.08)"; }
                  else if (!reveal && isSelected) { borderStyle = "rgba(255,255,255,0.2)"; bgStyle = "rgba(255,255,255,0.08)"; }

                  return (
                    <motion.button key={choice.id}
                      onClick={() => phase === "quiz" && setSelected((prev) => {
                        const n = new Set(prev); n.has(choice.id) ? n.delete(choice.id) : n.add(choice.id); return n;
                      })}
                      disabled={phase === "revealed"}
                      whileTap={{ scale: phase === "quiz" ? 0.99 : 1 }}
                      className="w-full text-left rounded-xl px-4 py-3 border transition-all"
                      style={{ background: bgStyle, borderColor: borderStyle }}>
                      <div className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-lg text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 border transition-all"
                          style={{
                            background: reveal && correct ? "rgba(16,185,129,0.2)" : reveal && isSelected && !correct ? "rgba(239,68,68,0.2)" : isSelected ? "white" : "rgba(255,255,255,0.04)",
                            borderColor: reveal && correct ? "rgba(16,185,129,0.3)" : reveal && isSelected && !correct ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)",
                            color: reveal && correct ? "#34d399" : reveal && isSelected && !correct ? "#f87171" : isSelected ? "black" : "var(--text-muted)",
                          }}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <p className="text-sm leading-relaxed" style={{ color: reveal && correct ? "#34d399" : reveal && isSelected && !correct ? "#f87171" : "var(--text)" }}>
                            {choice.contenu}
                          </p>
                          {reveal && choice.explication && (
                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                              {choice.explication}
                            </motion.p>
                          )}
                          {reveal && (
                            <div className="flex items-center gap-2">
                              <div className="h-0.5 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${choice.pourcentage}%`, background: correct ? "#10b981" : "#52525b" }} />
                              </div>
                              <span className="text-[10px] w-8 text-right" style={{ color: "var(--text-muted)" }}>{choice.pourcentage}%</span>
                            </div>
                          )}
                        </div>
                        {reveal && (correct ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" /> : isSelected ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /> : null)}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* AI Explanation (shows after reveal) */}
              {phase === "revealed" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl px-5 py-4 border space-y-2"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400">Explication IA</span>
                    {aiLoading && (
                      <div className="flex gap-1 ml-1">
                        {[0,1,2].map((i) => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse"
                            style={{ animationDelay: `${i * 0.2}s` }} />
                        ))}
                      </div>
                    )}
                  </div>
                  {aiExplanation ? (
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {aiExplanation}
                      {aiLoading && <span className="inline-block w-0.5 h-3.5 bg-zinc-400 animate-pulse ml-0.5 align-middle" />}
                    </p>
                  ) : !aiLoading ? (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Explication non disponible</p>
                  ) : null}
                </motion.div>
              )}

              {/* Comments toggle */}
              {phase === "revealed" && (
                <button onClick={() => { setCommentsOpen(!commentsOpen); if (!commentsOpen) loadComments(); }}
                  className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border text-sm transition-all hover:bg-white/[0.04]"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  <MessageCircle className="w-4 h-4" />
                  <span>{commentsOpen ? "Masquer les commentaires" : "Voir les commentaires"}</span>
                </button>
              )}

              {/* Comments section */}
              {commentsOpen && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  {/* Add comment */}
                  {user && (
                    <div className="p-4 border-b space-y-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Votre commentaire..."
                        rows={2}
                        className="w-full text-sm rounded-xl px-3 py-2 border resize-none focus:outline-none transition-colors"
                        style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "var(--text)" }} />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                          <input type="checkbox" checked={commentAnon} onChange={(e) => setCommentAnon(e.target.checked)} className="w-3 h-3" />
                          Anonyme
                        </label>
                        <button onClick={postComment}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-xs font-medium transition-all">
                          <Send className="w-3 h-3" /> Envoyer
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Comments list */}
                  <div className="divide-y max-h-48 overflow-y-auto" style={{ divideColor: "var(--border)", background: "var(--surface)" }}>
                    {comments.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>Soyez le premier à commenter</p>
                    ) : comments.map((c) => (
                      <div key={c.id} className="flex gap-3 px-4 py-3">
                        <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
                              {c.is_anonymous ? "Anonyme" : c.profiles?.username ?? "Utilisateur"}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Action button */}
        <div className="w-full md:max-w-xl lg:max-w-2xl pt-4">
          {phase === "quiz" ? (
            <button onClick={confirm} disabled={selected.size === 0}
              className={cn("w-full py-3.5 rounded-2xl text-sm font-semibold transition-all",
                selected.size > 0 ? "bg-white text-black hover:bg-zinc-100" : "bg-white/[0.04] cursor-not-allowed")}
              style={{ color: selected.size > 0 ? "black" : "var(--text-muted)" }}>
              Confirmer
            </button>
          ) : (
            <button onClick={next}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 transition-all flex items-center justify-center gap-2">
              {isLast ? "Voir les résultats" : "Question suivante"}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <p className="text-center text-[10px] mt-2 hidden lg:block" style={{ color: "var(--text-muted)" }}>
            1–5 pour sélectionner · Entrée pour confirmer · → pour suivant
          </p>
        </div>
      </div>
    </div>
  );
}
