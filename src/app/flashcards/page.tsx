"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  Layers, BookOpen, CheckCircle2, XCircle, RefreshCw,
  ChevronRight, Loader2, ArrowLeft, RotateCcw, Trophy,
  Brain, Flame
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Flashcard {
  question_id: string; texte: string;
  choices: { id: string; contenu: string; est_correct: boolean; explication: string | null }[];
  status: "new" | "learning" | "known";
  interval_days: number; reviews: number;
}
interface Module { id: number; nom: string; semester_id: string; }

// ─── SM-2 Algorithm ──────────────────────────────────────────────────────────
function sm2(card: Flashcard, quality: 0 | 3 | 5): { interval: number; ease: number; status: Flashcard["status"] } {
  // quality: 0 = wrong, 3 = hard, 5 = easy
  const oldEase = 2.5;
  const newEase = Math.max(1.3, oldEase + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (quality < 3) return { interval: 1, ease: newEase, status: "learning" };
  const newInterval = card.reviews === 0 ? 1 : card.reviews === 1 ? 6 : Math.round(card.interval_days * newEase);
  return { interval: newInterval, ease: newEase, status: newInterval >= 21 ? "known" : "learning" };
}

// ─── Flip Card ────────────────────────────────────────────────────────────────
function FlipCard({ card, flipped, onFlip }: { card: Flashcard; flipped: boolean; onFlip: () => void }) {
  const correctChoice = card.choices.find((c) => c.est_correct);

  return (
    <div className="relative" style={{ perspective: "1200px", height: "min(360px, 45vw)" }}>
      <motion.div
        className="absolute inset-0 cursor-pointer"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, type: "spring", damping: 25, stiffness: 200 }}
        onClick={onFlip}>

        {/* Front: Question */}
        <div className="absolute inset-0 rounded-3xl flex flex-col items-center justify-center p-6 text-center"
          style={{ backfaceVisibility: "hidden", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}>
            <Brain size={20} style={{ color: "var(--accent)" }} />
          </div>
          <p className="text-sm leading-relaxed font-medium" style={{ color: "var(--text)" }}>{card.texte}</p>
          <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>Appuyez pour révéler la réponse</p>
        </div>

        {/* Back: Answer */}
        <div className="absolute inset-0 rounded-3xl flex flex-col items-center justify-center p-6 text-center"
          style={{
            backfaceVisibility: "hidden", transform: "rotateY(180deg)",
            background: "var(--success-subtle)", border: "1px solid var(--success-border)"
          }}>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "var(--success-subtle)", border: "1px solid var(--success-border)" }}>
            <CheckCircle2 size={20} style={{ color: "var(--success)" }} />
          </div>
          <p className="text-sm font-bold mb-2" style={{ color: "var(--success)" }}>
            {correctChoice?.contenu}
          </p>
          {correctChoice?.explication && (
            <p className="text-xs leading-relaxed mt-2" style={{ color: "var(--text-secondary)" }}>
              {correctChoice.explication}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Swipe Card ───────────────────────────────────────────────────────────────
function SwipeCard({
  card, onSwipe,
}: {
  card: Flashcard;
  onSwipe: (dir: "left" | "right" | "up") => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-18, 0, 18]);
  const leftOpacity = useTransform(x, [-80, 0], [1, 0]);
  const rightOpacity = useTransform(x, [0, 80], [0, 1]);

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (Math.abs(info.offset.x) > 100) {
      onSwipe(info.offset.x > 0 ? "right" : "left");
    }
  }

  return (
    <div className="relative select-none">
      {/* Swipe hint labels */}
      <motion.div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 px-3 py-1.5 rounded-xl text-sm font-bold"
        style={{ opacity: leftOpacity, background: "var(--error-subtle)", color: "var(--error)", border: "1px solid var(--error-border)" }}>
        À revoir
      </motion.div>
      <motion.div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 px-3 py-1.5 rounded-xl text-sm font-bold"
        style={{ opacity: rightOpacity, background: "var(--success-subtle)", color: "var(--success)", border: "1px solid var(--success-border)" }}>
        Acquis
      </motion.div>

      <motion.div
        style={{ x, rotate }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={handleDragEnd}
        whileHover={{ cursor: "grab" }}
        whileDrag={{ cursor: "grabbing" }}>
        <FlipCard card={card} flipped={flipped} onFlip={() => setFlipped(!flipped)} />
      </motion.div>
    </div>
  );
}

// ─── Module Picker ────────────────────────────────────────────────────────────
function ModulePicker({ modules, onSelect }: { modules: Module[]; onSelect: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const filtered = modules.filter((m) => m.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Flashcards</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Choisissez un module pour commencer la révision.
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
                <Layers size={15} style={{ color: "var(--text-muted)" }} />
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

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ cards }: { cards: Flashcard[] }) {
  const known    = cards.filter((c) => c.status === "known").length;
  const learning = cards.filter((c) => c.status === "learning").length;
  const newCards = cards.filter((c) => c.status === "new").length;

  return (
    <div className="flex gap-2">
      {[
        { label: "Nouveaux", count: newCards, color: "var(--accent)", bg: "var(--accent-subtle)", border: "var(--accent-border)" },
        { label: "En cours", count: learning, color: "var(--warning)", bg: "var(--warning-subtle)", border: "var(--warning-border)" },
        { label: "Acquis",   count: known,    color: "var(--success)", bg: "var(--success-subtle)", border: "var(--success-border)" },
      ].map((s) => (
        <div key={s.label} className="flex-1 flex flex-col items-center py-2.5 rounded-2xl"
          style={{ background: s.bg, border: `1px solid ${s.border}` }}>
          <span className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.count}</span>
          <span className="text-[10px] mt-0.5" style={{ color: s.color }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FlashcardsPage() {
  const { user, profile } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0, skipped: 0 });

  useEffect(() => {
    if (!profile) return;
    const year = profile.annee_etude;
    const s1 = `S${2 * year - 1}`;
    const s2 = `S${2 * year}`;
    supabase
      .from("modules")
      .select("id, nom, semester_id")
      .in("semester_id", [s1, s2])
      .order("nom")
      .then(({ data }) => setModules(data ?? []));
  }, [profile]);

  async function loadCards(moduleId: number) {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_due_flashcards", {
      p_user_id: user.id, p_module_id: moduleId,
    });
    setLoading(false);
    if (error) { setLoadError(true); setCards([]); return; }
    setLoadError(false);
    if (!data?.length) { setCards([]); return; }
    setCards(data as Flashcard[]);
    setCardIdx(0); setDone(false);
    setSessionStats({ correct: 0, wrong: 0, skipped: 0 });
  }

  async function saveCardResult(card: Flashcard, quality: 0 | 3 | 5) {
    if (!user) return;
    const { interval, ease, status } = sm2(card, quality);
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    await supabase.from("flashcard_sessions").upsert({
      user_id: user.id,
      module_id: selectedModule!.id,
      question_id: card.question_id,
      status,
      next_review: nextReview.toISOString(),
      interval_days: interval,
      ease_factor: ease,
      reviews: card.reviews + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,question_id" });
  }

  async function handleSwipe(dir: "left" | "right" | "up") {
    const card = cards[cardIdx];
    if (!card) return;

    if (dir === "right") {
      await saveCardResult(card, 5);
      setSessionStats((s) => ({ ...s, correct: s.correct + 1 }));
    } else if (dir === "left") {
      await saveCardResult(card, 0);
      setSessionStats((s) => ({ ...s, wrong: s.wrong + 1 }));
    }

    if (cardIdx + 1 >= cards.length) { setDone(true); } else { setCardIdx((i) => i + 1); }
  }

  async function handleDifficultyBtn(quality: 0 | 3 | 5) {
    const card = cards[cardIdx];
    if (!card) return;
    await saveCardResult(card, quality);
    if (quality === 5) setSessionStats((s) => ({ ...s, correct: s.correct + 1 }));
    else if (quality === 0) setSessionStats((s) => ({ ...s, wrong: s.wrong + 1 }));
    else setSessionStats((s) => ({ ...s, skipped: s.skipped + 1 }));
    if (cardIdx + 1 >= cards.length) { setDone(true); } else { setCardIdx((i) => i + 1); }
  }

  async function handleSelectModule(id: number) {
    const mod = modules.find((m) => m.id === id);
    if (mod) { setSelectedModule(mod); await loadCards(id); }
  }

  if (!user) {
    return (
      <main className="min-h-screen pb-24 flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-3 px-6">
          <Layers size={36} className="mx-auto" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-muted)" }}>Connectez-vous pour utiliser les flashcards.</p>
        </div>
      </main>
    );
  }

  const currentCard = cards[cardIdx];
  const progress = cards.length > 0 ? ((cardIdx) / cards.length) * 100 : 0;

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-8 lg:pt-10 space-y-5">

        {/* Module picker view */}
        {!selectedModule && !loading && (
          <ModulePicker modules={modules} onSelect={handleSelectModule} />
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        )}

        {/* Active session */}
        {selectedModule && !loading && !done && (
          <>
            {/* Header */}
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedModule(null)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-70"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <ArrowLeft size={16} style={{ color: "var(--text-secondary)" }} />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold truncate" style={{ color: "var(--text)" }}>{selectedModule.nom}</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {cardIdx + 1} / {cards.length} cartes
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
              <motion.div className="h-full rounded-full" style={{ background: "var(--accent)" }}
                animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
            </div>

            {/* Stats bar */}
            <StatsBar cards={cards} />

            {/* No cards due */}
            {cards.length === 0 && !loadError && (
              <div className="flex flex-col items-center py-12 text-center space-y-3">
                <Trophy size={32} style={{ color: "var(--warning)" }} />
                <p className="font-semibold" style={{ color: "var(--text)" }}>Tout est à jour !</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucune carte à réviser maintenant.</p>
              </div>
            )}
            {loadError && (
              <div className="flex flex-col items-center py-12 text-center space-y-3">
                <Brain size={32} style={{ color: "var(--text-muted)" }} />
                <p className="font-semibold" style={{ color: "var(--text)" }}>Fonctionnalité non disponible</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>La base de données de flashcards n&apos;est pas encore configurée.</p>
              </div>
            )}

            {/* Card */}
            {currentCard && (
              <AnimatePresence mode="wait">
                <motion.div key={cardIdx} initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <SwipeCard card={currentCard} onSwipe={handleSwipe} />
                </motion.div>
              </AnimatePresence>
            )}

            {/* Difficulty buttons */}
            {currentCard && (
              <div className="flex gap-2">
                <button onClick={() => handleDifficultyBtn(0)}
                  className="flex-1 py-3 rounded-2xl text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  style={{ background: "var(--error-subtle)", color: "var(--error)", border: "1px solid var(--error-border)" }}>
                  <XCircle size={14} /> À revoir
                </button>
                <button onClick={() => handleDifficultyBtn(3)}
                  className="flex-1 py-3 rounded-2xl text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  style={{ background: "var(--warning-subtle)", color: "var(--warning)", border: "1px solid var(--warning-border)" }}>
                  <RefreshCw size={14} /> Difficile
                </button>
                <button onClick={() => handleDifficultyBtn(5)}
                  className="flex-1 py-3 rounded-2xl text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  style={{ background: "var(--success-subtle)", color: "var(--success)", border: "1px solid var(--success-border)" }}>
                  <CheckCircle2 size={14} /> Facile
                </button>
              </div>
            )}

            {/* Swipe hint */}
            <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
              Glissez à droite = acquis · gauche = à revoir · cliquez la carte pour révéler
            </p>
          </>
        )}

        {/* Session done */}
        {done && selectedModule && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedModule(null)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-70"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <ArrowLeft size={16} style={{ color: "var(--text-secondary)" }} />
              </button>
              <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>Session terminée</h2>
            </div>

            <div className="rounded-3xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <Flame size={32} className="mx-auto mb-3" style={{ color: "var(--warning)" }} />
              <p className="text-2xl font-bold mb-1" style={{ color: "var(--text)" }}>
                {Math.round((sessionStats.correct / cards.length) * 100)}%
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>de réussite</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Correct", val: sessionStats.correct, color: "var(--success)", bg: "var(--success-subtle)", border: "var(--success-border)" },
                { label: "Difficile", val: sessionStats.skipped, color: "var(--warning)", bg: "var(--warning-subtle)", border: "var(--warning-border)" },
                { label: "À revoir", val: sessionStats.wrong, color: "var(--error)", bg: "var(--error-subtle)", border: "var(--error-border)" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center py-3 rounded-2xl"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <span className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.val}</span>
                  <span className="text-[10px] mt-0.5" style={{ color: s.color }}>{s.label}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => loadCards(selectedModule.id)}
                className="flex-1 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 border"
                style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}>
                <RotateCcw size={15} /> Recommencer
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
