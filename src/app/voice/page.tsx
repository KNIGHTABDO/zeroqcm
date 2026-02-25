"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Volume2, CheckCircle2, XCircle, ArrowRight,
  ArrowLeft, Loader2, RefreshCw, BookOpen, Layers, ChevronRight, Trophy
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Choice { id: string; contenu: string; est_correct: boolean; explication: string | null; }
interface VoiceQuestion {
  id: string; texte: string; choices: Choice[];
  module_id: number; activity_id: number;
}
interface Module { id: number; nom: string; }

// ─── Speech helpers ───────────────────────────────────────────────────────────
const CHOICE_LABELS_FR: Record<string, number> = {
  "a": 0, "alpha": 0, "la a": 0, "réponse a": 0, "choix a": 0, "option a": 0,
  "b": 1, "beta": 1,  "la b": 1, "réponse b": 1, "choix b": 1, "option b": 1,
  "c": 2, "la c": 2,  "réponse c": 2, "choix c": 2, "option c": 2,
  "d": 3, "la d": 3,  "réponse d": 3, "choix d": 3, "option d": 3,
  "e": 4, "la e": 4,  "réponse e": 4, "choix e": 4, "option e": 4,
  "premier": 0, "première": 0, "deuxième": 1, "second": 1, "troisième": 2, "quatrième": 3,
  "one": 0, "two": 1, "three": 2, "four": 3,
};

function parseVoiceAnswer(transcript: string, choices: Choice[]): number | null {
  const t = transcript.toLowerCase().trim();
  for (const [key, idx] of Object.entries(CHOICE_LABELS_FR)) {
    if (t.includes(key) && idx < choices.length) return idx;
  }
  // Try matching spoken text against choice content
  for (let i = 0; i < choices.length; i++) {
    const choiceWords = choices[i].contenu.toLowerCase().split(" ");
    const matchCount = choiceWords.filter((w) => w.length > 3 && t.includes(w)).length;
    if (matchCount >= 2) return i;
  }
  return null;
}

function useVoiceRecognition() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) { setSupported(true); }
  }, []);

  const startListening = useCallback((lang = "fr-FR") => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recogRef.current) { recogRef.current.abort(); }
    const recog = new SpeechRecognition();
    recog.lang = lang;
    recog.continuous = false;
    recog.interimResults = false;

    recog.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setTranscript(t);
      setListening(false);
    };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);

    recogRef.current = recog;
    setTranscript("");
    setListening(true);
    recog.start();
  }, []);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
  }, []);

  const resetTranscript = useCallback(() => setTranscript(""), []);

  return { supported, listening, transcript, startListening, stopListening, resetTranscript };
}

// ─── Module Picker ────────────────────────────────────────────────────────────
function ModulePicker({ modules, onSelect }: { modules: Module[]; onSelect: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const filtered = modules.filter((m) => m.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Mode Vocal</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Répondez aux QCM par la voix. Dites &quot;La réponse A&quot;, &quot;B&quot;, etc.
        </p>
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un module…"
        className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition"
        style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--input-text)" }} />
      <div className="space-y-2">
        {filtered.map((m, i) => (
          <motion.button key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onSelect(m.id)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-left transition-all active:scale-98 hover:opacity-80"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--surface-alt)" }}>
                <Volume2 size={15} style={{ color: "var(--text-muted)" }} />
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{m.nom}</span>
            </div>
            <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Voice Question Card ─────────────────────────────────────────────────────
function VoiceQuestionCard({
  question, qIdx, total, answered, isCorrect, selectedIdx,
  transcript, listening, supported,
  onVoiceStart, onVoiceStop, onManualSelect, onNext, onBack,
}: {
  question: VoiceQuestion; qIdx: number; total: number;
  answered: boolean; isCorrect: boolean | null; selectedIdx: number | null;
  transcript: string; listening: boolean; supported: boolean;
  onVoiceStart: () => void; onVoiceStop: () => void;
  onManualSelect: (idx: number) => void; onNext: () => void; onBack: () => void;
}) {
  const LETTERS = ["A", "B", "C", "D", "E"];
  const progress = (qIdx / total) * 100;

  return (
    <motion.div key={`vq-${qIdx}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }} className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-70"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <ArrowLeft size={16} style={{ color: "var(--text-secondary)" }} />
        </button>
        <div className="flex-1">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
            <motion.div className="h-full rounded-full" style={{ background: "var(--accent)" }}
              animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Q {qIdx + 1} / {total}</p>
        </div>
      </div>

      {/* Question */}
      <div className="rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{question.texte}</p>
      </div>

      {/* Choices */}
      <div className="space-y-2.5">
        {question.choices.map((choice, i) => {
          const selected = selectedIdx === i;
          const correct = choice.est_correct;
          let bg = "var(--surface)";
          let border = "var(--border)";
          let textColor = "var(--text)";
          if (answered) {
            if (correct) { bg = "var(--success-subtle)"; border = "var(--success-border)"; textColor = "var(--success)"; }
            else if (selected) { bg = "var(--error-subtle)"; border = "var(--error-border)"; textColor = "var(--error)"; }
          } else if (selected) {
            bg = "var(--accent-subtle)"; border = "var(--accent-border)"; textColor = "var(--accent)";
          }
          return (
            <motion.button key={choice.id}
              whileHover={!answered ? { scale: 1.01 } : {}}
              whileTap={!answered ? { scale: 0.99 } : {}}
              onClick={() => !answered && onManualSelect(i)}
              className="w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
              style={{ background: bg, border: `1px solid ${border}`, cursor: answered ? "default" : "pointer" }}>
              <span className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5"
                style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}>
                {LETTERS[i]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed" style={{ color: textColor }}>{choice.contenu}</p>
                {answered && correct && choice.explication && (
                  <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}>{choice.explication}</p>
                )}
              </div>
              {answered && correct && <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--success)" }} />}
              {answered && selected && !correct && <XCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--error)" }} />}
            </motion.button>
          );
        })}
      </div>

      {/* Voice UI */}
      {!answered && (
        <div className="space-y-3">
          {/* Big mic button */}
          {supported ? (
            <div className="flex flex-col items-center gap-3">
              <motion.button
                onClick={listening ? onVoiceStop : onVoiceStart}
                className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{
                  background: listening ? "var(--error-subtle)" : "var(--accent-subtle)",
                  border: `2px solid ${listening ? "var(--error-border)" : "var(--accent-border)"}`,
                }}
                animate={listening ? { scale: [1, 1.05, 1] } : {}}
                transition={listening ? { repeat: Infinity, duration: 1.2 } : {}}>
                {listening
                  ? <MicOff size={28} style={{ color: "var(--error)" }} />
                  : <Mic size={28} style={{ color: "var(--accent)" }} />}
                {listening && (
                  <motion.div className="absolute inset-0 rounded-full border-2"
                    style={{ borderColor: "var(--error)" }}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1.2 }} />
                )}
              </motion.button>
              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                {listening ? "En écoute… dites votre réponse" : "Appuyez pour parler"}
              </p>
              {transcript && (
                <div className="px-4 py-2.5 rounded-2xl text-sm text-center"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  &ldquo;{transcript}&rdquo;
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm"
              style={{ background: "var(--warning-subtle)", border: "1px solid var(--warning-border)", color: "var(--warning)" }}>
              <MicOff size={14} /> Microphone non supporté dans ce navigateur
            </div>
          )}
        </div>
      )}

      {/* Answered - next button */}
      {answered && (
        <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          onClick={onNext}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
          {qIdx + 1 < total ? <><ArrowRight size={16} /> Question suivante</> : <><Trophy size={16} /> Voir les résultats</>}
        </motion.button>
      )}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VoiceModePage() {
  const { user } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [questions, setQuestions] = useState<VoiceQuestion[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [done, setDone] = useState(false);

  const { supported, listening, transcript, startListening, stopListening, resetTranscript } = useVoiceRecognition();

  useEffect(() => {
    supabase.from("modules").select("id, nom").order("nom").then(({ data }) => setModules(data ?? []));
  }, []);

  // Watch transcript to auto-parse answer
  useEffect(() => {
    if (!transcript || answered) return;
    const currentQ = questions[qIdx];
    if (!currentQ) return;
    const idx = parseVoiceAnswer(transcript, currentQ.choices);
    if (idx !== null) { handleSelect(idx); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  async function loadQuestions(moduleId: number) {
    setLoading(true);
    const { data } = await supabase
      .from("questions")
      .select("id, texte, module_id, activity_id, choices(id, contenu, est_correct, explication)")
      .eq("module_id", moduleId)
      .not("source_type", "in", '("open","no_answer")')
      .limit(20)
      .order("random()");
    setLoading(false);
    if (!data?.length) return;
    setQuestions(data as VoiceQuestion[]);
    setQIdx(0); setAnswered(false); setSelectedIdx(null); setIsCorrect(null);
    setScore({ correct: 0, wrong: 0 }); setDone(false);
  }

  function handleSelect(idx: number) {
    if (answered) return;
    const currentQ = questions[qIdx];
    if (!currentQ) return;
    const correct = currentQ.choices[idx]?.est_correct ?? false;
    setSelectedIdx(idx);
    setAnswered(true);
    setIsCorrect(correct);
    setScore((s) => ({ ...s, [correct ? "correct" : "wrong"]: s[correct ? "correct" : "wrong"] + 1 }));
    stopListening();

    // Save to user_answers
    if (user && currentQ.choices[idx]) {
      supabase.from("user_answers").upsert({
        user_id: user.id,
        question_id: currentQ.id,
        choice_id: currentQ.choices[idx].id,
        is_correct: correct,
        module_id: currentQ.module_id,
      }, { onConflict: "user_id,question_id" });
    }
  }

  function handleNext() {
    if (qIdx + 1 >= questions.length) { setDone(true); return; }
    setQIdx((i) => i + 1);
    setAnswered(false); setSelectedIdx(null); setIsCorrect(null);
    resetTranscript();
  }

  async function handleSelectModule(id: number) {
    const mod = modules.find((m) => m.id === id);
    if (mod) { setSelectedModule(mod); await loadQuestions(id); }
  }

  if (!user) {
    return (
      <main className="min-h-screen pb-24 flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-3 px-6">
          <Mic size={36} className="mx-auto" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-muted)" }}>Connectez-vous pour utiliser le mode vocal.</p>
        </div>
      </main>
    );
  }

  const currentQ = questions[qIdx];

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-8 lg:pt-10 space-y-5">

        {/* Module picker */}
        {!selectedModule && !loading && (
          <ModulePicker modules={modules} onSelect={handleSelectModule} />
        )}

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        )}

        {/* Active session */}
        {selectedModule && !loading && !done && currentQ && (
          <AnimatePresence mode="wait">
            <VoiceQuestionCard
              key={qIdx} question={currentQ} qIdx={qIdx} total={questions.length}
              answered={answered} isCorrect={isCorrect} selectedIdx={selectedIdx}
              transcript={transcript} listening={listening} supported={supported}
              onVoiceStart={() => startListening("fr-FR")} onVoiceStop={stopListening}
              onManualSelect={handleSelect} onNext={handleNext}
              onBack={() => setSelectedModule(null)} />
          </AnimatePresence>
        )}

        {/* Results */}
        {done && selectedModule && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedModule(null)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-70"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <ArrowLeft size={16} style={{ color: "var(--text-secondary)" }} />
              </button>
              <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>Résultats</h2>
            </div>

            <div className="rounded-3xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <Trophy size={32} className="mx-auto mb-3" style={{ color: "#FFD700" }} />
              <p className="text-3xl font-bold mb-1" style={{ color: "var(--text)" }}>
                {Math.round((score.correct / questions.length) * 100)}%
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {score.correct}/{questions.length} correctes
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center py-4 rounded-2xl"
                style={{ background: "var(--success-subtle)", border: "1px solid var(--success-border)" }}>
                <span className="text-2xl font-bold" style={{ color: "var(--success)" }}>{score.correct}</span>
                <span className="text-xs mt-0.5" style={{ color: "var(--success)" }}>Correctes</span>
              </div>
              <div className="flex flex-col items-center py-4 rounded-2xl"
                style={{ background: "var(--error-subtle)", border: "1px solid var(--error-border)" }}>
                <span className="text-2xl font-bold" style={{ color: "var(--error)" }}>{score.wrong}</span>
                <span className="text-xs mt-0.5" style={{ color: "var(--error)" }}>Incorrectes</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => loadQuestions(selectedModule.id)}
                className="flex-1 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 border"
                style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}>
                <RefreshCw size={15} /> Recommencer
              </button>
              <button onClick={() => setSelectedModule(null)}
                className="flex-1 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
                <BookOpen size={15} /> Autre module
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
