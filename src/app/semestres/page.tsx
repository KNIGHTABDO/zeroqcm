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

// Faculty icon uses CSS vars — no hardcoded colors, works in dark+light mode

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
    supabase.from("profiles").select("annee_etude").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.annee_etude) {
        const YEAR_TO_SNUM: Record<number, number> = {1:1, 2:3, 3:5, 4:7, 5:9};
        const n = YEAR_TO_SNUM[data.annee_etude as number] ?? 0;
        setUserSNum(n);
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
                background: !selectedFilter ? "var(--surface-active)" : "var(--surface)",
                borderColor: !selectedFilter ? "var(--border-strong)" : "var(--border)",
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
                    background: isActive ? "var(--accent-subtle)" : "var(--surface)",
                    borderColor: isActive ? "var(--accent-border)" : "var(--border)",
                    color: isActive ? "var(--accent)" : "var(--text-muted)",
                  }}>
                  {SEMESTER_LABELS[n] ?? `S${n}`}
                  {isUser && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />}
                </button>
              );
            })}
          </div>
        )}

        {/* Change semester hint */}
        {userSNum && selectedFilter && selectedFilter !== userSNum && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl border px-4 py-3 text-xs flex items-center gap-2"
            style={{ background: "var(--warning-subtle)", borderColor: "var(--warning-border)", color: "var(--warning)" }}>
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
              return (
                <motion.div key={s.semestre_id}
                  variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
                  <Link href={`/semestres/${s.semestre_id}`}>
                    <div className="rounded-2xl border px-5 py-4 flex items-center gap-4 transition-all cursor-pointer"
                      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--surface-hover)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--surface)"; }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                        <BookOpen className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
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
