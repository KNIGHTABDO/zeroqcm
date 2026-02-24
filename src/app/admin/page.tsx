"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Clock, CheckCircle, XCircle, BookOpen, Activity, ChevronRight, Brain, RefreshCw, Zap, Database } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Stats {
  users:    { total: number; pending: number; approved: number; denied: number };
  platform: { questions: number; answers: number };
  recent:   Array<{
    user_id: string; status: string; requested_at: string;
    profile: { full_name: string | null; username: string | null; faculty: string; annee_etude: number } | null;
  }>;
}

interface RegenStats { total_questions: number; total_explained: number; missing: number; coverage_pct: number }
type RegenPhase = "idle" | "checking" | "running" | "done" | "error";

const REGEN_BATCH = 20;
const SEMESTER_MAP: Record<number, string> = { 1:"S1", 2:"S3", 3:"S5", 4:"S7", 5:"S9" };

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}` };
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(value / 30);
    const t = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplayed(start);
      if (start >= value) clearInterval(t);
    }, 20);
    return () => clearInterval(t);
  }, [value]);
  return <>{displayed.toLocaleString()}</>;
}

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 border relative overflow-hidden"
      style={{ background: "#111", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ background: `radial-gradient(circle at 80% 20%, ${color}, transparent 60%)` }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
            {label}
          </p>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `${color}14`, border: `1px solid ${color}22` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </div>
        <p className="text-3xl font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.95)" }}>
          <AnimatedNumber value={value} />
        </p>
        {sub && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

// ── Regen All Section ────────────────────────────────────────────────────────
function RegenSection() {
  const [phase, setPhase]           = useState<RegenPhase>("idle");
  const [regenStats, setRegenStats] = useState<RegenStats | null>(null);
  const [progress, setProgress]     = useState({ done: 0, total: 0, errors: 0 });
  const [model, setModel]           = useState("gpt-4o-mini");

  const abortRef                    = useRef(false);

  const VALID_MODELS = ["gpt-4o-mini", "gpt-4o", "Meta-Llama-3.3-70B-Instruct", "DeepSeek-R1", "DeepSeek-V3", "Mistral-Large-2"];

  async function fetchStats() {
    setPhase("checking");
    const headers = await authHeader();
    const res = await fetch("/api/admin/regen-explanations", { headers });
    if (res.ok) { setRegenStats(await res.json()); }
    setPhase("idle");
  }

  useEffect(() => { fetchStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startRegen(forceParam: boolean) {
    if (!regenStats) return;
    abortRef.current = false;
    const target = forceParam ? regenStats.total_explained : regenStats.missing;
    setProgress({ done: 0, total: target, errors: 0 });
    setPhase("running");

    const headers = { ...(await authHeader()), "Content-Type": "application/json" };
    let offset    = 0;
    let totalDone = 0;
    let totalErr  = 0;

    while (!abortRef.current) {
      const res = await fetch("/api/admin/regen-explanations", {
        method: "POST",
        headers,
        body: JSON.stringify({ batch: REGEN_BATCH, offset, force: forceParam, model }),
      });
      if (!res.ok) { setPhase("error"); break; }
      const data = await res.json() as {
        regenerated: number; errors: number; next_offset: number;
        total_in_batch: number; done: boolean;
      };
      totalDone += data.regenerated;
      totalErr  += data.errors;
      offset     = data.next_offset;
      setProgress({ done: totalDone, total: target, errors: totalErr });
      if (data.done || data.total_in_batch < REGEN_BATCH) {
        setPhase("done");
        await fetchStats();
        break;
      }
      // Small pause between batches to avoid rate-limiting
      await new Promise(r => setTimeout(r, 800));
    }
    if (abortRef.current) setPhase("idle");
  }

  function stopRegen() { abortRef.current = true; }

  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="rounded-2xl border overflow-hidden mb-8"
      style={{ background: "#111", borderColor: "rgba(255,255,255,0.08)" }}>

      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}>
            <Brain className="w-4 h-4" style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
              Régénération des explications IA
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              ZeroQCM Tutor v2 — profondeur pédagogique maximale
            </p>
          </div>
        </div>
        {phase === "idle" && regenStats && (
          <button onClick={fetchStats} className="p-2 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: "rgba(255,255,255,0.3)" }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-5">

        {/* Coverage stats */}
        {regenStats && (
          <div className="grid grid-cols-3 gap-3">
            {/* Total questions — no action */}
            <div className="rounded-xl p-3 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-lg font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.5)" }}>{regenStats.total_questions.toLocaleString()}</p>
              <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>Total questions</p>
            </div>

            {/* Expliquées — Régénérer button */}
            <div className="rounded-xl p-3 text-center relative group"
              style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <p className="text-lg font-bold tabular-nums" style={{ color: "#22c55e" }}>{regenStats.total_explained.toLocaleString()}</p>
              <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>Expliquées</p>
              {phase === "idle" && regenStats.total_explained > 0 && (
                <button
                  onClick={() => startRegen(true)}
                  title="Régénérer toutes les explications existantes"
                  className="mt-2 flex items-center gap-1 mx-auto px-2 py-0.5 rounded-md text-[9px] font-semibold transition-all"
                  style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <RefreshCw size={8} /> Régénérer
                </button>
              )}
              {phase === "running" && (
                <div className="mt-2 flex items-center gap-1 mx-auto justify-center">
                  <div className="w-2 h-2 rounded-full border border-green-400 border-t-transparent animate-spin" />
                  <span className="text-[9px]" style={{ color: "#22c55e" }}>{pct}%</span>
                </div>
              )}
            </div>

            {/* Manquantes — Compléter button */}
            <div className="rounded-xl p-3 text-center"
              style={{
                background: regenStats.missing > 0 ? "rgba(251,191,36,0.04)" : "rgba(255,255,255,0.03)",
                border: regenStats.missing > 0 ? "1px solid rgba(251,191,36,0.15)" : "1px solid rgba(255,255,255,0.06)"
              }}>
              <p className="text-lg font-bold tabular-nums" style={{ color: regenStats.missing > 0 ? "#fbbf24" : "#22c55e" }}>{regenStats.missing.toLocaleString()}</p>
              <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>Manquantes</p>
              {phase === "idle" && regenStats.missing > 0 && (
                <button
                  onClick={() => startRegen(false)}
                  title="Générer les explications manquantes"
                  className="mt-2 flex items-center gap-1 mx-auto px-2 py-0.5 rounded-md text-[9px] font-semibold transition-all"
                  style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
                  <Zap size={8} /> Compléter
                </button>
              )}
              {phase === "idle" && regenStats.missing === 0 && (
                <p className="text-[9px] mt-1.5" style={{ color: "rgba(34,197,94,0.5)" }}>✓ Complet</p>
              )}
            </div>
          </div>
        )}

        {/* Coverage bar */}
        {regenStats && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Couverture</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.6)" }}>
                {regenStats.coverage_pct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${regenStats.coverage_pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ background: regenStats.coverage_pct === 100 ? "#22c55e" : "linear-gradient(90deg,#a78bfa,#60a5fa)" }}
              />
            </div>
          </div>
        )}

        {/* Config row — model picker */}
        {phase === "idle" && (
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              Modèle
            </label>
            <select value={model} onChange={e => setModel(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs font-medium appearance-none outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", minWidth: "220px" }}>
              {VALID_MODELS.map(m => <option key={m} value={m} style={{ background: "#111" }}>{m}</option>)}
            </select>
          </div>
        )}

        {/* Progress bar during run */}
        <AnimatePresence>
          {phase === "running" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Progression — {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
                  {progress.errors > 0 && <span style={{ color: "#f87171" }}> · {progress.errors} erreurs</span>}
                </span>
                <span className="text-xs font-bold tabular-nums" style={{ color: "#a78bfa" }}>{pct}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div className="h-full rounded-full relative overflow-hidden"
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.3 }}
                  style={{ background: "linear-gradient(90deg,#a78bfa,#60a5fa)" }}>
                  <div className="absolute inset-0 opacity-40"
                    style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)", animation: "shimmer 1.5s infinite" }} />
                </motion.div>
              </div>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                ~{Math.round((progress.total - progress.done) / REGEN_BATCH * 0.8)} secondes restantes
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Done state */}
        <AnimatePresence>
          {phase === "done" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#22c55e" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#22c55e" }}>Régénération terminée</p>
                <p className="text-xs" style={{ color: "rgba(34,197,94,0.6)" }}>
                  {progress.done.toLocaleString()} explications générées · {progress.errors} erreurs
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error state */}
        <AnimatePresence>
          {phase === "error" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#ef4444" }} />
              <p className="text-sm" style={{ color: "#ef4444" }}>Erreur pendant la régénération</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stop button — only visible during active run */}
        {phase === "running" && (
          <button
            onClick={stopRegen}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
            <div className="w-3 h-3 rounded-sm" style={{ background: "#f87171" }} />
            Arrêter
          </button>
        )}

        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>
          Traitement par lots de {REGEN_BATCH} questions · GitHub Models · Mise en cache automatique en base
        </p>
      </div>
    </motion.div>
  );
}


// ── Seed Section ─────────────────────────────────────────────────────────────
type SeedPhase = "idle" | "running" | "done" | "error";
interface SeedStats { semesters: number; modules: number; activities: number; questions: number; choices: number; errors: number }

function SeedSection() {
  const [phase, setPhase]       = useState<SeedPhase>("idle");
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [result, setResult]     = useState<SeedStats | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const YEARS = [
    { year: 1, label: "Année 1", sems: "S1 + S2", color: "#60a5fa" },
    { year: 2, label: "Année 2", sems: "S1–S4",   color: "#34d399" },
    { year: 3, label: "Année 3", sems: "S1–S6",   color: "#a78bfa" },
    { year: 4, label: "Année 4", sems: "S1–S8",   color: "#f472b6" },
    { year: 5, label: "Année 5", sems: "S1–S9",   color: "#fbbf24" },
    { year: 6, label: "Année 6", sems: "S1–S10",  color: "#fb923c" },
  ];

  async function seed(year: number) {
    setPhase("running");
    setActiveYear(year);
    setResult(null);
    setErrorMsg("");
    try {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      const res = await fetch("/api/scrape-expand", {
        method: "POST",
        headers,
        body: JSON.stringify({ year }),
      });
      const data = await res.json() as { ok?: boolean; stats?: SeedStats; error?: string; errors?: string[] };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error ?? `HTTP ${res.status}`);
        setPhase("error");
      } else {
        setResult(data.stats ?? null);
        setPhase("done");
      }
    } catch (e) {
      setErrorMsg(String(e));
      setPhase("error");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="rounded-2xl border overflow-hidden mb-8"
      style={{ background: "#111", borderColor: "rgba(255,255,255,0.08)" }}>

      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)" }}>
            <Database className="w-4 h-4" style={{ color: "#60a5fa" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
              Seed DariQCM
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Importer les semestres accessibles par année d&apos;étude
            </p>
          </div>
        </div>
        {(phase === "done" || phase === "error") && (
          <button onClick={() => { setPhase("idle"); setActiveYear(null); }}
            className="p-2 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: "rgba(255,255,255,0.3)" }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">

        {/* Year buttons */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {YEARS.map(({ year, label, sems, color }) => {
            const isActive = activeYear === year && phase === "running";
            return (
              <button
                key={year}
                onClick={() => seed(year)}
                disabled={phase === "running"}
                className="rounded-xl p-3 text-center transition-all disabled:opacity-40 hover:opacity-90"
                style={{
                  background: `${color}0d`,
                  border: `1px solid ${color}${isActive ? "55" : "22"}`,
                  outline: isActive ? `1px solid ${color}44` : "none",
                }}>
                {isActive ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-1"
                    style={{ borderColor: color, borderTopColor: "transparent" }} />
                ) : (
                  <p className="text-base font-bold" style={{ color }}>{year}</p>
                )}
                <p className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color }}>{label}</p>
                <p className="text-[8px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{sems}</p>
              </button>
            );
          })}
        </div>

        {/* Running state */}
        <AnimatePresence>
          {phase === "running" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                style={{ borderColor: "#60a5fa", borderTopColor: "transparent" }} />
              <p className="text-sm" style={{ color: "#60a5fa" }}>
                Scraping Année {activeYear} — ceci peut prendre 2–5 minutes…
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Done state */}
        <AnimatePresence>
          {phase === "done" && result && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="rounded-xl p-4 space-y-3"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#22c55e" }} />
                <p className="text-sm font-semibold" style={{ color: "#22c55e" }}>Import terminé — Année {activeYear}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Semestres", val: result.semesters },
                  { label: "Modules",   val: result.modules },
                  { label: "Activités", val: result.activities },
                  { label: "Questions", val: result.questions },
                  { label: "Choix",     val: result.choices },
                  { label: "Erreurs",   val: result.errors },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-lg p-2 text-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-sm font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.8)" }}>
                      {val.toLocaleString()}
                    </p>
                    <p className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
                  </div>
                ))}
              </div>
              {result.errors > 0 && (
                <p className="text-[10px]" style={{ color: "rgba(251,191,36,0.6)" }}>
                  {result.errors} activité(s) échouées — données partielles possibles
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error state */}
        <AnimatePresence>
          {phase === "error" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#ef4444" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>Erreur de seed</p>
                <p className="text-xs" style={{ color: "rgba(239,68,68,0.6)" }}>{errorMsg}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>
          DariQCM gate les semestres par année d&apos;étude · Correction automatique des réponses manquantes incluse
        </p>
      </div>
    </motion.div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    const headers = await authHeader();
    const res = await fetch("/api/admin/stats", { headers });
    if (res.ok) setStats(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  async function handleAction(userId: string, action: "approve" | "deny") {
    setActionLoading(userId + action);
    const headers = { ...(await authHeader()), "Content-Type": "application/json" };
    await fetch("/api/admin/activate", { method: "POST", headers, body: JSON.stringify({ userId, action }) });
    await fetchStats();
    setActionLoading(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#080808" }}>
        <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
      </div>
    );
  }

  const s = stats;

  return (
    <div className="min-h-screen px-5 py-8 lg:px-8" style={{ background: "#080808" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest mb-1"
          style={{ color: "rgba(255,255,255,0.3)" }}>Vue d&apos;ensemble</p>
        <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>
          Tableau de bord
        </h1>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
        <StatCard label="En attente"    value={s?.users.pending  ?? 0} icon={Clock}         color="#fbbf24" sub="demandes actives" />
        <StatCard label="Approuvés"     value={s?.users.approved ?? 0} icon={CheckCircle}   color="#22c55e" sub="comptes actifs" />
        <StatCard label="Refusés"       value={s?.users.denied   ?? 0} icon={XCircle}       color="#ef4444" sub="demandes" />
        <StatCard label="Utilisateurs"  value={s?.users.total    ?? 0} icon={Users}         color="#60a5fa" sub="inscrits" />
        <StatCard label="Questions"     value={s?.platform.questions ?? 0} icon={BookOpen}  color="#a78bfa" sub="dans la base" />
        <StatCard label="Réponses"      value={s?.platform.answers   ?? 0} icon={Activity}  color="#34d399" sub="soumises" />
      </div>

      {/* AI Regen section */}
      <RegenSection />

      {/* Seed section */}
      <SeedSection />

      {/* Recent pending activations */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
            Demandes en attente
          </h2>
          <Link href="/admin/activations"
            className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.35)" }}>
            Voir tout <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {!s?.recent.length ? (
          <div className="rounded-2xl border py-12 text-center"
            style={{ background: "#111", borderColor: "rgba(255,255,255,0.06)" }}>
            <CheckCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(34,197,94,0.4)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Aucune demande en attente</p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: "#111", borderColor: "rgba(255,255,255,0.08)" }}>
            {s.recent.map((req, i) => {
              const name    = req.profile?.full_name || req.profile?.username || req.user_id.slice(0,8);
              const faculty = req.profile?.faculty ?? "—";
              const sem     = req.profile?.annee_etude ? SEMESTER_MAP[req.profile.annee_etude] : "—";
              const date    = req.requested_at
                ? new Date(req.requested_at).toLocaleDateString("fr-FR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })
                : "—";
              const loadingApprove = actionLoading === req.user_id + "approve";
              const loadingDeny    = actionLoading === req.user_id + "deny";
              return (
                <div key={req.user_id}
                  className={`flex items-center gap-3 px-5 py-4 ${i < s.recent.length - 1 ? "border-b" : ""}`}
                  style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
                    {name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{name}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {faculty} · {sem} · {date}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleAction(req.user_id, "approve")} disabled={!!actionLoading}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                      {loadingApprove ? "…" : "Approuver"}
                    </button>
                    <button onClick={() => handleAction(req.user_id, "deny")} disabled={!!actionLoading}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>
                      {loadingDeny ? "…" : "Refuser"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}