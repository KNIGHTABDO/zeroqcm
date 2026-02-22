"use client";
import { use, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CheckCircle, XCircle, Brain, MessageCircle, Send, RefreshCw, Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase, getActivityWithQuestions, submitAnswer, getComments, addComment } from "@/lib/supabase";
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
    if (cleaned.startsWith("```")) {
      const firstNewline = cleaned.indexOf("\n");
      cleaned = firstNewline !== -1 ? cleaned.slice(firstNewline + 1) : cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, cleaned.lastIndexOf("```"));
    }
    cleaned = cleaned.trim();
    const p = JSON.parse(cleaned) as OptionExplanation[];
    if (Array.isArray(p) && p.length > 0 && p[0]?.letter) return p;
  } catch {
    // not valid JSON
  }
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
  const [shouldFetchAI, setShouldFetchAI] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [aiText, setAiText] = useState("");
  const [aiParsed, setAiParsed] = useState<ParsedAI>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCached, setAiCached] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<QuizComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentAnon, setCommentAnon] = useState(false);

  const txRef = useRef<number | null>(null);
  const tyRef = useRef<number | null>(null);

  useEffect(() => {
    getActivityWithQuestions(activityId).then(({ activity, questions: qs }) => {
      setActivityName(activity?.nom ?? "QCM");
      setQuestions(qs as Question[]);
      setLoading(false);
    });
  }, [activityId]);

  const q = questions[current];
  const isLast = current === questions.length - 1;

  useEffect(() => {
    if (phase === "result" || loading) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase, loading]);

  useEffect(() => {
    setAiCached(null); setAiText(""); setAiParsed(null); setShouldFetchAI(false);
    if (!q) return;
    supabase.from("ai_explanations").select("explanation").eq("question_id", q.id).maybeSingle()
      .then(({ data }) => { if (data?.explanation) setAiCached(data.explanation); });
  }, [q?.id]);

  // Trigger AI fetch only after phase="revealed" is committed to the DOM
  // Avoids React batching race where AI section does not exist yet when stream arrives
  useEffect(() => {
    if (phase !== "revealed" || !shouldFetchAI || !q) return;
    setShouldFetchAI(false);
    doFetchAI(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shouldFetchAI]);

  async function doFetchAI(forceNew: boolean) {
    if (!q) return;
    if (!forceNew && aiCached) { setAiText(aiCached); setAiParsed(parseAI(aiCached)); return; }
    setAiLoading(true); setAiText(""); setAiParsed(null);
    const model = (typeof localStorage !== "undefined" ? localStorage.getItem("fmpc-ai-model") : null) ?? "gpt-4o-mini";
    const opts = q.choices.map((c, i) =>
      String.fromCharCode(65 + i) + ") " + c.contenu + " — " + (c.est_correct ? "CORRECTE" : "incorrecte")
    ).join("\n");
    const prompt = "Question de QCM médical (FMPC):\n\"" + q.texte + "\"\n\nOptions:\n" + opts +
      "\n\nPour CHAQUE option, explique en max 25 mots pourquoi elle est correcte ou incorrecte." +
      " Commence chaque why par \"Car \" ou \"Parce que \"." +
      " Réponds uniquement en JSON: [{\"letter\":\"A\",\"contenu\":\"...\",\"est_correct\":true,\"why\":\"...\"},...]";
    let full = "";
    try {
      const res = await fetch("/api/ai-explain", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
      });
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      if (!reader) { setAiLoading(false); return; }
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value);
        setAiText(full);
        const parsed = parseAI(full);
        if (parsed) setAiParsed(parsed);
      }
    } catch { full = "Erreur de connexion."; setAiText(full); }
    setAiLoading(false);
    if (full && !full.startsWith("Erreur")) {
      const parsed = parseAI(full);
      if (parsed) setAiParsed(parsed);
      supabase.from("ai_explanations").upsert(
        { question_id: q.id, explanation: full, generated_by: user?.id ?? "anonymous", model_used: model },
        { onConflict: "question_id" }
      ).then(() => setAiCached(full));
    }
  }

  function lockAndScore() {
    if (!q || selected.size === 0) return;
    const correctIds = new Set(q.choices.filter((c) => c.est_correct).map((c) => c.id));
    const ok = selected.size === correctIds.size && [...selected].every((cid) => correctIds.has(cid));
    setScore((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }));
    setAnsweredCount((n) => n + 1);
    if (user) submitAnswer({ userId: user.id, questionId: q.id, activityId, selectedChoiceIds: [...selected], isCorrect: ok, timeSpent: elapsed });
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
    lockAndScore();
    setPhase("revealed");
    setShouldFetchAI(true);
  }

  function handleNext() {
    if (!q) return;
    if (phase === "quiz" && selected.size > 0) lockAndScore();
    if (isLast) { setPhase("result"); return; }
    setCurrent((c) => c + 1);
    setSelected(new Set());
    setPhase("quiz");
    setAiText(""); setAiParsed(null); setCommentsOpen(false);
  }

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!q) return;
    if (phase === "quiz") {
      const idx = ["1","2","3","4","5"].indexOf(e.key);
      if (idx !== -1 && q.choices[idx]) {
        setSelected((prev) => { const n = new Set(prev); n.has(q.choices[idx].id) ? n.delete(q.choices[idx].id) : n.add(q.choices[idx].id); return n; });
      }
      if ((e.key === "c" || e.key === "C") && selected.size > 0) handleReveal();
      if ((e.key === "Enter" || e.key === "ArrowRight") && selected.size > 0) handleNext();
    }
    if (phase === "revealed" && (e.key === "Enter" || e.key === "ArrowRight" || e.key === " ")) handleNext();
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
          <button onClick={() => { setCurrent(0); setSelected(new Set()); setPhase("quiz"); setScore({ correct: 0, total: 0 }); setAnsweredCount(0); setElapsed(0); setAiText(""); }}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold border transition-all hover:bg-white/[0.04]"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>Recommencer</button>
          <button onClick={() => router.back()} className="flex-1 py-3.5 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 transition-all">Terminer</button>
        </div>
      </div>
    );
  }

  if (!q) return null;
  const rev = phase === "revealed";

  return (
    <div className="min-h-screen flex flex-col pb-32" style={{ background: "var(--bg)" }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      <div className="sticky top-0 z-20 px-4 pt-3 pb-2" style={{ background: "var(--bg)" }}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" style={{ color: "var(--text-muted)" }}>
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
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div className="h-full rounded-full bg-blue-500" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
          </div>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{answeredCount}/{questions.length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2 space-y-3">

        <div className="rounded-2xl border p-4 space-y-2" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.06)" }}>
          {q.source_question && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">{q.source_question}</span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{q.source_type}</span>
            </div>
          )}
          <p className="text-sm leading-relaxed font-medium" style={{ color: "var(--text)" }}>{q.texte}</p>
          {q.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.image_url} alt="Illustration" className="rounded-xl w-full object-contain max-h-48" />
          )}
        </div>

        <div className="space-y-2">
          {q.choices.map((choice, idx) => {
            const isSel = selected.has(choice.id);
            const letter = String.fromCharCode(65 + idx);
            const borderColor = rev && choice.est_correct ? "rgba(16,185,129,0.4)" : rev && isSel && !choice.est_correct ? "rgba(239,68,68,0.4)" : isSel ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)";
            const bg = rev && choice.est_correct ? "rgba(16,185,129,0.07)" : rev && isSel && !choice.est_correct ? "rgba(239,68,68,0.07)" : isSel ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)";
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
                    background: rev ? (choice.est_correct ? "rgba(16,185,129,0.2)" : isSel ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)") : isSel ? "rgba(255,255,255,0.12)" : "transparent",
                    borderColor: rev ? (choice.est_correct ? "rgba(16,185,129,0.4)" : isSel ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)") : isSel ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
                    color: rev ? (choice.est_correct ? "rgb(16,185,129)" : isSel ? "rgb(239,68,68)" : "var(--text-muted)") : "var(--text)",
                  }}>{letter}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{ color: "var(--text)" }}>{choice.contenu}</p>
                    {rev && (
                      <div className="mt-2">
                        {showSkeleton ? (
                          <div className="h-2.5 rounded animate-pulse w-3/4" style={{ background: "rgba(255,255,255,0.06)" }} />
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
                        <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full bg-blue-500/50" style={{ width: `${choice.pourcentage}%` }} />
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
            <div className="flex items-center gap-1.5">
              <Brain size={12} style={{ color: "var(--accent)" }} />
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {aiLoading ? "Explication IA en cours…" : "Explication IA"}
              </span>
              {aiCached && !aiLoading && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/15">Sauvegardée</span>
              )}
            </div>
            {!aiLoading && (aiParsed || aiText) && (
              <button onClick={() => doFetchAI(true)} className="flex items-center gap-1 text-[10px] hover:text-zinc-300 transition-colors" style={{ color: "var(--text-muted)" }}>
                <RefreshCw size={10} /> Régénérer
              </button>
            )}
          </div>
        )}

        {rev && (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <button onClick={() => { setCommentsOpen(!commentsOpen); if (!commentsOpen) loadComments(); }}
              className="flex items-center gap-2 w-full px-4 py-3 text-sm transition-all hover:bg-white/[0.04]"
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
                  <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                    {user && (
                      <div className="pt-3 space-y-2">
                        <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Votre commentaire..." rows={2}
                          className="w-full text-sm rounded-xl px-3 py-2 border resize-none focus:outline-none"
                          style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "var(--text)" }} />
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

      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 border-t" style={{ background: "var(--bg)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex gap-2.5 max-w-lg mx-auto">
          {phase === "quiz" ? (
            <>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleReveal} disabled={selected.size === 0}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold border transition-all disabled:opacity-30"
                style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--text)", background: "rgba(255,255,255,0.04)" }}>
                Voir correction
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleNext} disabled={selected.size === 0}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all disabled:opacity-30"
                style={{ background: selected.size > 0 ? "white" : "rgba(255,255,255,0.04)", color: selected.size > 0 ? "black" : "var(--text-muted)" }}>
                {isLast ? "Résultats" : "Suivant →"}
              </motion.button>
            </>
          ) : (
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleNext}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 transition-all">
              {isLast ? "Voir les résultats" : "Suivant →"}
            </motion.button>
          )}
        </div>
        <p className="text-center text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
          {phase === "quiz" ? "1–5 choisir · C correction · → suivant" : "← Glisser pour continuer"}
        </p>
      </div>
    </div>
  );
}
