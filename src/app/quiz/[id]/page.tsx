"use client";
import { use, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CheckCircle, XCircle, ChevronRight, Timer,
  Trophy, Brain, MessageCircle, Send, User, Check, Eye, RefreshCw
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase, getActivityWithQuestions, submitAnswer, getComments, addComment } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

type QuizComment = {
  id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  user_id: string;
  profiles: { username: string | null; avatar_url?: string | null } | null;
  comment_likes?: { user_id: string }[];
};

type Choice = {
  id: string; id_choix: number; contenu: string;
  est_correct: boolean; pourcentage: number; explication: string | null;
};
type Question = {
  id: string; texte: string; image_url: string | null;
  source_question: string | null; source_type: string;
  correction: string | null; choices: Choice[];
};
// "quiz"      = selecting answers
// "confirmed" = answer locked in, awaiting "Voir correction"
// "revealed"  = correction shown
// "result"    = end screen
type Phase = "quiz" | "confirmed" | "revealed" | "result";

type OptionExplanation = { letter: string; contenu: string; est_correct: boolean; why: string };
type ParsedAiExplanation = OptionExplanation[] | null;

function parseExplanation(raw: string): ParsedAiExplanation {
  // Try to parse structured option-by-option format:
  // "A) ... ✓/✗ because ..."  or JSON array
  try {
    const parsed = JSON.parse(raw) as OptionExplanation[];
    if (Array.isArray(parsed) && parsed[0]?.letter) return parsed;
  } catch { /* not JSON */ }
  return null;
}

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
  const [confirmedCount, setConfirmedCount] = useState(0); // how many Qs the user confirmed
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [aiExplanation, setAiExplanation] = useState("");
  const [parsedExplanation, setParsedExplanation] = useState<ParsedAiExplanation>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [cachedExplanation, setCachedExplanation] = useState<string | null>(null); // from DB
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<QuizComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentAnon, setCommentAnon] = useState(false);

  // Swipe support
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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

  // Fetch cached explanation when question changes
  useEffect(() => {
    setCachedExplanation(null);
    setAiExplanation("");
    setParsedExplanation(null);
    if (!q) return;
    supabase
      .from("ai_explanations")
      .select("explanation")
      .eq("question_id", q.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.explanation) setCachedExplanation(data.explanation);
      });
  }, [q?.id]);

  // AI explanation stream
  async function getAiExplanation(forceNew = false) {
    if (!q) return;
    // Use cache unless forcing new
    if (!forceNew && cachedExplanation) {
      setAiExplanation(cachedExplanation);
      setParsedExplanation(parseExplanation(cachedExplanation));
      return;
    }
    setAiLoading(true);
    setAiExplanation("");
    setParsedExplanation(null);
    const aiKey = localStorage.getItem("fmpc-ai-key") ?? "";
    const aiModel = localStorage.getItem("fmpc-ai-model") ?? "gemini-2.0-flash";
    const optionLines = q.choices.map((c, i) =>
      `${String.fromCharCode(65 + i)}) ${c.contenu} — ${c.est_correct ? "CORRECTE" : "incorrecte"}`
    ).join("\n");
    const prompt = `Tu es un tuteur en médecine FMPC. Pour la question suivante, explique CHAQUE option (A, B, C…) en une phrase courte: pourquoi elle est correcte ou incorrecte. Réponds en JSON strict: [{"letter":"A","contenu":"…","est_correct":true,"why":"…"}, …]

Question: "${q.texte}"
Options:
${optionLines}

Règles: JSON uniquement, français, max 25 mots par why, commence par "Car " ou "Parce que ".`;
    let full = "";
    try {
      const res = await fetch("/api/ai-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: aiModel, key: aiKey }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { setAiLoading(false); return; }
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value);
        setAiExplanation(full);
      }
    } catch {
      full = "Erreur de connexion à l'IA. Vérifiez votre clé dans les paramètres.";
      setAiExplanation(full);
    }
    setAiLoading(false);
    // Parse and save to DB
    if (full && !full.startsWith("Erreur")) {
      const parsed = parseExplanation(full);
      if (parsed) setParsedExplanation(parsed);
      // Save to DB (upsert so next user gets it)
      supabase.from("ai_explanations").upsert({
        question_id: q.id,
        explanation: full,
        generated_by: user?.id ?? "anonymous",
        model_used: aiModel,
      }, { onConflict: "question_id" }).then(() => {
        setCachedExplanation(full);
      });
    }
  }

  async function loadComments() {
    if (!q) return;
    const data = await getComments(q.id);
    const normalized = (data ?? []).map((c: Record<string, unknown>) => ({
      ...c,
      profiles: Array.isArray(c.profiles) ? (c.profiles[0] ?? null) : (c.profiles ?? null),
    })) as QuizComment[];
    setComments(normalized);
  }

  async function postComment() {
    if (!user || !commentText.trim() || !q) return;
    await addComment({ questionId: q.id, userId: user.id, content: commentText, isAnonymous: commentAnon });
    setCommentText("");
    loadComments();
  }

  // CONFIRM: lock answer + score, move to "confirmed" (no correction yet)
  function confirm() {
    if (!q || selected.size === 0) return;
    const correctIds = new Set(q.choices.filter((c) => c.est_correct).map((c) => c.id));
    const isCorrect = selected.size === correctIds.size && [...selected].every((cid) => correctIds.has(cid));
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    setConfirmedCount((c) => c + 1);
    setPhase("confirmed");
    if (user) submitAnswer({
      userId: user.id, questionId: q.id, activityId,
      selectedChoiceIds: [...selected], isCorrect, timeSpent: elapsed,
    });
  }

  // REVEAL CORRECTION: show the correct answers + AI explanation
  function revealCorrection() {
    setPhase("revealed");
    getAiExplanation();
  }

  function next() {
    if (isLast) { setPhase("result"); return; }
    setCurrent((c) => c + 1);
    setSelected(new Set());
    setPhase("quiz");
    setAiExplanation("");
    setParsedExplanation(null);
    setCommentsOpen(false);
  }

  // Keyboard shortcuts
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!q) return;
    if (phase === "quiz") {
      const idx = ["1", "2", "3", "4", "5"].indexOf(e.key);
      if (idx !== -1 && q.choices[idx]) {
        setSelected((prev) => {
          const n = new Set(prev);
          n.has(q.choices[idx].id) ? n.delete(q.choices[idx].id) : n.add(q.choices[idx].id);
          return n;
        });
      }
      if ((e.key === "Enter" || e.key === " ") && selected.size > 0) confirm();
    }
    if (phase === "confirmed" && (e.key === "c" || e.key === "C")) revealCorrection();
    if (phase === "confirmed" && (e.key === "Enter" || e.key === "ArrowRight" || e.key === " ")) next();
    if (phase === "revealed" && (e.key === "Enter" || e.key === "ArrowRight" || e.key === " ")) next();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected, q]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Touch / swipe
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 50) {
      if (dx < 0 && (phase === "confirmed" || phase === "revealed")) next();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  // Progress = confirmed questions (not revealed)
  const progress = (confirmedCount / Math.max(1, questions.length)) * 100;
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="space-y-3 text-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chargement...</p>
      </div>
    </div>
  );

  if (phase === "result") {
    const color = pct >= 70 ? "emerald" : pct >= 50 ? "amber" : "red";
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm text-center space-y-5">
          <div className={cn("w-16 h-16 rounded-2xl mx-auto flex items-center justify-center",
            color === "emerald" ? "bg-emerald-500/10 border border-emerald-500/30" :
            color === "amber" ? "bg-amber-500/10 border border-amber-500/30" :
            "bg-red-500/10 border border-red-500/30")}>
            <Trophy className={cn("w-8 h-8",
              color === "emerald" ? "text-emerald-400" : color === "amber" ? "text-amber-400" : "text-red-400")} />
          </div>
          <div>
            <p className="text-5xl font-bold" style={{ color: "var(--text)" }}>{pct}%</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {score.correct}/{score.total} correctes · {mins}:{secs.toString().padStart(2, "0")}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{activityName}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setCurrent(0); setSelected(new Set()); setPhase("quiz"); setScore({ correct: 0, total: 0 }); setConfirmedCount(0); setElapsed(0); setAiExplanation(""); }}
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

  const showReveal = phase === "revealed";
  const showConfirmed = phase === "confirmed";

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{ background: "var(--bg)" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 md:px-8">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          {score.total > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border",
                pct >= 70 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                pct >= 50 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                "text-red-400 bg-red-500/10 border-red-500/20"
              )}>
              <Check className="w-3 h-3" />
              {score.correct}/{score.total}
            </motion.div>
          )}
          <p className="text-xs font-medium max-w-[140px] truncate" style={{ color: "var(--text-muted)" }}>
            {activityName}
          </p>
        </div>

        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          <Timer className="w-3.5 h-3.5" />
          {mins}:{secs.toString().padStart(2, "0")}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="px-4 md:px-8 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
            {confirmedCount}/{questions.length}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col justify-between px-4 py-3 md:px-8 md:items-center overflow-y-auto">
        <div className="w-full md:max-w-xl lg:max-w-2xl space-y-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* Question card */}
              <div className="rounded-2xl border px-5 py-4 space-y-3"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                {q.source_question && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-0.5">
                      {q.source_question}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      {q.source_type}
                    </span>
                  </div>
                )}
                <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text)" }}>{q.texte}</p>
                {q.image_url && (
                  <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={q.image_url} alt="Illustration"
                      className="w-full max-h-52 object-contain"
                      style={{ background: "rgba(0,0,0,0.4)" }}
                    />
                  </div>
                )}
                {/* No hint about how many correct answers — student figures it out */}
              </div>

              {/* Choices */}
              <div className="space-y-2">
                {q.choices.map((choice, idx) => {
                  const isSel = selected.has(choice.id);
                  const correct = choice.est_correct;

                  // Only show green/red when correction is revealed
                  const borderColor = showReveal && correct
                    ? "rgba(16,185,129,0.35)"
                    : showReveal && isSel && !correct
                    ? "rgba(239,68,68,0.35)"
                    : (showConfirmed || showReveal) && isSel
                    ? "rgba(255,255,255,0.18)"
                    : !showReveal && !showConfirmed && isSel
                    ? "rgba(255,255,255,0.25)"
                    : "rgba(255,255,255,0.06)";

                  const bg = showReveal && correct
                    ? "rgba(16,185,129,0.07)"
                    : showReveal && isSel && !correct
                    ? "rgba(239,68,68,0.07)"
                    : (showConfirmed || showReveal) && isSel
                    ? "rgba(255,255,255,0.05)"
                    : !showReveal && !showConfirmed && isSel
                    ? "rgba(255,255,255,0.07)"
                    : "rgba(255,255,255,0.02)";

                  // Find the per-option AI explanation
                  const optionWhy = parsedExplanation?.find(
                    (o) => o.letter === String.fromCharCode(65 + idx)
                  )?.why;

                  return (
                    <motion.button
                      key={choice.id}
                      onClick={() => phase === "quiz" && setSelected((prev) => {
                        const n = new Set(prev);
                        n.has(choice.id) ? n.delete(choice.id) : n.add(choice.id);
                        return n;
                      })}
                      disabled={phase !== "quiz"}
                      whileTap={{ scale: phase === "quiz" ? 0.99 : 1 }}
                      className="w-full text-left rounded-xl px-4 py-3 border transition-all"
                      style={{ background: bg, borderColor }}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 border transition-all"
                          style={{
                            background: showReveal && correct ? "rgba(16,185,129,0.2)"
                              : showReveal && isSel && !correct ? "rgba(239,68,68,0.2)"
                              : isSel ? "white" : "rgba(255,255,255,0.04)",
                            borderColor: showReveal && correct ? "rgba(16,185,129,0.4)"
                              : showReveal && isSel && !correct ? "rgba(239,68,68,0.4)"
                              : "rgba(255,255,255,0.08)",
                            color: showReveal && correct ? "#34d399"
                              : showReveal && isSel && !correct ? "#f87171"
                              : isSel ? "black" : "var(--text-muted)",
                          }}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <p className="text-sm leading-relaxed"
                            style={{ color: showReveal && correct ? "#34d399" : showReveal && isSel && !correct ? "#f87171" : "var(--text)" }}>
                            {choice.contenu}
                          </p>
                          {/* Per-option AI explanation */}
                          {showReveal && optionWhy && (
                            <motion.p initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
                              className="text-[11px] leading-relaxed italic"
                              style={{ color: correct ? "rgba(52,211,153,0.75)" : "rgba(161,161,170,0.7)" }}>
                              {optionWhy}
                            </motion.p>
                          )}
                          {/* Inline explication from DB if no structured AI yet */}
                          {showReveal && !optionWhy && choice.explication && (
                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                              {choice.explication}
                            </motion.p>
                          )}
                          {showReveal && (
                            <div className="flex items-center gap-2">
                              <div className="h-0.5 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${choice.pourcentage}%`, background: correct ? "#10b981" : "#52525b" }} />
                              </div>
                              <span className="text-[10px] w-8 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>
                                {choice.pourcentage}%
                              </span>
                            </div>
                          )}
                        </div>
                        {showReveal && (
                          correct
                            ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            : isSel ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /> : null
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* AI Explanation panel — only after correction revealed */}
              {showReveal && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border px-5 py-4 space-y-3"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs font-semibold text-blue-400">Explication IA</span>
                      {aiLoading && (
                        <div className="flex gap-1 ml-1">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      )}
                      {cachedExplanation && !aiLoading && (
                        <span className="text-[10px] text-zinc-500 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5">
                          Sauvegardée
                        </span>
                      )}
                    </div>
                    {/* Regenerate option — only if cached exists */}
                    {cachedExplanation && !aiLoading && (
                      <button
                        onClick={() => getAiExplanation(true)}
                        className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">
                        <RefreshCw className="w-3 h-3" /> Régénérer
                      </button>
                    )}
                  </div>

                  {/* Structured per-option display */}
                  {parsedExplanation && !aiLoading ? (
                    <div className="space-y-2">
                      {parsedExplanation.map((opt) => (
                        <div key={opt.letter}
                          className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                          style={{
                            background: opt.est_correct
                              ? "rgba(16,185,129,0.06)"
                              : "rgba(255,255,255,0.02)",
                            border: `1px solid ${opt.est_correct ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)"}`,
                          }}>
                          <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{
                              background: opt.est_correct ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)",
                              color: opt.est_correct ? "#34d399" : "var(--text-muted)",
                            }}>
                            {opt.letter}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] leading-relaxed"
                              style={{ color: opt.est_correct ? "#34d399" : "var(--text-secondary)" }}>
                              {opt.why}
                            </p>
                          </div>
                          {opt.est_correct
                            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                            : <XCircle className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5" />}
                        </div>
                      ))}
                    </div>
                  ) : aiExplanation ? (
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {aiExplanation}
                      {aiLoading && <span className="inline-block w-0.5 h-3 bg-zinc-500 animate-pulse ml-0.5 align-middle" />}
                    </p>
                  ) : !aiLoading ? (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Configuration IA manquante — ajoutez votre clé dans les Paramètres.
                    </p>
                  ) : null}
                </motion.div>
              )}

              {/* Comments */}
              {showReveal && (
                <button
                  onClick={() => { setCommentsOpen(!commentsOpen); if (!commentsOpen) loadComments(); }}
                  className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border text-sm transition-all hover:bg-white/[0.04]"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  <MessageCircle className="w-4 h-4" />
                  {commentsOpen ? "Masquer les commentaires" : "Commentaires"}
                  {comments.length > 0 && !commentsOpen && (
                    <span className="ml-auto text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-lg">
                      {comments.length}
                    </span>
                  )}
                </button>
              )}

              {commentsOpen && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  {user && (
                    <div className="p-4 border-b space-y-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <textarea
                        value={commentText} onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Votre commentaire..." rows={2}
                        className="w-full text-sm rounded-xl px-3 py-2 border resize-none focus:outline-none transition-colors"
                        style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "var(--text)" }}
                      />
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
                  <div className="divide-y max-h-52 overflow-y-auto" style={{ background: "var(--surface)" }}>
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
                              {c.is_anonymous ? "Anonyme" : (c.profiles?.username ?? "Utilisateur")}
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

        {/* ── Action buttons ── */}
        <div className="w-full md:max-w-xl lg:max-w-2xl pt-4 space-y-2">
          {phase === "quiz" ? (
            <button
              onClick={confirm} disabled={selected.size === 0}
              className={cn(
                "w-full py-4 rounded-2xl text-sm font-semibold transition-all",
                selected.size > 0 ? "bg-white text-black hover:bg-zinc-100 active:bg-zinc-200" : "cursor-not-allowed"
              )}
              style={{
                background: selected.size > 0 ? "white" : "rgba(255,255,255,0.04)",
                color: selected.size > 0 ? "black" : "var(--text-muted)",
              }}>
              Confirmer
            </button>
          ) : phase === "confirmed" ? (
            <div className="flex gap-2">
              <button
                onClick={revealCorrection}
                className="flex-1 py-4 rounded-2xl text-sm font-semibold border transition-all hover:bg-white/[0.06] flex items-center justify-center gap-2"
                style={{ borderColor: "rgba(255,255,255,0.2)", color: "var(--text)" }}>
                <Eye className="w-4 h-4" />
                Voir correction
              </button>
              <button onClick={next}
                className="flex-1 py-4 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 active:bg-zinc-200 transition-all flex items-center justify-center gap-2">
                {isLast ? "Résultats" : "Suivant"}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={next}
              className="w-full py-4 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 active:bg-zinc-200 transition-all flex items-center justify-center gap-2">
              {isLast ? "Voir les résultats" : "Suivant"}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <p className="text-center text-[10px] hidden lg:block" style={{ color: "var(--text-muted)" }}>
            1–5 choisir · Espace confirmer · C voir correction · → suivant
          </p>
          {(phase === "confirmed" || phase === "revealed") && (
            <p className="text-center text-[10px] lg:hidden" style={{ color: "var(--text-muted)" }}>
              ← Glisser à gauche pour continuer
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
