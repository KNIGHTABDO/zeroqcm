"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Copy, Check, Crown, ArrowRight, ArrowLeft,
  Trophy, Loader2, X, Wifi, WifiOff, Zap
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter, useParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudyRoom {
  id: string; code: string; name: string; module_id: number;
  host_id: string; status: "waiting" | "active" | "finished";
  current_q_idx: number; questions: string[];
}
interface Participant {
  id: string; room_id: string; user_id: string;
  display_name: string; score: number; answers: Record<string, string>;
}
interface Choice { id: string; contenu: string; est_correct: boolean; explication: string | null; }
interface Question { id: string; texte: string; choices: Choice[]; }

const LETTERS = ["A", "B", "C", "D", "E"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fetchQuestions(ids: string[]): Promise<Question[]> {
  if (!ids.length) return [];
  const { data } = await supabase.from("questions")
    .select("id, texte, choices(id, contenu, est_correct, explication)")
    .in("id", ids);
  if (!data) return [];
  // Return in the same order as ids (the room\'s question order)
  return ids
    .map((id) => data.find((q) => q.id === id))
    .filter(Boolean) as Question[];
}

async function fetchParticipants(roomId: string): Promise<Participant[]> {
  const { data } = await supabase.from("room_participants").select("*").eq("room_id", roomId);
  return data ?? [];
}

// ─── WaitingRoom ──────────────────────────────────────────────────────────────
function WaitingRoom({ room, participants, isHost, onStart, onLeave, copied, onCopy, connected }: {
  room: StudyRoom; participants: Participant[]; isHost: boolean;
  onStart: () => void; onLeave: () => void;
  copied: boolean; onCopy: () => void; connected: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onLeave} className="w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-70"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <ArrowLeft size={16} style={{ color: "var(--text-secondary)" }} />
        </button>
        <div className="text-center flex-1 px-4">
          <h2 className="font-bold text-base truncate" style={{ color: "var(--text)" }}>{room.name}</h2>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            {connected
              ? <Wifi size={10} style={{ color: "var(--success)" }} />
              : <WifiOff size={10} style={{ color: "var(--text-muted)" }} />}
            <p className="text-xs" style={{ color: connected ? "var(--success)" : "var(--text-muted)" }}>
              {connected ? "Connecté" : "Reconnexion…"}
            </p>
          </div>
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: isHost ? "var(--warning-subtle)" : "var(--surface)", border: `1px solid ${isHost ? "var(--warning-border)" : "var(--border)"}` }}>
          {isHost ? <Crown size={15} style={{ color: "var(--warning)" }} /> : <Users size={15} style={{ color: "var(--text-secondary)" }} />}
        </div>
      </div>

      {/* Room code */}
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
          {participants.length === 0 && (
            <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}>
              En attente de joueurs…
            </div>
          )}
          {participants.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--bg-secondary)" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: "var(--surface-alt)", color: "var(--text)" }}>
                {p.display_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium flex-1 truncate" style={{ color: "var(--text)" }}>{p.display_name}</span>
              {p.user_id === room.host_id && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                  style={{ background: "var(--warning-subtle)", color: "var(--warning)", border: "1px solid var(--warning-border)" }}>
                  Hôte
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {isHost ? (
        <button onClick={onStart}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
          <Zap size={16} />
          Démarrer ({participants.length} joueur{participants.length !== 1 ? "s" : ""})
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm"
          style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          <Loader2 size={14} className="animate-spin" />
          En attente du démarrage par l&apos;hôte…
        </div>
      )}
    </motion.div>
  );
}

// ─── QuestionView ─────────────────────────────────────────────────────────────
function QuestionView({ question, qIdx, total, myAnswer, participants, isHost, timeLeft, onAnswer, onNext, onLeave }: {
  question: Question; qIdx: number; total: number;
  myAnswer: string | null; participants: Participant[]; isHost: boolean;
  timeLeft: number; onAnswer: (choiceId: string) => void;
  onNext: () => void; onLeave: () => void;
}) {
  const answeredCount = participants.filter((p) => p.answers[String(qIdx)] != null).length;
  const showResults = myAnswer != null || timeLeft === 0;
  const timerPct = (timeLeft / 30) * 100;

  return (
    <motion.div key={`q-${qIdx}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onLeave} className="w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-70"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <ArrowLeft size={16} style={{ color: "var(--text-secondary)" }} />
        </button>
        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Q {qIdx + 1} / {total}</span>
        {/* Circular timer */}
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
            <span className="text-[11px] font-bold tabular-nums"
              style={{ color: timeLeft <= 10 ? "var(--error)" : "var(--text)" }}>
              {timeLeft}
            </span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
        <motion.div className="h-full rounded-full" style={{ background: "var(--accent)" }}
          animate={{ width: `${(qIdx / total) * 100}%` }} transition={{ duration: 0.5 }} />
      </div>

      {/* Question text */}
      <div className="rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{question.texte}</p>
      </div>

      {/* Choices */}
      <div className="space-y-2.5">
        {question.choices.map((choice, i) => {
          const selected = myAnswer === choice.id;
          const isCorrect = choice.est_correct;
          let bg = "var(--surface)", border = "var(--border)", textColor = "var(--text)";
          if (showResults) {
            if (isCorrect) { bg = "var(--success-subtle)"; border = "var(--success-border)"; textColor = "var(--success)"; }
            else if (selected) { bg = "var(--error-subtle)"; border = "var(--error-border)"; textColor = "var(--error)"; }
          } else if (selected) {
            bg = "var(--accent-subtle)"; border = "var(--accent-border)"; textColor = "var(--accent)";
          }
          return (
            <motion.button key={choice.id} onClick={() => !showResults && onAnswer(choice.id)}
              whileHover={!showResults ? { scale: 1.01 } : {}}
              whileTap={!showResults ? { scale: 0.99 } : {}}
              className="w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
              style={{ background: bg, border: `1px solid ${border}`, cursor: showResults ? "default" : "pointer" }}>
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

      {/* Answered dots */}
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

      {/* Next / wait */}
      {showResults && isHost && (
        <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={onNext}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
          {qIdx + 1 < total
            ? <><ArrowRight size={16} />Question suivante</>
            : <><Trophy size={16} />Voir les résultats</>}
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

// ─── ResultsView ──────────────────────────────────────────────────────────────
function ResultsView({ participants, total, onLeave }: { participants: Participant[]; total: number; onLeave: () => void; }) {
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>Résultats</h2>
        <button onClick={onLeave}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm hover:opacity-70"
          style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          <X size={14} /> Quitter
        </button>
      </div>
      {sorted[0] && (
        <div className="rounded-3xl p-5 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <Trophy size={28} className="mx-auto mb-2" style={{ color: "#FFD700" }} />
          <p className="text-lg font-bold" style={{ color: "var(--text)" }}>{sorted[0].display_name}</p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {sorted[0].score}/{total} correct{sorted[0].score !== 1 ? "s" : ""}
          </p>
        </div>
      )}
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
            <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--text)" }}>{p.display_name}</span>
            <div className="text-right flex-shrink-0">
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
type GameView = "loading" | "waiting" | "active" | "results" | "error";

export default function StudyRoomPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;

  const displayName = profile?.full_name || profile?.username || user?.email?.split("@")[0] || "Anonyme";

  const [view, setView] = useState<GameView>("loading");
  const [room, setRoom] = useState<StudyRoom | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myParticipant, setMyParticipant] = useState<Participant | null>(null);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Refs to avoid stale closures in Realtime callbacks
  const roomRef = useRef<StudyRoom | null>(null);
  const questionsRef = useRef<Question[]>([]);
  const myParticipantRef = useRef<Participant | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Bootstrap: load room + my participant from DB on mount ─────────────────
  useEffect(() => {
    if (!user || !roomId) return;

    async function bootstrap() {
      const uid = user?.id;
      if (!uid) return;

      // 1. Fetch room
      const { data: roomData, error: rErr } = await supabase
        .from("study_rooms").select("*").eq("id", roomId).single();

      if (rErr || !roomData) {
        setErrorMsg("Salle introuvable ou expirée."); setView("error"); return;
      }
      roomRef.current = roomData;
      setRoom(roomData);

      // 2. Ensure I am a participant (join if I'm not)
      const { data: existingP } = await supabase.from("room_participants")
        .select("*").eq("room_id", roomId).eq("user_id", uid).maybeSingle();

      let myP: Participant | null = existingP ?? null;

      if (!myP && roomData.status !== "finished") {
        const { data: newP } = await supabase.from("room_participants")
          .insert({ room_id: roomId, user_id: uid, display_name: displayName, score: 0, answers: {} })
          .select().single();
        myP = newP ?? null;
      }

      myParticipantRef.current = myP;
      setMyParticipant(myP);

      // 3. Fetch all participants
      const parts = await fetchParticipants(roomId);
      setParticipants(parts);

      // 4. Pre-fetch questions regardless of status (avoids blank screen on start)
      const qs = await fetchQuestions(roomData.questions ?? []);
      questionsRef.current = qs;
      setQuestions(qs);

      // 5. Set view based on current room status
      setCurrentQIdx(roomData.current_q_idx ?? 0);
      if (roomData.status === "waiting") setView("waiting");
      else if (roomData.status === "active") { setView("active"); }
      else if (roomData.status === "finished") setView("results");

      // 6. Subscribe to Realtime
      subscribeToRoom(roomId);
    }

    bootstrap();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roomId]);

  // ── Realtime subscription (no stale closures — uses refs) ──────────────────
  function subscribeToRoom(id: string) {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const chan = supabase.channel(`room:${id}`, { config: { broadcast: { self: false } } })
      // Participant row changes (someone joins / answers / scores update)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${id}` },
        async () => {
          const parts = await fetchParticipants(id);
          setParticipants(parts);
          // Refresh my own participant row from the fresh list
          const mine = parts.find((p) => p.user_id === user?.id);
          if (mine) { myParticipantRef.current = mine; setMyParticipant(mine); }
        }
      )
      // Room state changes (status, current_q_idx)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "study_rooms", filter: `id=eq.${id}` },
        async ({ new: updatedRoom }: { new: StudyRoom }) => {
          roomRef.current = updatedRoom;
          setRoom(updatedRoom);

          // If questions not loaded yet, load them now
          if (!questionsRef.current.length && updatedRoom.questions?.length) {
            const qs = await fetchQuestions(updatedRoom.questions);
            questionsRef.current = qs;
            setQuestions(qs);
          }

          if (updatedRoom.status === "waiting") setView("waiting");
          else if (updatedRoom.status === "active") {
            setCurrentQIdx(updatedRoom.current_q_idx ?? 0);
            setTimeLeft(30);
            setView("active");
          }
          else if (updatedRoom.status === "finished") setView("results");
        }
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    channelRef.current = chan;
  }

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (view !== "active") return;
    const answered = myParticipantRef.current?.answers[String(currentQIdx)];
    if (answered) return; // already answered this question

    setTimeLeft(30);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [view, currentQIdx]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleStart() {
    if (!room || !user || room.host_id !== user.id || starting) return;
    setStarting(true);

    // Ensure questions are loaded before starting
    if (!questionsRef.current.length) {
      const qs = await fetchQuestions(room.questions ?? []);
      questionsRef.current = qs;
      setQuestions(qs);
    }

    await supabase.from("study_rooms")
      .update({ status: "active", current_q_idx: 0 })
      .eq("id", room.id);

    setCurrentQIdx(0);
    setTimeLeft(30);
    setView("active");
    setStarting(false);
  }

  async function handleAnswer(choiceId: string) {
    const myP = myParticipantRef.current;
    const qs = questionsRef.current;
    if (!myP || !qs[currentQIdx]) return;

    const isCorrect = qs[currentQIdx].choices.find((c) => c.id === choiceId)?.est_correct ?? false;
    const newAnswers = { ...myP.answers, [String(currentQIdx)]: choiceId };
    const newScore = myP.score + (isCorrect ? 1 : 0);

    const updated = { ...myP, answers: newAnswers, score: newScore };
    myParticipantRef.current = updated;
    setMyParticipant(updated);

    if (timerRef.current) clearInterval(timerRef.current);

    await supabase.from("room_participants")
      .update({ answers: newAnswers, score: newScore })
      .eq("id", myP.id);
  }

  async function handleNext() {
    const qs = questionsRef.current;
    if (!room || !user || room.host_id !== user.id) return;

    const nextIdx = currentQIdx + 1;
    if (nextIdx >= qs.length) {
      await supabase.from("study_rooms").update({ status: "finished" }).eq("id", room.id);
      setView("results");
    } else {
      await supabase.from("study_rooms").update({ current_q_idx: nextIdx }).eq("id", room.id);
      setCurrentQIdx(nextIdx);
      setTimeLeft(30);
    }
  }

  async function handleLeave() {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (user && roomId) {
      await supabase.from("room_participants").delete().eq("room_id", roomId).eq("user_id", user.id);
    }
    router.replace("/study-rooms");
  }

  function handleCopy() {
    if (!room) return;
    navigator.clipboard.writeText(room.code).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  const isHost = !!(user && room && room.host_id === user.id);
  const currentQ = questions[currentQIdx] ?? null;
  const myAnswer = myParticipant?.answers[String(currentQIdx)] ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center pb-24" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-3 px-6">
          <Users size={36} className="mx-auto" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-muted)" }}>Connectez-vous pour accéder aux salles d&apos;étude.</p>
        </div>
      </main>
    );
  }

  if (view === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center pb-24" style={{ background: "var(--bg)" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-muted)" }} />
      </main>
    );
  }

  if (view === "error") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center pb-24 gap-4 px-6 text-center" style={{ background: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{errorMsg}</p>
        <button onClick={() => router.replace("/study-rooms")}
          className="px-5 py-2.5 rounded-2xl text-sm font-semibold"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
          Retour aux salles
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-lg mx-auto px-4 pt-8 lg:pt-10">
        <AnimatePresence mode="wait">
          {view === "waiting" && room && (
            <WaitingRoom key="waiting" room={room} participants={participants} isHost={isHost}
              onStart={starting ? () => {} : handleStart}
              onLeave={handleLeave} copied={copied} onCopy={handleCopy} connected={connected} />
          )}
          {view === "active" && currentQ && (
            <QuestionView key={`q-${currentQIdx}`} question={currentQ} qIdx={currentQIdx}
              total={questions.length} myAnswer={myAnswer} participants={participants}
              isHost={isHost} timeLeft={timeLeft} onAnswer={handleAnswer}
              onNext={handleNext} onLeave={handleLeave} />
          )}
          {view === "active" && !currentQ && (
            <motion.div key="loading-q" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center justify-center py-24">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-muted)" }} />
            </motion.div>
          )}
          {view === "results" && (
            <ResultsView key="results" participants={participants}
              total={questions.length} onLeave={handleLeave} />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
