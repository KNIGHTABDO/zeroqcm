"use client";
import { use, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CheckCircle, XCircle, Brain, MessageCircle, Send, RefreshCw, Loader2, Bookmark, BookmarkCheck, RotateCcw
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { QuizImage } from "@/components/ui/QuizImage";
import { RichText } from "@/components/ui/RichText";
import { supabase, getActivityWithQuestions, submitAnswer, getComments, addComment, toggleBookmark, isBookmarked } from "@/lib/supabase";
import { DuaaModal } from "@/components/ui/DuaaModal";
import { useAuth } from "@/components/auth/AuthProvider";

type QuizComment = {
  id: string; content: string; is_anonymous: boolean; created_at: string; user_id: string;
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
type Phase = "quiz" | "revealed" | "result";
type OptionExplanation = { letter: string; contenu: string; est_correct: boolean; why: string };
type ParsedAI = OptionExplanation[] | null;

function parseAI(raw: string): ParsedAI {
  try {
    let cleaned = raw.trim();
    // Strip markdown code block wrapper if present
    if (cleaned.startsWith("```")) {
      const firstNewline = cleaned.indexOf("\n");
      cleaned = firstNewline !== -1 ? cleaned.slice(firstNewline + 1) : cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, cleaned.lastIndexOf("```"));
    }
    cleaned = cleaned.trim();
    // If model added preamble text before the JSON array, find the actual array
    const arrayStart = cleaned.indexOf("[");
    if (arrayStart > 0) cleaned = cleaned.slice(arrayStart);
    const p = JSON.parse(cleaned) as OptionExplanation[];
    if (Array.isArray(p) && p.length > 0 && p[0]?.letter) return p;
  } catch {
    // not valid JSON yet (e.g. partial stream) — caller will retry on next chunk
  }
  return null;
}

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const activityId = parseInt(id);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [openQuestions, setOpenQuestions] = useState<Question[]>([]);
  const [readOpenQIds, setReadOpenQIds] = useState<Set<string>>(new Set());
  const [activityName, setActivityName] = useState("");
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>("quiz");
  const [answeredCount, setAnsweredCount] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [aiText, setAiText] = useState("");
  const [aiParsed, setAiParsed] = useState<ParsedAI>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCached, setAiCached] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  // history[index] = Set of choice ids the user selected at that question
  const [history, setHistory] = useState<Map<number, Set<string>>>(new Map());
  // session persistence
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [comments, setComments] = useState<QuizComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentAnon, setCommentAnon] = useState(false);

  const txRef = useRef<number | null>(null);
  const tyRef = useRef<number | null>(null);
  // #3: guard against double-submit (rapid click + keyboard combo)
  const submittedRef = useRef(false);

  useEffect(() => {
    async function loadData() {
      const { activity, questions: qs, openQuestions: oqs } = await getActivityWithQuestions(activityId);
      setActivityName(activity?.nom ?? "QCM");
      setQuestions(qs as Question[]);
      setOpenQuestions((oqs ?? []) as Question[]);

      // Restore incomplete session if one exists
      if (user && qs.length > 0) {
        const { data: session } = await supabase
          .from("quiz_sessions")
          .select("*")
          .eq("user_id", user.id)
          .eq("activity_id", activityId)
          .eq("completed", false)
          .maybeSingle();

        if (session) {
          const answersObj = (session.answers ?? {}) as Record<string, string[]>;
          const restoredHistory = new Map<number, Set<string>>();
          (qs as Question[]).forEach((q: Question, idx: number) => {
            if (answersObj[q.id]) restoredHistory.set(idx, new Set(answersObj[q.id]));
          });
          setHistory(restoredHistory);
          const idx = session.current_idx ?? 0;
          setCurrent(idx);
          setElapsed(session.time_elapsed ?? 0);
          setScore({ correct: session.score_correct ?? 0, total: session.score_total ?? 0 });
          setAnsweredCount(Object.keys(answersObj).length);
          const wasAnswered = answersObj[(qs as Question[])[idx]?.id];
          setPhase(wasAnswered ? "revealed" : "quiz");
          if (wasAnswered) setSelected(new Set(wasAnswered));
        }
      }
      setLoading(false);
    }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId, user]);

  const q = questions[current];
  const isLast = current === questions.length - 1;

  useEffect(() => {
    if (phase === "result" || loading) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase, loading]);

  // #47: Flush session (with current elapsed time) when the user closes/navigates away
  useEffect(() => {
    const handleUnload = () => {
      if (phase !== "result" && questions.length > 0) {
        // Use sendBeacon for reliable delivery on page unload
        const payload = {
          user_id: user?.id,
          activity_id: activityId,
          time_elapsed: elapsed,
        };
        navigator.sendBeacon("/api/quiz-session-ping", JSON.stringify(payload));
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, elapsed, questions.length, user?.id, activityId]);

  useEffect(() => {
    // Abort any in-flight AI request for the previous question
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAiLoading(false);
    setAiCached(null); setAiText(""); setAiParsed(null);
    if (!q) return;
    supabase.from("ai_explanations").select("explanation").eq("question_id", q.id).maybeSingle()
      .then(({ data }) => { if (data?.explanation) setAiCached(data.explanation); });
  }, [q?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // AbortController ref — cancels in-flight AI fetches when user navigates
  const aiAbortRef = useRef<AbortController | null>(null);

  // AI explanation is now triggered manually via the "Expliquer avec l'IA" button.
  // No auto-fetch on phase change. // eslint-disable-line react-hooks/exhaustive-deps

  async function doFetchAI(forceNew: boolean) {
    if (!q) return;
    // Cancel any previous in-flight request
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;

    if (!forceNew && aiCached) { setAiText(aiCached); setAiParsed(parseAI(aiCached)); return; }
    setAiLoading(true); setAiText(""); setAiParsed(null);
    // Read model from Supabase profile preferences (same source as settings page)
    // Falls back to gpt-5-mini if profile has no preference or model is unavailable
    let model = "gpt-5-mini";
    if (user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", user.id)
        .maybeSingle();
      const savedModel = (profileData?.preferences as Record<string, string> | null)?.ai_model;
      if (savedModel) {
        // Verify it's still a live model
        try {
          const ghRes = await fetch("/api/gh-models");
          if (ghRes.ok) {
            const liveModels: { id: string }[] = await ghRes.json();
            const liveIds = new Set(liveModels.map(m => m.id));
            model = liveIds.has(savedModel) ? savedModel : liveModels[0]?.id ?? "gpt-5-mini";
          }
        } catch { /* keep default */ }
      }
    }
    const opts = q.choices.map((c, i) =>
      String.fromCharCode(65 + i) + ") " + c.contenu + " [" + (c.est_correct ? "CORRECTE" : "INCORRECTE") + "]"
    ).join("\n");
    // Build a rich context for the AI
    const correctionCtx = q.correction ? "\n\nCorrection officielle : " + q.correction : "";
    const sourceCtx     = q.source_question ? " (source : " + q.source_question + ")" : "";
    const prompt =
      "## QCM Médical" + sourceCtx + "\n\n" +
      "**Question :** " + q.texte + "\n\n" +
      "**Options :**\n" + opts +
      correctionCtx +
      "\n\n## Consigne\n" +
      "Explique chaque option avec profondeur pédagogique maximale (mécanisme, physiopatho, formules si nécessaire, valeurs normales, pièges classiques, mnémotechniques).\n" +
      "Réponds UNIQUEMENT en JSON : [\"letter\":\"A\",\"contenu\":\"...\",\"est_correct\":true,\"why\":\"...\"},...]";
    const savedQ = q;
    let full = "";
    try {
      const res = await fetch("/api/ai-explain", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
        signal: controller.signal,
      });
      // Handle rate-limited or unauthorized responses before streaming
      if (!res.ok) {
        try {
          const errBody = await res.json();
          if (errBody?.error === "rate_limited") {
            setAiText(`⚠️ ${errBody.message ?? "Limite journalière atteinte. Réessaie demain."}`);
          } else if (errBody?.error === "unauthorized") {
            setAiText("⚠️ Connecte-toi pour utiliser l'explication IA.");
          } else {
            setAiText("⚠️ Explication indisponible — réessaie dans un moment.");
          }
        } catch {
          setAiText("⚠️ Explication indisponible — réessaie dans un moment.");
        }
        setAiLoading(false);
        return;
      }
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      if (!reader) { setAiLoading(false); return; }
      while (true) {
        if (controller.signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value);
        setAiText(full);
        const parsed = parseAI(full);
        if (parsed) setAiParsed(parsed);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // Still reset loading so the UI doesn't get stuck in spinner state
        setAiLoading(false);
        return;
      }
      full = "Erreur de connexion."; setAiText(full);
    }
    if (!controller.signal.aborted) {
      setAiLoading(false);
      if (!full) {
        // Empty stream — show a visible error so user knows what happened
        setAiText("Erreur: réponse vide (rate limit GitHub Models ou modèle indisponible). Réessayez dans quelques secondes.");
      } else if (!full.startsWith("Erreur")) {
        const parsed = parseAI(full);
        if (parsed) {
          setAiParsed(parsed);
          // Only save to DB if we got real explanations (not an empty [] from the model)
          supabase.from("ai_explanations").upsert(
            { question_id: savedQ.id, explanation: full, generated_by: user?.id ?? "anonymous", model_used: model },
            { onConflict: "question_id" }
          ).then(() => setAiCached(full));
        } else {
          // Model returned [] or unparseable text — show error instead of saving garbage
          setAiText("Erreur: le modèle n'a pas pu générer d'explication pour cette question. Réessayez.");
        }
      }
    }
  }


  // ── Session persistence ────────────────────────────────────────────────────
  function buildAnswersPayload(hist: Map<number, Set<string>>, qs: typeof questions) {
    const obj: Record<string, string[]> = {};
    hist.forEach((sel, idx) => {
      if (qs[idx]) obj[qs[idx].id] = [...sel];
    });
    return obj;
  }

  function saveSession(
    hist: Map<number, Set<string>>,
    idx: number,
    elapsedSec: number,
    sc: { correct: number; total: number },
    done: boolean
  ) {
    if (!user || !activityId || questions.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const answersPayload = buildAnswersPayload(hist, questions);
      await supabase.from("quiz_sessions").upsert({
        user_id: user.id,
        activity_id: activityId,
        answers: answersPayload,
        current_idx: idx,
        time_elapsed: elapsedSec,
        score_correct: sc.correct,
        score_total: sc.total,
        completed: done,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,activity_id" });
    }, 800); // debounce 800ms to avoid hammering on fast navigation
  }

    // lockAndScore: saves answer to history + scores it.
  // Returns { newHistory, newScore } so callers can use the FRESH values immediately
  // (avoids stale React state closure bugs in handleNext).
  function lockAndScore(): { newHistory: Map<number, Set<string>>; newScore: { correct: number; total: number } } {
    const newHistory = new Map(history);
    newHistory.set(current, new Set(selected));
    setHistory(newHistory);
    if (!q || selected.size === 0) return { newHistory, newScore: score };
    const correctIds = new Set(q.choices.filter((c) => c.est_correct).map((c) => c.id));
    const ok = selected.size === correctIds.size && [...selected].every((cid) => correctIds.has(cid));
    const newScore = { correct: score.correct + (ok ? 1 : 0), total: score.total + 1 };
    setScore(newScore);
    setAnsweredCount((n) => n + 1);
    if (user) submitAnswer({ userId: user.id, questionId: q.id, activityId, selectedChoiceIds: [...selected], isCorrect: ok, timeSpent: elapsed });
    saveSession(newHistory, current, elapsed, newScore, false);
    return { newHistory, newScore };
  }


  // ── Bookmarks ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !q) return;
    isBookmarked(user.id, q.id).then(setBookmarked);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, q?.id]);

  async function handleBookmark() {
    if (!user || !q || bookmarkLoading) return;
    setBookmarkLoading(true);
    const newState = await toggleBookmark(user.id, q.id);
    setBookmarked(newState);
    setBookmarkLoading(false);
  }

    async function loadComments() {
    if (!q) return;
    const data = await getComments(q.id);
    const norm = (data ?? []).map((c: Record<string, unknown>) => ({
      ...c, profiles: Array.isArray(c.profiles) ? (c.profiles[0] ?? null) : (c.profiles ?? null),
    })) as QuizComment[];
    setComments(norm);
  }

  async function postComment() {
    if (!user || !commentText.trim() || !q) return;
    await addComment({ questionId: q.id, userId: user.id, content: commentText, isAnonymous: commentAnon });
    setCommentText(""); loadComments();
  }

  function handleReveal() {
    if (!q || selected.size === 0) return;
    if (submittedRef.current) return; // guard double-submit
    submittedRef.current = true;
    lockAndScore();
    setPhase("revealed");
  }

  function handleRetry() {
    if (!q) return;
    // Roll back score for this question
    const prevSel = history.get(current);
    if (prevSel) {
      const correctIds = new Set(q.choices.filter((c) => c.est_correct).map((c) => c.id));
      const wasCorrect =
        prevSel.size === correctIds.size && [...prevSel].every((cid) => correctIds.has(cid));
      setScore((s) => ({
        correct: s.correct - (wasCorrect ? 1 : 0),
        total: s.total - 1,
      }));
      setAnsweredCount((n) => n - 1);
    }
    // Remove from history so this question is no longer counted as answered
    const newHistory = new Map(history);
    newHistory.delete(current);
    setHistory(newHistory);
    // Delete saved answer from DB so the next answer is the one stored
    if (user && q) {
      supabase
        .from("user_answers")
        .delete()
        .eq("user_id", user.id)
        .eq("question_id", q.id)
        .then(() => {});
    }
    // Reset UI state
    setSelected(new Set());
    setPhase("quiz");
    setAiText("");
    setAiParsed(null);
    setCommentsOpen(false);
    // Sync the deletion to DB so that on refresh the retried question is not restored from answers
    const retryHistory = new Map(history);
    retryHistory.delete(current);
    saveSession(retryHistory, current, elapsed, score, false);
  }

  function handleNext() {
    if (!q) return;
    // Use the freshly-built history from lockAndScore (NOT the stale React state)
    // to avoid the "Q6 not in history when checking Q7" stale-closure bug.
    let latestHistory = history;
    if (phase === "quiz" && selected.size > 0) {
      const { newHistory } = lockAndScore();
      latestHistory = newHistory;
    }
    if (isLast) {
      setPhase("result");
      saveSession(latestHistory, current, elapsed, score, true); // mark completed
      return;
    }
    const nextIdx = current + 1;
    // Restore history state for already-answered questions (cross-session safe)
    const nextSel = latestHistory.get(nextIdx);
    setCurrent(nextIdx);
    setSelected(nextSel ? new Set(nextSel) : new Set());
    setPhase(latestHistory.has(nextIdx) ? "revealed" : "quiz");
    setAiText(""); setAiParsed(null); setCommentsOpen(false);
    submittedRef.current = false; // reset guard for new question
    // CRITICAL: always save current_idx as nextIdx so session restore lands on the right question.
    // Without this, current_idx stays frozen at the last *answered* question (index from lockAndScore),
    // causing the ← Préc button to be hidden (current===0) after restore.
    saveSession(latestHistory, nextIdx, elapsed, score, false);
  }

  function handlePrev() {
    if (current === 0) return;
    const prevIdx = current - 1;
    const prevSel = history.get(prevIdx);
    setSelected(prevSel ? new Set(prevSel) : new Set());
    setCurrent(prevIdx);
    setPhase(history.has(prevIdx) ? "revealed" : "quiz");
    setAiText(""); setAiParsed(null); setCommentsOpen(false);
    submittedRef.current = false; // reset guard for returning to previous question
    saveSession(history, prevIdx, elapsed, score, false);
  }

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!q) return;
    const handled = ["1","2","3","4","5","c","C","Enter","ArrowRight","ArrowLeft"," "];
    if (handled.includes(e.key)) e.preventDefault();
    if (phase === "quiz") {
      const idx = ["1","2","3","4","5"].indexOf(e.key);
      if (idx !== -1 && q.choices[idx]) {
        setSelected((prev) => { const n = new Set(prev); n.has(q.choices[idx].id) ? n.delete(q.choices[idx].id) : n.add(q.choices[idx].id); return n; });
      }
      if ((e.key === "c" || e.key === "C") && selected.size > 0) handleReveal();
      if ((e.key === "Enter" || e.key === "ArrowRight") && selected.size > 0) handleNext();
    }
    if (phase === "revealed" && (e.key === "Enter" || e.key === "ArrowRight" || e.key === " ")) handleNext();
      if (phase === "revealed" && e.key === "ArrowLeft" && current > 0) handlePrev();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected, q]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  function onTouchStart(e: React.TouchEvent) { txRef.current = e.touches[0].clientX; tyRef.current = e.touches[0].clientY; }
  function onTouchEnd(e: React.TouchEvent) {
    if (txRef.current === null || tyRef.current === null) return;
    const dx = e.changedTouches[0].clientX - txRef.current;
    const dy = e.changedTouches[0].clientY - tyRef.current;
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 50 && dx < 0) handleNext();
    txRef.current = null; tyRef.current = null;
  }

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const progress = (answeredCount / Math.max(1, questions.length)) * 100;
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg)" }}>
      <Loader2 className="animate-spin" size={24} style={{ color: "var(--text-muted)" }} />
    </div>
  );

  if (phase === "result") {
    const col = pct >= 70 ? "emerald" : pct >= 50 ? "amber" : "red";
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6" style={{ background: "var(--bg)" }}>
        <div className={`text-6xl font-bold text-${col}-400`}>{pct}%</div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{score.correct}/{score.total} correctes · {mins}:{secs.toString().padStart(2, "0")}</p>
        <p className="text-base font-semibold mt-2" style={{ color: "var(--text)" }}>{activityName}</p>
        <div className="flex gap-3 w-full max-w-xs mt-4">
          <button onClick={() => { setCurrent(0); setSelected(new Set()); setPhase("quiz"); setScore({ correct: 0, total: 0 }); setAnsweredCount(0); setElapsed(0); setAiText(""); setHistory(new Map()); setAiCached(null); if (user) supabase.from("quiz_sessions").delete().eq("user_id", user.id).eq("activity_id", activityId).then(() => {}); }}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold border transition-all hover:bg-[var(--surface)]"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>Recommencer</button>
          <button onClick={() => router.back()} className="flex-1 py-3.5 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 transition-all">Terminer</button>
        </div>
      </div>
    );
  }

  // ── Empty state: all questions are QROC / open-ended (no choices) ────────────
  if (!q) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
        {/* Header */}
        <div className="sticky top-0 z-20 px-4 pt-3 pb-2" style={{ background: "var(--bg)" }}>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--surface-alt)] transition-colors" style={{ color: "var(--text-muted)" }}>
              <ArrowLeft size={18} />
            </button>
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{activityName}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-24 space-y-4">
          {/* Notice */}
          <div className="rounded-2xl border px-5 py-6 text-center space-y-2"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-2xl">📝</p>
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Questions rédactionnelles</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Cet examen contient uniquement des questions ouvertes (schémas, rédaction). Elles ne peuvent pas être notées automatiquement — consultez les ci-dessous pour votre révision.
            </p>
          </div>

          {/* Open questions list */}
          {openQuestions.length > 0 && (
            <div className="space-y-3">
              {openQuestions.map((oq, idx) => (
                <div key={oq.id} className="rounded-xl border px-4 py-3 space-y-1.5 transition-all"
                  style={{ background: "var(--surface)", borderColor: readOpenQIds.has(oq.id) ? "rgba(34,197,94,0.25)" : "var(--surface-active)", opacity: readOpenQIds.has(oq.id) ? 0.6 : 1 }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: "var(--surface-active)", color: "var(--text-muted)" }}>Q{idx + 1}</span>
                      {oq.source_question && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">{oq.source_question}</span>
                      )}
                    </div>
                    <button
                      onClick={() => setReadOpenQIds(prev => {
                        const next = new Set(prev);
                        next.has(oq.id) ? next.delete(oq.id) : next.add(oq.id);
                        return next;
                      })}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all flex-shrink-0"
                      style={{
                        background: readOpenQIds.has(oq.id) ? "rgba(34,197,94,0.12)" : "var(--surface-alt)",
                        color: readOpenQIds.has(oq.id) ? "#22c55e" : "var(--text-muted)",
                        border: `1px solid ${readOpenQIds.has(oq.id) ? "rgba(34,197,94,0.25)" : "var(--surface-active)"}`,
                      }}>
                      {readOpenQIds.has(oq.id) ? "✓ Lu" : "Marquer lu"}
                    </button>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{oq.texte}</p>
                  <QuizImage src={oq.image_url} className="mt-2" />
                  {oq.correction && (
                    <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--surface-alt)" }}>
                      <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Correction</p>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{oq.correction}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back button */}
        <div className="fixed bottom-0 left-0 right-0 px-4 py-3 border-t" style={{ background: "var(--bg)", borderColor: "var(--surface-active)" }}>
          <button onClick={() => router.back()} className="w-full max-w-lg mx-auto flex items-center justify-center py-3 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 transition-all">
            Retour
          </button>
        </div>
      </div>
    );
  }
  const rev = phase === "revealed";

  return (
    <>
    <DuaaModal activityId={activityId} />
    <div className="min-h-screen flex flex-col pb-32" style={{ background: "var(--bg)" }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      <div className="sticky top-0 z-20 px-4 pt-3 pb-2" style={{ background: "var(--bg)" }}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--surface-alt)] transition-colors" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft size={18} />
          </button>
          {score.total > 0 && (
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border",
              pct >= 70 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : pct >= 50 ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
              : "text-red-400 bg-red-500/10 border-red-500/20")}>
              {score.correct}/{score.total}
            </span>
          )}
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{mins}:{secs.toString().padStart(2, "0")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-active)" }}>
            <motion.div className="h-full rounded-full" style={{ background: "var(--accent)" }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
          </div>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{answeredCount}/{questions.length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2 space-y-3">

        <div className="rounded-2xl border p-4 space-y-2" style={{ background: "var(--surface)", borderColor: "var(--surface-active)" }}>
          {q.source_question && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">{q.source_question}</span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{q.source_type}</span>
            </div>
          )}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <RichText text={q.texte} className="font-medium" />
            </div>
            {user && (
              <button
                onClick={handleBookmark}
                disabled={bookmarkLoading}
                className="flex-shrink-0 p-1.5 rounded-lg transition-all hover:bg-[var(--surface-alt)] disabled:opacity-50"
                title={bookmarked ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                {bookmarked
                  ? <BookmarkCheck size={16} style={{ color: "var(--accent)" }} />
                  : <Bookmark size={16} style={{ color: "var(--text-muted)" }} />
                }
              </button>
            )}
          </div>
          <QuizImage src={q.image_url} />
        </div>

        <div className="space-y-2">
          {q.choices.map((choice, idx) => {
            const isSel = selected.has(choice.id);
            const letter = String.fromCharCode(65 + idx);
            const borderColor = rev && choice.est_correct ? "rgba(16,185,129,0.4)" : rev && isSel && !choice.est_correct ? "rgba(239,68,68,0.4)" : isSel ? "var(--accent, rgba(255,255,255,0.6))" : "var(--surface-active)";
            const bg = rev && choice.est_correct ? "rgba(16,185,129,0.07)" : rev && isSel && !choice.est_correct ? "rgba(239,68,68,0.07)" : isSel ? "var(--border)" : "var(--surface)";
            const optWhy = aiParsed?.find((o) => o.letter === letter)?.why;
            const showSkeleton = rev && aiLoading && !aiParsed;
            return (
              <motion.button key={choice.id}
                onClick={() => phase === "quiz" && setSelected((prev) => { const n = new Set(prev); n.has(choice.id) ? n.delete(choice.id) : n.add(choice.id); return n; })}
                disabled={phase !== "quiz"}
                whileTap={{ scale: phase === "quiz" ? 0.99 : 1 }}
                className="w-full text-left rounded-xl px-4 py-3 border transition-all"
                style={{ background: bg, borderColor }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border" style={{
                    background: rev ? (choice.est_correct ? "rgba(16,185,129,0.2)" : isSel ? "rgba(239,68,68,0.2)" : "var(--surface-active)") : isSel ? "var(--surface-active)" : "transparent",
                    borderColor: rev ? (choice.est_correct ? "rgba(16,185,129,0.4)" : isSel ? "rgba(239,68,68,0.4)" : "var(--border)") : isSel ? "var(--text-muted)" : "var(--border)",
                    color: rev ? (choice.est_correct ? "rgb(16,185,129)" : isSel ? "rgb(239,68,68)" : "var(--text-muted)") : "var(--text)",
                  }}>{letter}</span>
                  <div className="flex-1 min-w-0">
                    <RichText text={choice.contenu} />
                    {rev && (
                      <div className="mt-2">
                        {showSkeleton ? (
                          <div className="h-2.5 rounded animate-pulse w-3/4" style={{ background: "var(--surface-active)" }} />
                        ) : rev && !aiLoading && !aiParsed && aiText.startsWith("Erreur") && idx === 0 ? (
                          <p className="text-[10px]" style={{ color: "rgba(239,68,68,0.8)" }}>⚠ {aiText.slice(0, 80)}</p>
                        ) : optWhy ? (
                          <div className="flex items-start gap-1.5">
                            <Brain size={10} className="flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{optWhy}</p>
                          </div>
                        ) : choice.explication ? (
                          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{choice.explication}</p>
                        ) : null}
                      </div>
                    )}
                    {rev && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "var(--surface-active)" }}>
                          <div className="h-full rounded-full" style={{ background: "var(--accent)", width: `${choice.pourcentage}%` }} />
                        </div>
                        <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>{choice.pourcentage}%</span>
                      </div>
                    )}
                  </div>
                  {rev && (choice.est_correct ? <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : isSel ? <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" /> : null)}
                </div>
              </motion.button>
            );
          })}
        </div>

        {rev && (
          <div className="flex items-center justify-between px-1">
            {/* Error banner — shown when aiText starts with Erreur */}
            {!aiLoading && aiText && aiText.startsWith("Erreur") && (
              <div className="flex items-center gap-2 w-full rounded-xl px-3 py-2"
                style={{ background: "var(--error-subtle)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <XCircle size={12} className="flex-shrink-0 text-red-400" />
                <p className="text-[11px] leading-snug" style={{ color: "#f87171" }}>{aiText.replace(/^Erreur: ?/, "")}</p>
                <button onClick={() => { setAiText(""); setAiParsed(null); }}
                  className="ml-auto flex-shrink-0 text-[10px] px-2 py-0.5 rounded-md hover:opacity-80"
                  style={{ background: "var(--error-subtle)", color: "#f87171" }}>Réessayer</button>
              </div>
            )}
            {/* Not yet triggered → primary CTA button */}
            {!aiLoading && !aiText && (
              <button
                onClick={() => doFetchAI(false)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all w-full justify-center"
                style={{ background: "var(--accent-subtle)", border: "1px solid rgba(99,179,237,0.2)", color: "var(--accent)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-subtle)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-subtle)"; }}>
                <Brain size={13} />
                Expliquer avec l&apos;IA
              </button>
            )}
            {/* Loading state */}
            {aiLoading && (
              <div className="flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" style={{ color: "var(--accent)" }} />
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Explication IA en cours…</span>
              </div>
            )}
            {/* Done: label + cached badge + regenerate */}
            {!aiLoading && aiText && (
              <>
                <div className="flex items-center gap-1.5">
                  <Brain size={12} style={{ color: "var(--accent)" }} />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Explication IA</span>
                  {aiCached && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/15">Sauvegardée</span>
                  )}
                </div>
                <button
                  onClick={() => doFetchAI(true)}
                  title="Régénérer et écraser l'explication sauvegardée"
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all hover:text-zinc-200"
                  style={{ color: "var(--text-muted)", background: "var(--surface-alt)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <RefreshCw size={9} /> Régénérer
                </button>
              </>
            )}
          </div>
        )}

        {rev && (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--surface-active)" }}>
            <button onClick={() => { setCommentsOpen(!commentsOpen); if (!commentsOpen) loadComments(); }}
              className="flex items-center gap-2 w-full px-4 py-3 text-sm transition-all hover:bg-[var(--surface)]"
              style={{ color: "var(--text-muted)" }}>
              <MessageCircle size={13} />
              {commentsOpen ? "Masquer les commentaires" : "Commentaires"}
              {comments.length > 0 && !commentsOpen && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">{comments.length}</span>
              )}
            </button>
            <AnimatePresence>
              {commentsOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "var(--surface-alt)" }}>
                    {user && (
                      <div className="pt-3 space-y-2">
                        <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Votre commentaire..." rows={2}
                          className="w-full text-sm rounded-xl px-3 py-2 border resize-none focus:outline-none"
                          style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
                            <input type="checkbox" checked={commentAnon} onChange={(e) => setCommentAnon(e.target.checked)} className="w-3 h-3" /> Anonyme
                          </label>
                          <button onClick={postComment} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors">
                            <Send size={11} /> Envoyer
                          </button>
                        </div>
                      </div>
                    )}
                    {comments.length === 0 ? (
                      <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>Soyez le premier à commenter</p>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium" style={{ color: "var(--text)" }}>{c.is_anonymous ? "Anonyme" : (c.profiles?.username ?? "Utilisateur")}</span>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 border-t" style={{ background: "var(--bg)", borderColor: "var(--surface-active)" }}>
        <div className="flex gap-2.5 max-w-lg mx-auto">
          {phase === "quiz" ? (
            <>
              {current > 0 && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={handlePrev}
                  className="px-4 py-3 rounded-2xl text-sm font-semibold border transition-all"
                  style={{ borderColor: "var(--surface-active)", color: "var(--text)", background: "var(--surface-alt)" }}>
                  ← Préc.
                </motion.button>
              )}
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleReveal} disabled={selected.size === 0}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold border transition-all disabled:opacity-30"
                style={{ borderColor: "var(--surface-active)", color: "var(--text)", background: "var(--surface-alt)" }}>
                Voir correction
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleNext} disabled={selected.size === 0}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all disabled:opacity-30"
                style={{ background: selected.size > 0 ? "white" : "var(--surface-alt)", color: selected.size > 0 ? "black" : "var(--text-muted)" }}>
                {isLast ? "Résultats" : "Suivant →"}
              </motion.button>
            </>
          ) : (
            <>
              {current > 0 && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={handlePrev}
                  className="px-4 py-3 rounded-2xl text-sm font-semibold border transition-all"
                  style={{ borderColor: "var(--surface-active)", color: "var(--text)", background: "var(--surface-alt)" }}>
                  ← Préc.
                </motion.button>
              )}
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleRetry}
                className="px-4 py-3 rounded-2xl text-sm font-semibold border transition-all flex items-center gap-1.5"
                style={{ borderColor: "rgba(251,191,36,0.25)", color: "#fbbf24", background: "rgba(251,191,36,0.08)" }}>
                <RotateCcw size={13} /> Réessayer
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleNext}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 transition-all">
                {isLast ? "Voir les résultats" : "Suivant →"}
              </motion.button>
            </>
          )}
        </div>
        <p className="text-center text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
          {phase === "quiz" ? "1–5 choisir · C correction · → suivant" : "← Glisser pour continuer"}
        </p>
      </div>
    </div>
    </>
  );
}
