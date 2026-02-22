"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, LogIn, LogOut, Edit2, CheckCircle, Settings, Brain, Target, BookOpen } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const FACULTIES = ["FMPC","FMPR","FMPM","UM6SS","FMPDF"];
const FACULTY_SEM: Record<string, string> = {
  FMPC:"s1",FMPR:"S1_FMPR",FMPM:"S1_FMPM",UM6SS:"S1_UM6",FMPDF:"s1_FMPDF"
};

export default function ProfilPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [faculty, setFaculty] = useState("FMPC");
  const [annee, setAnnee] = useState(1);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, correct: 0, rate: 0, streak: 0 });

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? "");
      setFaculty(profile.faculty ?? "FMPC");
      setAnnee(profile.annee_etude ?? 1);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_answers").select("is_correct, answered_at").eq("user_id", user.id)
      .then(({ data }) => {
        if (!data?.length) return;
        const total = data.length;
        const correct = data.filter(a => a.is_correct).length;
        const rate = Math.round((correct / total) * 100);
        const dates = [...new Set(data.map(a => a.answered_at.split("T")[0]))].sort().reverse();
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
    await supabase.from("profiles").upsert({
      id: user.id, full_name: name, faculty, annee_etude: annee,
    }, { onConflict: "id" });
    await refreshProfile();
    setSaving(false);
    setEditing(false);
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  if (!user) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="text-center space-y-4 px-4">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-white/[0.08] flex items-center justify-center mx-auto">
          <User className="w-7 h-7 text-zinc-500" />
        </div>
        <div>
          <p className="text-base font-bold" style={{ color: "var(--text)" }}>Connectez-vous</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Pour suivre votre progression</p>
        </div>
        <Link href="/auth"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black text-sm font-semibold hover:bg-zinc-100 transition-all">
          <LogIn className="w-4 h-4" /> Se connecter
        </Link>
      </div>
    </main>
  );

  const initials = (profile?.full_name ?? user.email ?? "?")[0].toUpperCase();

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
                <select value={faculty} onChange={e => setFaculty(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}>
                  {FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Année</label>
                <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}>
                  {[1,2,3,4,5,6,7].map(y => <option key={y} value={y}>S{y}</option>)}
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
                {profile?.full_name ?? "Étudiant"}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email}</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
                  {profile?.faculty ?? "FMPC"}
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                  S{profile?.annee_etude ?? 1}
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
              { label: "Répondues", value: stats.total, icon: BookOpen, color: "text-blue-400" },
              { label: "Réussite", value: `${stats.rate}%`, icon: Target, color: "text-emerald-400" },
              { label: "Série", value: `${stats.streak}j`, icon: Brain, color: "text-orange-400" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border px-3 py-3 text-center"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <p className={`text-lg font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Quick links */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="space-y-2">
          <Link href={`/semestres/${FACULTY_SEM[profile?.faculty ?? "FMPC"] ?? "s1"}`}
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl border transition-all hover:bg-white/[0.04]"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Mes QCM</span>
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>→</span>
          </Link>

          <Link href="/stats"
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl border transition-all hover:bg-white/[0.04]"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Statistiques</span>
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>→</span>
          </Link>

          <Link href="/settings"
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl border transition-all hover:bg-white/[0.04]"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <Settings className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Paramètres & IA</span>
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>→</span>
          </Link>
        </motion.div>

        {/* Sign out */}
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          onClick={handleSignOut}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> Se déconnecter
        </motion.button>
      </div>
    </main>
  );
}
