"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, LogIn, LogOut, Edit2, Target, BookOpen, Brain, Settings } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Maps faculty → default semestre_id (S1 for every faculty — only S1 data exists currently)
const FACULTY_DEFAULT_SEM: Record<string, string> = {
  FMPC:  "s1",
  FMPDF: "s1_FMPDF",
  FMPM:  "S1_FMPM",
  FMPR:  "S1_FMPR",
  UM6SS: "S1_UM6",
};

const FACULTIES = Object.keys(FACULTY_DEFAULT_SEM);

// Real semesters available per faculty in DB. Expand this when S2 data is seeded.
const FACULTY_SEMESTERS: Record<string, { id: string; label: string }[]> = {
  FMPC:  [
    { id: "s1",       label: "S1 FMPC"  },
    { id: "s3",       label: "S3 FMPC"  },
    { id: "s5",       label: "S5 FMPC"  },
    { id: "s7",       label: "S7 FMPC"  },
    { id: "s9",       label: "S9 FMPC"  },
  ],
  FMPDF: [
    { id: "s1_FMPDF", label: "S1 FMPDF" },
    // S3+ not yet available for FMPDF
  ],
  FMPM:  [
    { id: "S1_FMPM",  label: "S1 FMPM"  },
    { id: "S3_FMPM",  label: "S3 FMPM"  },
    { id: "S5_FMPM",  label: "S5 FMPM"  },
    { id: "S7_FMPM",  label: "S7 FMPM"  },
    { id: "S9_FMPM",  label: "S9 FMPM"  },
  ],
  FMPR:  [
    { id: "S1_FMPR",  label: "S1 FMPR"  },
    { id: "S3_FMPR",  label: "S3 FMPR"  },
    { id: "S5_FMPR",  label: "S5 FMPR"  },
    { id: "S7_FMPR",  label: "S7 FMPR"  },
    { id: "S9_FMPR",  label: "S9 FMPR"  },
  ],
  UM6SS: [
    { id: "S1_UM6",   label: "S1 UM6SS" },
    { id: "S3_UM6",   label: "S3 UM6SS" },
    { id: "S5_UM6",   label: "S5 UM6SS" },
    { id: "S7_UM6",   label: "S7 UM6SS" },
    { id: "S9_UM6",   label: "S9 UM6SS" },
  ],
};

function getSemLabel(fac: string, semId: string): string {
  return FACULTY_SEMESTERS[fac]?.find(s => s.id === semId)?.label ?? `S1 ${fac}`;
}

function getActiveSemId(fac: string, savedSemId?: string): string {
  const sems = FACULTY_SEMESTERS[fac] ?? [];
  const match = sems.find(s => s.id === savedSemId);
  return match ? savedSemId! : (sems[0]?.id ?? FACULTY_DEFAULT_SEM[fac] ?? "s1");
}

export default function ProfilPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState("");
  const [faculty, setFaculty] = useState("FMPC");
  const [semId,   setSemId]   = useState("s1");
  const [saving,  setSaving]  = useState(false);
  const [stats, setStats] = useState({ total: 0, correct: 0, rate: 0, streak: 0 });

  useEffect(() => {
    if (!profile) return;
    const fac = profile.faculty ?? "FMPC";
    const saved = (profile as Record<string, unknown>).semestre_id as string | undefined;
    setName(profile.full_name ?? "");
    setFaculty(fac);
    setSemId(getActiveSemId(fac, saved));
  }, [profile]);

  function handleFacultyChange(newFac: string) {
    setFaculty(newFac);
    setSemId(FACULTY_SEMESTERS[newFac]?.[0]?.id ?? FACULTY_DEFAULT_SEM[newFac] ?? "s1");
  }

  useEffect(() => {
    if (!user) return;
    supabase.from("user_answers").select("is_correct, answered_at").eq("user_id", user.id)
      .then(({ data }) => {
        if (!data?.length) return;
        const total   = data.length;
        const correct = data.filter(a => a.is_correct).length;
        const rate    = Math.round((correct / total) * 100);
        const dates   = [...new Set(data.map(a => a.answered_at.split("T")[0]))].sort().reverse();
        let streak = 0;
        for (let i = 0; i < dates.length; i++) {
          if (dates[i] === new Date(Date.now() - i * 86400000).toISOString().split("T")[0]) streak++;
          else break;
        }
        setStats({ total, correct, rate, streak });
      });
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").upsert(
      { id: user.id, full_name: name, faculty, semestre_id: semId },
      { onConflict: "id" }
    );
    await refreshProfile();
    setSaving(false);
    setEditing(false);
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  if (!user) return (
    <main className="min-h-screen flex items-center justify-center pb-28" style={{ background: "var(--bg)" }}>
      <div className="text-center space-y-4 px-4">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-white/[0.08] flex items-center justify-center mx-auto">
          <User className="w-7 h-7 text-zinc-500" />
        </div>
        <p className="text-base font-bold" style={{ color: "var(--text)" }}>Connectez-vous</p>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Pour suivre votre progression</p>
        <Link href="/auth"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black text-sm font-semibold hover:bg-zinc-100 transition-all">
          <LogIn className="w-4 h-4" /> Se connecter
        </Link>
      </div>
    </main>
  );

  const initials   = (profile?.full_name ?? user.email ?? "?")[0].toUpperCase();
  const savedSemId = (profile as Record<string, unknown>)?.semestre_id as string | undefined;
  const curFac     = profile?.faculty ?? "FMPC";
  const activeSemId    = getActiveSemId(curFac, savedSemId);
  const activeSemLabel = getSemLabel(curFac, activeSemId);

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">

        {/* Avatar card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-6 text-center space-y-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
            <span className="text-2xl font-bold text-blue-400">{initials}</span>
          </div>

          {editing ? (
            <div className="space-y-3 text-left">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Prénom</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Faculté</label>
                <select value={faculty} onChange={e => handleFacultyChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}>
                  {FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                  Semestre
                  {faculty === "FMPDF" && (FACULTY_SEMESTERS[faculty]?.length ?? 0) <= 1 && (
                    <span className="ml-2 text-[10px] text-amber-400/70">(S3+ bientôt disponible)</span>
                  )}
                </label>
                <select value={semId} onChange={e => setSemId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}>
                  {(FACULTY_SEMESTERS[faculty] ?? []).map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditing(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm border transition-all hover:bg-white/[0.04]"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Annuler</button>
                <button onClick={save} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-zinc-100 disabled:opacity-50 transition-all">
                  {saving ? "..." : "Enregistrer"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-base font-bold" style={{ color: "var(--text)" }}>
                {profile?.full_name ?? "Etudiant"}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email}</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
                  {curFac}
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                  {activeSemLabel}
                </span>
              </div>
              <button onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:bg-white/[0.06]"
                style={{ color: "var(--text-muted)" }}>
                <Edit2 className="w-3 h-3" /> Modifier
              </button>
            </div>
          )}
        </motion.div>

        {/* Stats mini */}
        {stats.total > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-3">
            {[
              { label: "Repondues", value: stats.total,      icon: BookOpen, color: "text-blue-400"    },
              { label: "Reussite",  value: `${stats.rate}%`, icon: Target,   color: "text-emerald-400" },
              { label: "Serie",     value: `${stats.streak}j`, icon: Brain,  color: "text-orange-400"  },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border px-3 py-3 text-center"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <p className={"text-lg font-bold " + s.color}>{s.value.toLocaleString()}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Quick links */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="space-y-2">
          <Link href={"/semestres/" + activeSemId}
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl border transition-all hover:bg-white/[0.04]"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <div>
                <span className="text-sm font-medium block" style={{ color: "var(--text)" }}>Mes QCM</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{activeSemLabel}</span>
              </div>
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>&#8594;</span>
          </Link>
          <Link href="/stats"
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl border transition-all hover:bg-white/[0.04]"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Statistiques</span>
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>&#8594;</span>
          </Link>
          <Link href="/settings"
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl border transition-all hover:bg-white/[0.04]"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <Settings className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Parametres & IA</span>
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>&#8594;</span>
          </Link>
        </motion.div>

        {/* Sign out */}
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          onClick={handleSignOut}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> Se deconnecter
        </motion.button>

      </div>
    </main>
  );
}
