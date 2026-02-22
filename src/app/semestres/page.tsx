"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { BookOpen, ChevronRight, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

// S-number from semestre_id (e.g. "s3", "S3_FMPM" → 3)
function parseSNum(id: string): number {
  const m = id.match(/[sS](\d)/);
  return m ? parseInt(m[1]) : 0;
}

const FACULTY_COLORS: Record<string, string> = {
  FMPC:  "blue",
  FMPR:  "violet",
  FMPM:  "emerald",
  UM6SS: "amber",
  FMPDF: "rose",
};

const COLOR: Record<string, { pill: string; icon: string }> = {
  blue:    { pill: "bg-blue-500/10 border-blue-500/20 text-blue-400",    icon: "text-blue-400"    },
  violet:  { pill: "bg-violet-500/10 border-violet-500/20 text-violet-400", icon: "text-violet-400" },
  emerald: { pill: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", icon: "text-emerald-400" },
  amber:   { pill: "bg-amber-500/10 border-amber-500/20 text-amber-400",  icon: "text-amber-400"  },
  rose:    { pill: "bg-rose-500/10 border-rose-500/20 text-rose-400",     icon: "text-rose-400"   },
};

const SEMESTER_LABELS: Record<number, string> = {
  1: "S1", 3: "S3", 5: "S5", 7: "S7", 9: "S9",
};

type SemRow = {
  semestre_id: string;
  nom: string;
  faculty: string;
  total_questions: number;
};

export default function SemestresPage() {
  const { user } = useAuth();
  const [semesters, setSemesters] = useState<SemRow[]>([]);
  const [userSNum, setUserSNum] = useState<number | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user profile to get their semester
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("semestre").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.semestre) {
        const n = parseSNum(data.semestre);
        setUserSNum(n);
        // Don't auto-select filter — default shows all semesters (better for iPad/new users)
      }
    });
  }, [user]);

  // Load all semesters from DB
  useEffect(() => {
    supabase.from("semesters").select("semestre_id,nom,faculty,total_questions").order("semestre_id").then(({ data }) => {
      setSemesters(data ?? []);
      setLoading(false);
    });
  }, []);

  // Available S-numbers in DB
  const availableSNums = [...new Set(semesters.map((s) => parseSNum(s.semestre_id)))].sort((a, b) => a - b);

  // Filter semesters
  const filtered = selectedFilter
    ? semesters.filter((s) => parseSNum(s.semestre_id) === selectedFilter)
    : semesters;

  const total = filtered.reduce((sum, s) => sum + (s.total_questions || 0), 0);

  return (
    <main className="min-h-screen pb-28" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-5 md:max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold">Semestres</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {loading ? "Chargement..." : `${total.toLocaleString()} questions · ${filtered.length} sections`}
          </p>
        </motion.div>

        {/* ── S-filter tabs ── */}
        {!loading && availableSNums.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedFilter(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              style={{
                background: !selectedFilter ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                borderColor: !selectedFilter ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)",
                color: !selectedFilter ? "var(--text)" : "var(--text-muted)",
              }}>
              Tous
            </button>
            {availableSNums.map((n) => {
              const isActive = selectedFilter === n;
              const isUser = userSNum === n;
              return (
                <button
                  key={n}
                  onClick={() => setSelectedFilter(n)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{
                    background: isActive ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)",
                    borderColor: isActive ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)",
                    color: isActive ? "#60a5fa" : "var(--text-muted)",
                  }}>
                  {SEMESTER_LABELS[n] ?? `S${n}`}
                  {isUser && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Change semester hint */}
        {userSNum && selectedFilter && selectedFilter !== userSNum && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl border px-4 py-3 text-xs flex items-center gap-2"
            style={{ background: "rgba(251,191,36,0.06)", borderColor: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>
            <Lock className="w-3.5 h-3.5 flex-shrink-0" />
            Pour changer votre semestre principal, allez dans{" "}
            <Link href="/profil" className="underline">Profil</Link>.
          </motion.div>
        )}

        {/* Semester list */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border h-[72px] animate-pulse"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "var(--border)" }} />
            ))}
          </div>
        ) : (
          <motion.div initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            className="space-y-2">
            {filtered.map((s) => {
              const color = FACULTY_COLORS[s.faculty] ?? "blue";
              const { pill, icon } = COLOR[color] ?? COLOR.blue;
              return (
                <motion.div key={s.semestre_id}
                  variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
                  <Link href={`/semestres/${s.semestre_id}`}>
                    <div className="rounded-2xl border px-5 py-4 flex items-center gap-4 transition-all hover:bg-white/[0.06] cursor-pointer"
                      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${pill}`}>
                        <BookOpen className={`w-4 h-4 ${icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{s.nom}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {(s.total_questions || 0).toLocaleString()} questions
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </main>
  );
}
