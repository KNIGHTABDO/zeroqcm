"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, LogIn, Copy, Check, Crown, ArrowRight, ArrowLeft,
  Trophy, Timer, Loader2, X, BookOpen, Wifi, WifiOff, Zap
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

// ─── Types ───────────────────────────────────────────────────────────────────
interface StudyRoom {
  id: string; code: string; name: string; module_id: number;
  host_id: string; status: "waiting" | "active" | "finished";
  current_q_idx: number; questions: string[]; created_at: string;
}
interface Participant {
  id: string; room_id: string; user_id: string;
  display_name: string; score: number;
  answers: Record<string, string>;
}
interface Choice { id: string; contenu: string; est_correct: boolean; explication: string | null; }
interface Question { id: string; texte: string; choices: Choice[]; }
interface Module { id: number; nom: string; semester_id: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function genCode() {
  return Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ onCreateRoom, onJoinRoom }: { onCreateRoom: () => void; onJoinRoom: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-6">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <Users size={36} style={{ color: "var(--text-muted)" }} />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text)" }}>Salles d&apos;étude</h2>
        <p className="text-sm leading-relaxed max-w-xs" style={{ color: "var(--text-muted)" }}>
          Étudiez en groupe en temps réel. Créez une salle ou rejoignez-en une avec un code.
        </p>
      </div>
      <div className="flex gap-3 flex-wrap justify-center">
        <button onClick={onCreateRoom}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
          <Plus size={16} /> Créer une salle
        </button>
        <button onClick={onJoinRoom}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 border"
          style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}>
          <LogIn size={16} /> Rejoindre
        </button>
      </div>
    </motion.div>
  );
}

function CreateModal({
  onClose, onCreated, modules, userId, displayName,
}: {
  onClose: () => void;
  onCreated: (room: StudyRoom, participant: Participant) => void;
  modules: Module[];
  userId: string;
  displayName: string;
}) {
  const [name, setName] = useState("");
  const [moduleId, setModuleId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  async function handleCreate() {
    if (!name.trim() || !moduleId) { setErr("Choisissez un nom et un module."); return; }
    setCreating(true); setErr("");

    // Fetch questions for this module
    const { data: qData, error: qErr } = await supabase
      .from("questions")
      .select("id")
      .eq("module_id", moduleId)
      .not("source_type", "in", "(open,no_answer)")
      .limit(60);

    if (qErr || !qData?.length) { setErr("Aucune question disponible."); setCreating(false); return; }
    // Shuffle and pick 20 random questions
    const allIds = qData.map((q) => q.id);
    for (let i = allIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
    }
    const questionIds = allIds.slice(0, 20);
    const code = genCode();

    const { data: room, error: rErr } = await supabase
      .from("study_rooms")
      .insert({ code, name: name.trim(), module_id: moduleId, host_id: userId, questions: questionIds })
      .select()
      .single();

    if (rErr || !room) { setErr("Impossible de créer la salle."); setCreating(false); return; }

    const { data: participant, error: pErr } = await supabase
      .from("room_participants")
      .insert({ room_id: room.id, user_id: userId, display_name: displayName })
      .select()
      .single();

    if (pErr || !participant) { setErr("Erreur de participation."); setCreating(false); return; }
    onCreated(room, participant);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "var(--overlay)" }} onClick={onClose}>
      <motion.div initial={{ y: 40, scale: 0.97 }} animate={{ y: 0, scale: 1 }}
        exit={{ y: 40, scale: 0.97 }} transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="w-full max-w-sm rounded-3xl p-6 space-y-5"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>Créer une salle</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center transition hover:opacity-70"
            style={{ background: "var(--surface)" }}>
            <X size={15} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Nom de la salle
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: S3 Cardio révision..."
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--input-text)" }}
              maxLength={50} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Module
            </label>
            <select value={moduleId ?? ""} onChange={(e) => setModuleId(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition appearance-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: moduleId ? "var(--input-text)" : "var(--input-placeholder)" }}>
              <option value="">Choisir un module…</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.nom}</option>
              ))}
            </select>
          </div>
        </div>

        {err && <p className="text-xs px-3 py-2 rounded-xl" style={{ color: "var(--error)", background: "var(--error-subtle)" }}>{err}</p>}

        <button onClick={handleCreate} disabled={creating || !name.trim() || !moduleId}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {creating ? "Création…" : "Créer la salle"}
        </button>
      </motion.div>
    </motion.div>
  );
}

function JoinModal({
  onClose, onJoined, userId, displayName,
}: {
  onClose: () => void;
  onJoined: (room: StudyRoom, participant: Participant) => void;
  userId: string;
  displayName: string;
}) {
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState("");

  async function handleJoin() {
    const c = code.trim().toUpperCase();
    if (c.length !== 6) { setErr("Code à 6 caractères requis."); return; }
    setJoining(true); setErr("");

    const { data: room, error: rErr } = await supabase
      .from("study_rooms")
      .select("*")
      .eq("code", c)
      .single();

    if (rErr || !room) { setErr("Salle introuvable."); setJoining(false); return; }
    if (room.status === "finished") { setErr("Cette salle est terminée."); setJoining(false); return; }

    // Upsert participant
    const { data: participant, error: pErr } = await supabase
      .from("room_participants")
      .upsert({ room_id: room.id, user_id: userId, display_name: displayName }, { onConflict: "room_id,user_id" })
      .select()
      .single();

    if (pErr || !participant) { setErr("Impossible de rejoindre."); setJoining(false); return; }
    onJoined(room, participant);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "var(--overlay)" }} onClick={onClose}>
      <motion.div initial={{ y: 40, scale: 0.97 }} animate={{ y: 0, scale: 1 }}
        exit={{ y: 40, scale: 0.97 }} transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="w-full max-w-sm rounded-3xl p-6 space-y-5"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>Rejoindre une salle</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center transition hover:opacity-70"
            style={{ background: "var(--surface)" }}>
            <X size={15} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Code de la salle</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="EX: AB3XY7"
            maxLength={6} className="w-full px-4 py-3.5 rounded-2xl text-xl font-bold text-center tracking-widest outline-none transition"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--input-text)", letterSpacing: "0.25em" }}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
        </div>
        {err && <p className="text-xs px-3 py-2 rounded-xl" style={{ color: "var(--error)", background: "var(--error-subtle)" }}>{err}</p>}
        <button onClick={handleJoin} disabled={joining || code.trim().length !== 6}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
          {joining ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {joining ? "Connexion…" : "Rejoindre"}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Waiting Room ─────────────────────────────────────────────────────────────
function WaitingRoom({
  room, participants, isHost, onStart, onLeave, copied, onCopy,
}: {
  room: StudyRoom; participants: Participant[]; isHost: boolean;
  onStart: () => void; onLeave: () => void; copied: boolean; onCopy: () => void;
}) {
  return (
    <motion.div key="waiting" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onLeave} className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-70"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <ArrowLeft size={16} style={{ color: "var(--text-secondary)" }} />
        </button>
        <div className="text-center flex-1 px-4">
          <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>{room.name}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>En attente des participants</p>
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: isHost ? "var(--warning-subtle)" : "var(--surface)", border: `1px solid ${isHost ? "var(--warning-border)" : "var(--border)"}` }}>
          {isHost ? <Crown size={15} style={{ color: "var(--warning)" }} /> : <Users size={15} style={{ color: "var(--text-secondary)" }} />}
        </div>
      </div>

      {/* Code */}
      <div className="rounded-3xl p-5 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs mb-3 font-medium uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Code de la salle</p>
        <div className="text-4xl font-bold tracking-[0.2em] mb-4" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          {room.code}
        </div>
        <button onClick={onCopy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
          style={{ background: "var(--surface-alt)", color: copied ? "var(--success)" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copié !" : "Copier le code"}
        </button>
      </div>

      {/* Participants */}
      <div className="rounded-3xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-4 py-3 border-b flex items-center gap-2"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <Users size={14} style={{ color: "var(--text-muted)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Participants ({participants.length})
          </span>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {participants.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: "var(--bg-secondary)" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: "var(--surface-alt)", color: "var(--text)" }}>
                {p.display_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium flex-1" style={{ color: "var(--text)" }}>{p.display_name}</span>
              {p.user_id === room.host_id && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "var(--warning-subtle)", color: "var(--warning)", border: "1px solid var(--warning-border)" }}>
                  Hôte
                </span>
              )}
            </motion.div>
          ))}
          {participants.length === 0 && (
            <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}>
              En attente de joueurs…
            </div>
          )}
        </div>
      </div>

      {/* Start button (host only) */}
      {isHost && (
        <button onClick={onStart} disabled={participants.length < 1}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
          <Zap size={16} />
          Démarrer ({participants.length} joueur{participants.length !== 1 ? "s" : ""})
        </button>
      )}
      {!isHost && (
        <div className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm"
          style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          <Loader2 size={14} className="animate-spin" />
          En attente du démarrage par l&apos;hôte…
        </div>
      )}
    </motion.div>
  );
}

// ─── Question View ─────────────────────────────────────────────────────────────
function QuestionView({
  question, qIdx, total, myAnswer, participants, isHost, timeLeft,
  onAnswer, onNext, onLeave,
}: {
  question: Question; qIdx: number; total: number;
  myAnswer: string | null; participants: Participant[]; isHost: boolean;
  timeLeft: number; onAnswer: (choiceId: string) => void;
  onNext: () => void; onLeave: () => void;
}) {
  const answeredCount = participants.filter(p => p.answers[String(qIdx)] != null).length;
  const allAnswered = answeredCount >= participants.length && participants.length > 0;
  const showResults = myAnswer != null;
  const progress = (qIdx / total) * 100;
  const timerPct = (timeLeft / 30) * 100;

  const LETTERS = ["A", "B", "C", "D", "E"];

  return (
    <motion.div key={`q-${qIdx}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onLeave} className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-70"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <ArrowLeft size={16} style={{ color: "var(--text-secondary)" }} />
        </button>
        <div className="text-center flex-1 px-4">
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Q {qIdx + 1} / {total}
          </span>
        </div>
        {/* Timer */}
        <div className="relative w-9 h-9">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="3" />
            <motion.circle cx="18" cy="18" r="15" fill="none"
              stroke={timeLeft <= 10 ? "var(--error)" : "var(--accent)"}
              strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 15}`}
              animate={{ strokeDashoffset: `${2 * Math.PI * 15 * (1 - timerPct / 100)}` }}
              transition={{ duration: 0.5 }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-bold tabular-nums" style={{ color: timeLeft <= 10 ? "var(--error)" : "var(--text)" }}>
              {timeLeft}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
        <motion.div className="h-full rounded-full" style={{ background: "var(--accent)" }}
          animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
      </div>

      {/* Question */}
      <div className="rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{question.texte}</p>
      </div>

      {/* Choices */}
      <div className="space-y-2.5">
        {question.choices.map((choice, i) => {
          const selected = myAnswer === choice.id;
          const isCorrect = choice.est_correct;
          let bg = "var(--surface)";
          let border = "var(--border)";
          let textColor = "var(--text)";
          if (showResults) {
            if (isCorrect) { bg = "var(--success-subtle)"; border = "var(--success-border)"; textColor = "var(--success)"; }
            else if (selected) { bg = "var(--error-subtle)"; border = "var(--error-border)"; textColor = "var(--error)"; }
          } else if (selected) {
            bg = "var(--accent-subtle)"; border = "var(--accent-border)"; textColor = "var(--accent)";
          }

          return (
            <motion.button key={choice.id} onClick={() => !myAnswer && onAnswer(choice.id)}
              whileHover={!myAnswer ? { scale: 1.01 } : {}}
              whileTap={!myAnswer ? { scale: 0.99 } : {}}
              className="w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
              style={{ background: bg, border: `1px solid ${border}`, cursor: myAnswer ? "default" : "pointer" }}>
              <span className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5"
                style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}>
                {LETTERS[i]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed" style={{ color: textColor }}>{choice.contenu}</p>
                {showResults && isCorrect && choice.explication && (
                  <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {choice.explication}
                  </p>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Answered indicator */}
      {participants.length > 1 && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <div className="flex gap-1">
            {participants.map((p) => (
              <div key={p.id} className="w-2 h-2 rounded-full transition-all"
                style={{ background: p.answers[String(qIdx)] ? "var(--success)" : "var(--border)" }} />
            ))}
          </div>
          <span>{answeredCount}/{participants.length} ont répondu</span>
        </div>
      )}

      {/* Next button */}
      {showResults && isHost && (
        <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          onClick={onNext}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
          {qIdx + 1 < total ? <><ArrowRight size={16} />Question suivante</> : <><Trophy size={16} />Voir les résultats</>}
        </motion.button>
      )}
      {showResults && !isHost && (
        <div className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm"
          style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          <Loader2 size={14} className="animate-spin" />
          En attente de l&apos;hôte…
        </div>
      )}
    </motion.div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────
function ResultsView({ participants, total, onLeave }: { participants: Participant[]; total: number; onLeave: () => void; }) {
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

  return (
    <motion.div key="results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>Résultats</h2>
        <button onClick={onLeave} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition hover:opacity-70"
          style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          <X size={14} /> Quitter
        </button>
      </div>

      {/* Winner podium */}
      {sorted[0] && (
        <div className="rounded-3xl p-5 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <Trophy size={28} className="mx-auto mb-2" style={{ color: "#FFD700" }} />
          <p className="text-lg font-bold" style={{ color: "var(--text)" }}>{sorted[0].display_name}</p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {sorted[0].score}/{total} correct{sorted[0].score !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Rankings */}
      <div className="space-y-2">
        {sorted.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-4 px-4 py-3.5 rounded-2xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: i < 3 ? `${medalColors[i]}22` : "var(--surface-alt)", color: i < 3 ? medalColors[i] : "var(--text-muted)" }}>
              {i + 1}
            </span>
            <span className="flex-1 text-sm font-medium" style={{ color: "var(--text)" }}>{p.display_name}</span>
            <div className="text-right">
              <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{p.score}/{total}</span>
              <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>
                ({total > 0 ? Math.round(p.score / total * 100) : 0}%)
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function StudyRoomsPage() {
  const { user, profile } = useAuth();
  const displayName = profile?.full_name || profile?.username || user?.email?.split("@")[0] || "Anonyme";
  const [view, setView] = useState<"lobby" | "waiting" | "active" | "results">("lobby");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [room, setRoom] = useState<StudyRoom | null>(null);
  const [myParticipant, setMyParticipant] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load modules filtered by user's year of study
  useEffect(() => {
    if (!profile) return;
    const year = profile.annee_etude;
    // Year N → semesters S(2N-1) and S(2N)  e.g. year 2 → S3, S4
    const s1 = \`S\${2 * year - 1}\`;
    const s2 = \`S\${2 * year}\`;
    supabase
      .from("modules")
      .select("id, nom, semester_id")
      .in("semester_id", [s1, s2])
      .order("nom")
      .then(({ data }) => setModules(data ?? []));
  }, [profile]);

  // Realtime subscription to room + participants
  const subscribeToRoom = useCallback((roomId: string) => {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); }

    const chan = supabase.channel(`room:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${roomId}` },
        async () => {
          const { data } = await supabase.from("room_participants").select("*").eq("room_id", roomId);
          setParticipants(data ?? []);
          if (data && myParticipant) {
            const updated = data.find((p) => p.user_id === user?.id);
            if (updated) setMyParticipant(updated);
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "study_rooms", filter: `id=eq.${roomId}` },
        ({ new: newRoom }: { new: StudyRoom }) => {
          setRoom(newRoom);
          if (newRoom.status === "active") { setCurrentQIdx(newRoom.current_q_idx); setView("active"); }
          if (newRoom.status === "finished") setView("results");
          if (newRoom.current_q_idx !== currentQIdx) { setCurrentQIdx(newRoom.current_q_idx); setTimeLeft(30); }
        })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    channelRef.current = chan;
  }, [myParticipant, user?.id, currentQIdx]);

  // Load questions when room becomes active
  useEffect(() => {
    if (!room || room.status !== "active" || !room.questions?.length) return;
    const ids = room.questions;
    supabase
      .from("questions")
      .select("id, texte, choices(id, contenu, est_correct, explication)")
      .in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        const ordered = ids.map((id) => data.find((q) => q.id === id)).filter(Boolean) as Question[];
        setQuestions(ordered);
      });
  }, [room?.status, room?.questions]);

  // Timer when question is active
  useEffect(() => {
    if (view !== "active") return;
    const myAns = myParticipant?.answers[String(currentQIdx)];
    if (myAns) return; // already answered
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [view, currentQIdx, myParticipant?.answers]);

  // Cleanup on unmount
  useEffect(() => () => { if (channelRef.current) supabase.removeChannel(channelRef.current); }, []);

  async function handleCreated(newRoom: StudyRoom, participant: Participant) {
    setRoom(newRoom); setMyParticipant(participant);
    const { data } = await supabase.from("room_participants").select("*").eq("room_id", newRoom.id);
    setParticipants(data ?? []);
    subscribeToRoom(newRoom.id);
    setShowCreate(false); setView("waiting");
  }

  async function handleJoined(newRoom: StudyRoom, participant: Participant) {
    setRoom(newRoom); setMyParticipant(participant);
    const { data } = await supabase.from("room_participants").select("*").eq("room_id", newRoom.id);
    setParticipants(data ?? []);
    subscribeToRoom(newRoom.id);
    setShowJoin(false);
    setView(newRoom.status === "active" ? "active" : "waiting");
  }

  async function handleStart() {
    if (!room || !user || room.host_id !== user.id) return;
    await supabase.from("study_rooms").update({ status: "active", current_q_idx: 0 }).eq("id", room.id);
    setCurrentQIdx(0); setTimeLeft(30); setView("active");
  }

  async function handleAnswer(choiceId: string) {
    if (!room || !user || !myParticipant) return;
    const currentQ = questions[currentQIdx];
    if (!currentQ) return;
    const isCorrect = currentQ.choices.find((c) => c.id === choiceId)?.est_correct ?? false;
    const newAnswers = { ...myParticipant.answers, [String(currentQIdx)]: choiceId };
    const newScore = myParticipant.score + (isCorrect ? 1 : 0);
    await supabase.from("room_participants")
      .update({ answers: newAnswers, score: newScore })
      .eq("id", myParticipant.id);
    setMyParticipant({ ...myParticipant, answers: newAnswers, score: newScore });
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function handleNext() {
    if (!room || !user || room.host_id !== user.id) return;
    const nextIdx = currentQIdx + 1;
    if (nextIdx >= questions.length) {
      await supabase.from("study_rooms").update({ status: "finished" }).eq("id", room.id);
      setView("results");
    } else {
      await supabase.from("study_rooms").update({ current_q_idx: nextIdx }).eq("id", room.id);
      setCurrentQIdx(nextIdx); setTimeLeft(30);
    }
  }

  async function handleLeave() {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (user && room) {
      await supabase.from("room_participants").delete().eq("room_id", room.id).eq("user_id", user.id);
    }
    setRoom(null); setMyParticipant(null); setParticipants([]); setQuestions([]);
    setCurrentQIdx(0); setTimeLeft(30); setView("lobby");
  }

  function handleCopy() {
    if (!room) return;
    navigator.clipboard.writeText(room.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const isHost = !!(user && room && room.host_id === user.id);
  const currentQ = questions[currentQIdx] ?? null;
  const myAnswer = myParticipant?.answers[String(currentQIdx)] ?? null;

  if (!user) {
    return (
      <main className="min-h-screen pb-24 flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-3 px-6">
          <Users size={36} className="mx-auto" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-muted)" }}>Connectez-vous pour accéder aux salles d&apos;étude.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-lg mx-auto px-4 pt-8 lg:pt-10">

        {/* Connection indicator */}
        {view !== "lobby" && (
          <div className="flex items-center justify-end mb-3 gap-1.5 text-xs" style={{ color: connected ? "var(--success)" : "var(--text-muted)" }}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? "Connecté" : "Reconnexion…"}
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === "lobby" && (
            <EmptyState key="lobby" onCreateRoom={() => setShowCreate(true)} onJoinRoom={() => setShowJoin(true)} />
          )}
          {view === "waiting" && room && (
            <WaitingRoom key="waiting" room={room} participants={participants} isHost={isHost}
              onStart={handleStart} onLeave={handleLeave} copied={copied} onCopy={handleCopy} />
          )}
          {view === "active" && currentQ && (
            <QuestionView key={`active-${currentQIdx}`} question={currentQ} qIdx={currentQIdx}
              total={questions.length} myAnswer={myAnswer} participants={participants}
              isHost={isHost} timeLeft={timeLeft} onAnswer={handleAnswer}
              onNext={handleNext} onLeave={handleLeave} />
          )}
          {view === "results" && (
            <ResultsView key="results" participants={participants} total={questions.length} onLeave={handleLeave} />
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal key="create" onClose={() => setShowCreate(false)} onCreated={handleCreated}
            modules={modules} userId={user.id} displayName={displayName} />
        )}
        {showJoin && (
          <JoinModal key="join" onClose={() => setShowJoin(false)} onJoined={handleJoined}
            userId={user.id} displayName={displayName} />
        )}
      </AnimatePresence>
    </main>
  );
}
