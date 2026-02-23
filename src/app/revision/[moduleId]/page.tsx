"use client";
import { use, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle, XCircle, Brain, RefreshCw, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase, submitAnswer } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { QuizImage } from "@/components/ui/QuizImage";

type Choice = {
  id: string; id_choix: number; contenu: string;
  est_correct: boolean; pourcentage: number; explication: string | null;
};
type Question = {
  id: string; texte: string; image_url: string | null;
  source_question: string | null; correction: string | null;
  choices: Choice[];
};
type Phase = "quiz" | "revealed" | "result";
type OptionExplanation = { letter: string; contenu: string; est_correct: boolean; why: string };
type ParsedAI = OptionExplanation[] | null;

const VALID_GH_MODELS = new Set([
  "gpt-4o", "gpt-4o-mini", "o1", "o1-mini", "o3", "o3-mini", "o4-mini",
  "Meta-Llama-3.3-70B-Instruct", "Meta-Llama-3.1-405B-Instruct",
  "Mistral-Large-2", "Phi-4", "Phi-4-mini", "Cohere-Command-R-Plus-08-2024",
  "DeepSeek-R1", "DeepSeek-V3",
]);

function parseAI(raw: string): ParsedAI {
  try {
    let c = raw.trim();
    if (c.startsWith("```")) { const nl = c.indexOf("\n"); c = nl !== -1 ? c.slice(nl + 1) : c.slice(3); }
    if (c.endsWith("```")) c = c.slice(0, c.lastIndexOf("```")).trim();
    const p = JSON.parse(c) as OptionExplanation[];
    if (Array.isArray(p) && p.length > 0 && p[0]?.letter) return p;
  } catch { /* not JSON yet */ }
  return null;
}

export default function RevisionModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [noWeak, setNoWeak] = useState(false);
  const [moduleName, setModuleName] = useState("Révision ciblée");

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>("quiz");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [elapsed, setElapsed] = useState(0);

  const [aiText, setAiText] = useState("");
  const [aiParsed, setAiParsed] = useState<ParsedAI>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCached, setAiCached] = useState<string | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);

  const txRef = useRef<number | null>(null);
  const tyRef = useRef<number | null>(null);

  // ── Load weak questions via /api/weak-quiz ─────────────────────────────────
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetch("/api/weak-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        moduleId: moduleId !== "all" ? parseInt(moduleId) : undefined,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (!d.questions?.length) { setNoWeak(true); }
        else { setQuestions(d.questions); }
        if (d.moduleName) setModuleName(d.moduleName);
        setLoading(false);
      })
      .catch(() => { setNoWeak(true); setLoading(false); });
  }, [user, moduleId]);

  const q = questions[current];
  const isLast = current === questions.length - 1;
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  // Timer
  useEffect(() => {
    if (phase === "result" || loading) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase, loading]);

  // Load cached AI explanation for current question
  useEffect(() => {
    setAiCached(null); setAiText(""); setAiParsed(null);
    if (!q) return;
    supabase.from("ai_explanations").select("explanation").eq("question_id", q.id).maybeSingle()
      .then(({ data }) => { if (data?.explanation) setAiCached(data.explanation); });
  }, [q?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch AI when revealed
  useEffect(() => {
    if (phase !== "revealed" || !q) return;
    doFetchAI(false);
  }, [phase, q?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doFetchAI(forceNew: boolean) {
    if (!q) return;
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;

    if (!forceNew && aiCached) { setAiText(aiCached); setAiParsed(parseAI(aiCached)); return; }
    setAiLoading(true); setAiText(""); setAiParsed(null);

    const rawModel = typeof localStorage !== "undefined" ? localStorage.getItem("fmpc-ai-model") : null;
    const model = rawModel && VALID_GH_MODELS.has(rawModel) ? rawModel : "gpt-4o-mini";
    if (typeof localStorage !== "undefined" && rawModel && !VALID_GH_MODELS.has(rawModel)) {
      localStorage.setItem("fmpc-ai-model", "gpt-4o-mini");
    }

    const opts = q.choices.map((c, i) =>
      String.fromCharCode(65 + i) + ") " + c.contenu + " [" + (c.est_correct ? "CORRECTE" : "INCORRECTE") + "]"
    ).join("\n");
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
      if (err instanceof Error && err.name === "AbortError") return;
      full = "Erreur de connexion."; setAiText(full);
    }
    if (!controller.signal.aborted) {
      setAiLoading(false);
      if (full && !full.startsWith("Erreur")) {
        const parsed = parseAI(full);
        if (parsed) setAiParsed(parsed);
        supabase.from("ai_explanations").upsert(
          { question_id: savedQ.id, explanation: full, generated_by: user?.id ?? "anonymous", model_used: model },
          { onConflict: "question_id" }
        ).then(() => setAiCached(full));
      }
    }
  }

  function lockAndScore() {
    if (!q || selected.size === 0) return;
    const correctIds = new Set(q.choices.filter(c => c.est_correct).map(c => c.id));
    const ok = selected.size === correctIds.size && [...selected].every(id => correctIds.has(id));
    setScore(s => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }));
    if (user) submitAnswer({ userId: user.id, questionId: q.id, activityId: 0, selectedChoiceIds: [...selected], isCorrect: ok, timeSpent: elapsed });
  }

  function handleReveal() {
    if (!q || selected.size === 0) return;
    lockAndScore();
    setPhase("revealed");
  }

  function handleNext() {
    if (!q) return;
    if (phase === "quiz" && selected.size > 0) lockAndScore();
    if (isLast) { setPhase("result"); return; }
    setCurrent(c => c + 1);
    setSelected(new Set());
    setPhase("quiz");
    setAiText(""); setAiParsed(null);
  }

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!q) return;
    if (phase === "quiz") {
      const idx = ["1","2","3","4","5"].indexOf(e.key);
      if (idx !== -1 && q.choices[idx]) {
        setSelected(prev => { const n = new Set(prev); n.has(q.choices[idx].id) ? n.delete(q.choices[idx].id) : n.add(q.choices[idx].id); return n; });
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

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: "var(--bg)" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Analyse de vos erreurs…</p>
      </div>
    );
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ background: "var(--bg)" }}>
        <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
          Connectez-vous pour accéder à la révision ciblée
        </p>
        <a href="/auth" className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--text)", color: "var(--bg)" }}>Se connecter</a>
      </div>
    );
  }

  // ── No weak questions ──────────────────────────────────────────────────────
  if (noWeak) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4 text-center" style={{ background: "var(--bg)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
          <Check className="w-6 h-6" style={{ color: "var(--success)" }} />
        </div>
        <div>
          <p className="text-base font-semibold mb-1" style={{ color: "var(--text)" }}>Aucune question faible !</p>
          <p className="text-sm max-w-xs" style={{ color: "var(--text-muted)" }}>
            Vous n&apos;avez pas encore raté cette question 2 fois ou plus. Continuez à pratiquer&nbsp;!
          </p>
        </div>
        <button onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--text)", color: "var(--bg)" }}>Retour</button>
      </div>
    );
  }

  // ── Result screen ──────────────────────────────────────────────────────────
  if (phase === "result") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4" style={{ background: "var(--bg)" }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-2 text-center">
          <p className="text-6xl font-bold tabular-nums" style={{
            color: pct >= 70 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--error)",
          }}>{pct}%</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {score.correct}/{score.total} correctes · {mins}:{secs.toString().padStart(2, "0")}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{moduleName}</p>
        </motion.div>
        <div className="flex gap-2.5 w-full max-w-xs">
          <button
            onClick={() => { setCurrent(0); setSelected(new Set()); setPhase("quiz"); setScore({ correct: 0, total: 0 }); setElapsed(0); setAiText(""); }}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold border transition-all"
            style={{ borderColor: "var(--border)", color: "var(--text)", background: "transparent" }}>
            Recommencer
          </button>
          <button onClick={() => router.back()}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold transition-all"
            style={{ background: "var(--text)", color: "var(--bg)" }}>
            Terminer
          </button>
        </div>
      </div>
    );
  }

  if (!q) return null;

  const rev = phase === "revealed";
  const progress = ((current + (phase !== "quiz" ? 1 : 0)) / Math.max(1, questions.length)) * 100;

  return (
    <div className="min-h-screen pb-32 md:pb-10" style={{ background: "var(--bg)", color: "var(--text)" }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="max-w-2xl mx-auto px-4">

        {/* Top bar */}
        <div className="flex items-center gap-3 py-4 sticky top-0 z-10" style={{ background: "var(--bg)" }}>
          <button onClick={() => router.back()}
            className="p-2 rounded-xl transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
              {moduleName}
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Révision ciblée</p>
          </div>
          <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full mb-5" style={{ background: "var(--surface-alt)" }}>
          <motion.div className="h-full rounded-full" style={{ background: "var(--accent)", width: `${progress}%` }}
            transition={{ duration: 0.3 }} />
        </div>

        {/* Counter */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {current + 1} / {questions.length}
          </span>
          {score.total > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full tabular-nums"
              style={{
                background: pct >= 70 ? "var(--success-subtle)" : pct >= 50 ? "var(--warning-subtle)" : "var(--error-subtle)",
                color: pct >= 70 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--error)",
                border: `1px solid ${pct >= 70 ? "var(--success-border)" : pct >= 50 ? "var(--warning-border)" : "var(--error-border)"}`,
              }}>
              {score.correct}/{score.total}
            </span>
          )}
        </div>

        {/* Question text */}
        <AnimatePresence mode="wait">
          <motion.div key={q.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mb-5 space-y-3">
            <p className="text-base sm:text-lg font-medium leading-relaxed" style={{ color: "var(--text)" }}>
              {q.texte}
            </p>
            {q.image_url && <QuizImage src={q.image_url} alt="Question image" />}
            {phase === "quiz" && q.choices.filter(c => c.est_correct).length > 1 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {q.choices.filter(c => c.est_correct).length} réponses correctes
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Choices */}
        <div className="space-y-2.5 mb-6">
          {q.choices.map((choice, idx) => {
            const isSel = selected.has(choice.id);
            const letter = String.fromCharCode(65 + idx);
            const optWhy = aiParsed?.find(o => o.letter === letter)?.why;
            const showSkeleton = rev && aiLoading && !aiParsed;

            // Color logic — CSS vars throughout
            let bg = "var(--surface)";
            let borderColor = "var(--border)";
            if (rev && choice.est_correct) { bg = "var(--success-subtle)"; borderColor = "var(--success-border)"; }
            else if (rev && isSel && !choice.est_correct) { bg = "var(--error-subtle)"; borderColor = "var(--error-border)"; }
            else if (isSel) { bg = "var(--surface-active)"; borderColor = "var(--border-strong)"; }

            return (
              <motion.button key={choice.id}
                onClick={() => phase === "quiz" && setSelected(prev => {
                  const n = new Set(prev); n.has(choice.id) ? n.delete(choice.id) : n.add(choice.id); return n;
                })}
                disabled={phase !== "quiz"}
                whileTap={{ scale: phase === "quiz" ? 0.99 : 1 }}
                className="w-full text-left rounded-xl px-4 py-3 border transition-all"
                style={{ background: bg, borderColor }}>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5"
                    style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}>
                    {letter}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{ color: "var(--text)" }}>{choice.contenu}</p>
                    {rev && (
                      <div className="mt-2">
                        {showSkeleton ? (
                          <div className="h-3 rounded animate-pulse w-3/4" style={{ background: "var(--surface-alt)" }} />
                        ) : optWhy ? (
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{optWhy}</p>
                        ) : choice.explication ? (
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{choice.explication}</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {rev && (
                    choice.est_correct
                      ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--success)" }} />
                      : isSel ? <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--error)" }} /> : null
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* AI explain section */}
        {rev && (
          <div className="mb-6 rounded-2xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                  {aiLoading ? "Explication IA en cours…" : "Explication IA"}
                </span>
                {aiLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--text-muted)" }} />}
              </div>
              {!aiLoading && (aiParsed || aiText) && (
                <button onClick={() => doFetchAI(true)}
                  className="flex items-center gap-1 text-[10px] transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"}>
                  <RefreshCw className="w-3 h-3" /> Régénérer
                </button>
              )}
            </div>
            {aiLoading && !aiParsed && (
              <div className="space-y-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-3 rounded animate-pulse" style={{ background: "var(--surface-alt)", width: `${75 - i * 15}%` }} />
                ))}
              </div>
            )}
            {!aiLoading && !aiParsed && aiText && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{aiText.slice(0, 120)}</p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 md:relative md:px-0 md:pb-0 md:pt-0"
          style={{ background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
          <div className="max-w-2xl mx-auto flex gap-2.5">
            {phase === "quiz" ? (
              <>
                <button onClick={handleReveal} disabled={selected.size === 0}
                  className="flex-1 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                  style={{
                    background: selected.size > 0 ? "transparent" : "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}>
                  Voir correction
                </button>
                <button onClick={handleNext} disabled={selected.size === 0}
                  className="flex-1 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                  style={{ background: "var(--text)", color: "var(--bg)" }}>
                  {isLast ? "Résultats" : "Suivant →"}
                </button>
              </>
            ) : (
              <button onClick={handleNext}
                className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "var(--text)", color: "var(--bg)" }}>
                {isLast ? "Voir les résultats" : "Suivant →"}
              </button>
            )}
          </div>
          <p className="text-center mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
            {phase === "quiz" ? "1–5 choisir · C correction · → suivant" : "← Glisser ou → pour continuer"}
          </p>
        </div>

      </div>
    </div>
  );
}
