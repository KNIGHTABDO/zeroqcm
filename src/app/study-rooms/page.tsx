"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, LogIn, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";

interface Module { id: number; nom: string; semester_id: string; }

function genCode() {
  return Array.from({ length: 6 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
}

function CreateModal({ onClose, modules, userId, displayName }: {
  onClose: () => void; modules: Module[]; userId: string; displayName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [moduleId, setModuleId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  async function handleCreate() {
    if (!name.trim() || !moduleId) { setErr("Choisissez un nom et un module."); return; }
    setCreating(true); setErr("");

    const { data: qData, error: qErr } = await supabase
      .from("questions").select("id")
      .eq("module_id", moduleId)
      .not("source_type", "in", "(open,no_answer)")
      .limit(60);

    if (qErr || !qData?.length) { setErr("Aucune question disponible pour ce module."); setCreating(false); return; }

    // Fisher-Yates shuffle then pick 20
    const allIds = qData.map((q) => q.id);
    for (let i = allIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
    }
    const questionIds = allIds.slice(0, Math.min(20, allIds.length));
    const code = genCode();

    const { data: room, error: rErr } = await supabase
      .from("study_rooms")
      .insert({ code, name: name.trim(), module_id: moduleId, host_id: userId, questions: questionIds, status: "waiting", current_q_idx: 0 })
      .select().single();

    if (rErr || !room) { setErr("Impossible de créer la salle."); setCreating(false); return; }

    await supabase.from("room_participants")
      .insert({ room_id: room.id, user_id: userId, display_name: displayName, score: 0, answers: {} });

    router.push(`/study-rooms/${room.id}`);
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
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-70"
            style={{ background: "var(--surface)" }}>
            <X size={15} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Nom de la salle
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex: S3 Cardio révision…" maxLength={50}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--input-text)" }} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Module</label>
            <select value={moduleId ?? ""} onChange={(e) => setModuleId(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none appearance-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: moduleId ? "var(--input-text)" : "var(--input-placeholder)" }}>
              <option value="">Choisir un module…</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
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

function JoinModal({ onClose, userId, displayName }: {
  onClose: () => void; userId: string; displayName: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState("");

  async function handleJoin() {
    const c = code.trim().toUpperCase();
    if (c.length !== 6) { setErr("Code à 6 caractères requis."); return; }
    setJoining(true); setErr("");

    const { data: room, error: rErr } = await supabase
      .from("study_rooms").select("id, status").eq("code", c).single();

    if (rErr || !room) { setErr("Salle introuvable."); setJoining(false); return; }
    if (room.status === "finished") { setErr("Cette salle est terminée."); setJoining(false); return; }

    const { error: pErr } = await supabase.from("room_participants")
      .upsert({ room_id: room.id, user_id: userId, display_name: displayName, score: 0, answers: {} },
               { onConflict: "room_id,user_id" });

    if (pErr) { setErr("Impossible de rejoindre."); setJoining(false); return; }
    router.push(`/study-rooms/${room.id}`);
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
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-70"
            style={{ background: "var(--surface)" }}>
            <X size={15} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Code de la salle</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="EX: AB3XY7" maxLength={6}
            className="w-full px-4 py-3.5 rounded-2xl text-xl font-bold text-center tracking-widest outline-none"
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

export default function StudyRoomsPage() {
  const { user, profile } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);

  const displayName = profile?.full_name || profile?.username || user?.email?.split("@")[0] || "Anonyme";

  useEffect(() => {
    if (!profile) return;
    const semNum = 2 * profile.annee_etude - 1;
    supabase.from("modules").select("id, nom, semester_id")
      .ilike("semester_id", `s${semNum}%`).order("nom")
      .then(({ data }) => setModules(data ?? []));
  }, [profile]);

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

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-lg mx-auto px-4 pt-8 lg:pt-10">
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
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}>
              <Plus size={16} /> Créer une salle
            </button>
            <button onClick={() => setShowJoin(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 border"
              style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}>
              <LogIn size={16} /> Rejoindre
            </button>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateModal key="create" onClose={() => setShowCreate(false)}
            modules={modules} userId={user.id} displayName={displayName} />
        )}
        {showJoin && (
          <JoinModal key="join" onClose={() => setShowJoin(false)}
            userId={user.id} displayName={displayName} />
        )}
      </AnimatePresence>
    </main>
  );
}
