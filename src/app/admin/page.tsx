"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Clock, CheckCircle, XCircle, BookOpen, Activity, ChevronRight, Brain, RefreshCw, Zap, Database, Key, Cpu, Plus, Trash2, ToggleLeft, ToggleRight, Shield, Wifi, WifiOff } from "lucide-react";
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

// ── AI Tokens & Models Section ───────────────────────────────────────────────
interface AiToken  { id: string; label: string; status: "alive"|"dead"|"rate_limited"|"unknown"; last_tested_at: string|null; last_used_at: string|null; use_count: number; created_at: string; }
interface AiModel  { id: string; label: string; provider: string; tier: string; is_enabled: boolean; is_default: boolean; sort_order: number; premium_multiplier?: number; supports_vision?: boolean; supports_tools?: boolean; max_context?: number; billing_plan?: string; }

const STATUS_COLOR: Record<string, string> = {
  alive: "#22c55e", dead: "#ef4444", rate_limited: "#f59e0b", unknown: "rgba(255,255,255,0.25)"
};
const STATUS_LABEL: Record<string, string> = {
  alive: "Alive", dead: "Dead", rate_limited: "Rate limited", unknown: "Not tested"
};
const TIER_COLOR: Record<string, string> = { standard: "#60a5fa", premium: "#a78bfa" };
const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "#74aa9c", Anthropic: "#d4a27f", Meta: "#4267B2", Mistral: "#ff7000"
};

function AiSection() {
  const [tokens, setTokens]           = useState<AiToken[]>([]);
  const [models, setModels]           = useState<AiModel[]>([]);
  const [testingId, setTestingId]     = useState<string|null>(null);
  const [testingAll, setTestingAll]   = useState(false);
  const [flowLabel, setFlowLabel]     = useState("");
  const [addOpen, setAddOpen]         = useState(false);
  const [flowState, setFlowState]     = useState<"idle"|"starting"|"code_shown"|"polling"|"success"|"error">("idle");
  const [flowData, setFlowData]       = useState<{device_code:string;user_code:string;verification_uri:string;interval:number;expires_at:number}|null>(null);
  const [flowError, setFlowError]     = useState("");
  const pollRef                       = useRef<ReturnType<typeof setTimeout>|null>(null);
  const [tab, setTab]                 = useState<"tokens"|"models"|"limits">("tokens");
  const [limits, setLimits]           = useState<{multiplier:number;daily_limit:number;label:string}[]>([]);
  const [usageToday, setUsageToday]   = useState<{multiplier:number;count:number}[]>([]);
  const [editLimit, setEditLimit]     = useState<Record<number,string>>({});
  const [savingLimit, setSavingLimit] = useState<number|null>(null);
  const [editMult, setEditMult]       = useState<Record<string,string>>({});
  const [savingMult, setSavingMult]   = useState<string|null>(null);

  async function authHdr() {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" };
  }

  async function loadTokens() {
    const h = await authHdr();
    const r = await fetch("/api/admin/ai-tokens", { headers: h });
    if (r.ok) setTokens(await r.json());
  }
  async function loadModels() {
    const r = await fetch("/api/admin/ai-models");
    if (r.ok) setModels(await r.json());
  }
  async function loadLimits() {
    const h = await authHdr();
    const r = await fetch("/api/admin/ai-limits", { headers: h });
    if (r.ok) {
      const d = await r.json();
      setLimits(d.limits ?? []);
      setUsageToday(d.usage_today ?? []);
    }
  }

  useEffect(() => { loadTokens(); loadModels(); loadLimits(); }, []); // eslint-disable-line

  async function testToken(id?: string) {
    const h = await authHdr();
    if (id) setTestingId(id); else setTestingAll(true);
    await fetch("/api/admin/ai-tokens/test", { method: "POST", headers: h, body: JSON.stringify(id ? { id } : {}) });
    await loadTokens();
    setTestingId(null); setTestingAll(false);
  }

  async function startDeviceFlow() {
    if (!flowLabel.trim()) return;
    setFlowState("starting"); setFlowError("");
    try {
      const h = await authHdr();
      const r = await fetch("/api/admin/ai-tokens/device-flow", { method: "POST", headers: h });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      const expiresAt = Date.now() + d.expires_in * 1000;
      setFlowData({ device_code: d.device_code, user_code: d.user_code, verification_uri: d.verification_uri, interval: d.interval ?? 5, expires_at: expiresAt });
      setFlowState("code_shown");
      schedulePoll(d.device_code, d.interval ?? 5, expiresAt);
    } catch (e: any) { setFlowError(e.message || "Failed to start flow"); setFlowState("error"); }
  }

  function schedulePoll(device_code: string, interval: number, expiresAt: number) {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(() => pollDeviceFlow(device_code, interval, expiresAt), interval * 1000);
  }

  async function pollDeviceFlow(device_code: string, interval: number, expiresAt: number) {
    if (Date.now() >= expiresAt) { setFlowState("error"); setFlowError("Code expired — try again"); return; }
    try {
      const h = await authHdr();
      const r = await fetch(`/api/admin/ai-tokens/device-flow?device_code=${device_code}&label=${encodeURIComponent(flowLabel)}`, { headers: h });
      const d = await r.json();
      if (d.status === "authorized") {
        setFlowState("success");
        pollRef.current = null;
        await loadTokens();
        setTimeout(() => { setAddOpen(false); setFlowState("idle"); setFlowLabel(""); setFlowData(null); }, 2200);
      } else if (d.status === "pending") {
        schedulePoll(device_code, interval, expiresAt);
      } else if (d.status === "slow_down") {
        schedulePoll(device_code, interval + 5, expiresAt);
      } else {
        setFlowState("error"); setFlowError(d.error || "Unknown error");
      }
    } catch (e: any) { schedulePoll(device_code, interval, expiresAt); }
  }

  function cancelFlow() {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
    setFlowState("idle"); setFlowData(null); setFlowLabel(""); setFlowError(""); setAddOpen(false);
  }

  async function deleteToken(id: string) {
    const h = await authHdr();
    await fetch(`/api/admin/ai-tokens?id=${id}`, { method: "DELETE", headers: h });
    await loadTokens();
  }

  async function saveCategoryLimit(multiplier: number) {
    const val = parseInt(editLimit[multiplier] ?? "");
    if (isNaN(val) || val < 0) return;
    setSavingLimit(multiplier);
    const h = await authHdr();
    await fetch("/api/admin/ai-limits", { method: "PATCH", headers: h, body: JSON.stringify({ multiplier, daily_limit: val }) });
    await loadLimits();
    setSavingLimit(null);
    setEditLimit(prev => { const n = {...prev}; delete n[multiplier]; return n; });
  }

  async function saveModelMult(modelId: string) {
    const rawVal = editMult[modelId];
    if (rawVal === undefined) return;
    const val = parseInt(rawVal, 10);
    if (isNaN(val) || ![0,1,3].includes(val)) return;
    setSavingMult(modelId);
    const h = await authHdr();
    const res = await fetch("/api/admin/ai-models", { method: "PATCH", headers: h, body: JSON.stringify({ id: modelId, premium_multiplier: val, tier: val === 0 ? "standard" : "premium" }) });
    if (res.ok) {
      await loadModels();
      await loadLimits();
    }
    setSavingMult(null);
    setEditMult(prev => { const n = {...prev}; delete n[modelId]; return n; });
  }

  async function toggleModel(m: AiModel) {
    const h = await authHdr();
    await fetch("/api/admin/ai-models", { method: "PATCH", headers: h, body: JSON.stringify({ id: m.id, is_enabled: !m.is_enabled }) });
    await loadModels();
  }

  async function setDefault(m: AiModel) {
    const h = await authHdr();
    await fetch("/api/admin/ai-models", { method: "PATCH", headers: h, body: JSON.stringify({ id: m.id, is_default: true }) });
    await loadModels();
  }

  const aliveCount = tokens.filter(t => t.status === "alive").length;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: "#111", borderColor: "rgba(255,255,255,0.08)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <Brain className="w-4 h-4" style={{ color: "#818cf8" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>AI Models & Tokens</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              {aliveCount}/{tokens.length} tokens alive · {models.filter(m=>m.is_enabled).length}/{models.length} models active · live
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => testToken()} disabled={testingAll || tokens.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
            <RefreshCw className={"w-3 h-3 " + (testingAll ? "animate-spin" : "")} />
            {testingAll ? "Testing…" : "Test all"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {(["tokens", "models", "limits"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-3 text-xs font-semibold uppercase tracking-widest transition-all"
            style={{ color: tab === t ? "#818cf8" : "rgba(255,255,255,0.3)", borderBottom: tab === t ? "2px solid #818cf8" : "2px solid transparent" }}>
            {t === "tokens" ? `🔑 Tokens (${tokens.length})` : t === "models" ? `🤖 Models (${models.length})` : `⚡ Limits`}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">

        {/* ── TOKENS TAB ── */}
        {tab === "tokens" && (
          <>
            {tokens.length === 0 && !addOpen && (
              <div className="rounded-xl border py-8 text-center" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}>
                <Key className="w-6 h-6 mx-auto mb-2" style={{ color: "rgba(255,255,255,0.2)" }} />
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>No tokens yet. Add your GitHub OAuth token below.</p>
              </div>
            )}

            {tokens.map((tok) => (
              <div key={tok.id} className="rounded-xl border px-4 py-3 flex items-center gap-3"
                style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}>
                {/* Status dot */}
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLOR[tok.status], boxShadow: tok.status === "alive" ? `0 0 6px ${STATUS_COLOR.alive}` : "none" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>{tok.label}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {STATUS_LABEL[tok.status]} · Used {tok.use_count}x
                    {tok.last_tested_at ? ` · Tested ${new Date(tok.last_tested_at).toLocaleString("fr-FR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => testToken(tok.id)} disabled={testingId === tok.id}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40"
                    style={{ background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)", color: "#818cf8" }}>
                    {testingId === tok.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Test"}
                  </button>
                  <button onClick={() => deleteToken(tok.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                    style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add token form */}
            <AnimatePresence>
              {addOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border p-4 space-y-4"
                  style={{ background: "rgba(34,197,94,0.03)", borderColor: "rgba(34,197,94,0.15)" }}>

                  {/* Idle / start state */}
                  {(flowState === "idle" || flowState === "starting") && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold flex items-center gap-2" style={{ color: "#4ade80" }}>
                        <span>🔗</span> Connect GitHub Account
                      </p>
                      <input value={flowLabel} onChange={e => setFlowLabel(e.target.value)}
                        placeholder="Nickname (e.g. KNIGHTABDO)"
                        className="w-full px-3 py-2 rounded-lg text-xs border outline-none"
                        style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)" }} />
                      <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        GitHub will show you a one-time code to enter at github.com/activate
                      </p>
                      <div className="flex gap-2">
                        <button onClick={startDeviceFlow} disabled={!flowLabel.trim() || flowState === "starting"}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2"
                          style={{ background: flowLabel.trim() && flowState !== "starting" ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.04)", color: flowLabel.trim() && flowState !== "starting" ? "#4ade80" : "rgba(255,255,255,0.3)", border: "1px solid rgba(34,197,94,0.2)" }}>
                          {flowState === "starting" ? <><span className="animate-spin">⟳</span> Starting…</> : <>🐙 Authorize with GitHub</>}
                        </button>
                        <button onClick={cancelFlow} className="px-3 py-2 rounded-lg text-xs"
                          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Code shown + polling */}
                  {(flowState === "code_shown" || flowState === "polling") && flowData && (
                    <div className="space-y-4">
                      <p className="text-xs font-semibold flex items-center gap-2" style={{ color: "#4ade80" }}>
                        <span>📋</span> Enter this code at GitHub
                      </p>

                      {/* Big code display */}
                      <div className="rounded-2xl p-5 text-center space-y-2" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(34,197,94,0.2)" }}>
                        <div className="text-3xl font-mono font-bold tracking-[0.25em] select-all" style={{ color: "#4ade80", letterSpacing: "0.3em" }}>
                          {flowData.user_code}
                        </div>
                        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                          Copy this code, then click the link below
                        </p>
                      </div>

                      <a href={flowData.verification_uri} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", textDecoration: "none" }}>
                        🌐 Open {flowData.verification_uri}
                      </a>

                      <div className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        <span className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                          style={{ borderColor: "rgba(34,197,94,0.4)", borderTopColor: "transparent" }} />
                        Waiting for you to authorize… auto-detecting
                      </div>

                      <button onClick={cancelFlow} className="w-full py-1.5 rounded-lg text-xs"
                        style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.3)" }}>Cancel</button>
                    </div>
                  )}

                  {/* Success */}
                  {flowState === "success" && (
                    <div className="text-center py-4 space-y-2">
                      <div className="text-4xl">✅</div>
                      <p className="text-sm font-semibold" style={{ color: "#4ade80" }}>GitHub account connected!</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Token saved — closing in a moment</p>
                    </div>
                  )}

                  {/* Error */}
                  {flowState === "error" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171" }}>
                        ⚠️ {flowError}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setFlowState("idle"); setFlowError(""); }} className="flex-1 py-2 rounded-lg text-xs font-semibold"
                          style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.15)" }}>Try again</button>
                        <button onClick={cancelFlow} className="px-3 py-2 rounded-lg text-xs"
                          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {!addOpen && (
              <button onClick={() => { setAddOpen(true); setFlowState("idle"); setFlowLabel(""); setFlowError(""); setFlowData(null); }}
                className="w-full py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-80"
                style={{ background: "rgba(99,102,241,0.06)", borderColor: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
                <Plus className="w-3.5 h-3.5" />
                Add Token
              </button>
            )}
          </>
        )}

        {/* ── MODELS TAB ── */}
        {tab === "models" && (
          <>
            {models.map((m) => (
              <div key={m.id} className="rounded-xl border px-4 py-3 flex items-center gap-3"
                style={{ background: "rgba(255,255,255,0.02)", borderColor: m.is_default ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)", opacity: m.is_enabled ? 1 : 0.45 }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>{m.label}</p>
                    {m.is_default && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>DEFAULT</span>
                    )}
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: `${TIER_COLOR[m.tier]}14`, color: TIER_COLOR[m.tier] }}>
                      {m.tier.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: PROVIDER_COLORS[m.provider] ?? "rgba(255,255,255,0.35)" }}>{m.provider}</span>
                    {(m as any).supports_vision && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(168,85,247,0.1)", color: "#c084fc" }}>👁 vision</span>}
                    {(m as any).supports_tools && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(99,179,237,0.1)", color: "#93c5fd" }}>🔧 tools</span>}
                    {(m as any).max_context && <span className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{Math.round((m as any).max_context / 1000)}k ctx</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!m.is_default && m.is_enabled && (
                    <button onClick={() => setDefault(m)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all"
                      style={{ background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)", color: "#818cf8" }}>
                      Set default
                    </button>
                  )}
                  <button onClick={() => toggleModel(m)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all border"
                    style={{ background: m.is_enabled ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)", borderColor: m.is_enabled ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)" }}>
                    {m.is_enabled
                      ? <ToggleRight className="w-4 h-4" style={{ color: "#22c55e" }} />
                      : <ToggleLeft  className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── LIMITS TAB ── */}
        {tab === "limits" && (
          <div className="space-y-5">

            {/* ─ Category Quotas ─ */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                Category daily limits (shared across all models in tier)
              </p>
              <div className="space-y-2">
                {[
                  { mult: 0, label: "🟢 Free / Standard", color: "#22c55e", desc: "0 = unlimited" },
                  { mult: 1, label: "🟡 1× Premium",       color: "#fbbf24", desc: "shared across all 1× models" },
                  { mult: 3, label: "🔴 3× Heavy",          color: "#f87171", desc: "shared across all 3× models" },
                ].map(({ mult, label, color, desc }) => {
                  const row = limits.find(l => l.multiplier === mult);
                  const usage = usageToday.find(u => u.multiplier === mult);
                  const currentLimit = row?.daily_limit ?? (mult === 0 ? 0 : mult === 1 ? 10 : 5);
                  const used = usage?.count ?? 0;
                  const pct  = currentLimit > 0 ? Math.min(100, Math.round(used / currentLimit * 100)) : 0;
                  const isEditing = mult in editLimit;
                  return (
                    <div key={mult} className="rounded-xl border px-4 py-3 space-y-2"
                      style={{ background: "rgba(255,255,255,0.02)", borderColor: `${color}20` }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>{label}</p>
                          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{desc}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isEditing ? (
                            <>
                              <input
                                type="number" min="0"
                                value={editLimit[mult]}
                                onChange={e => setEditLimit(prev => ({ ...prev, [mult]: e.target.value }))}
                                className="w-16 px-2 py-1 rounded-lg text-xs text-center border outline-none font-mono"
                                style={{ background: "rgba(255,255,255,0.06)", borderColor: `${color}40`, color: "rgba(255,255,255,0.9)" }}
                                onKeyDown={e => e.key === "Enter" && saveCategoryLimit(mult)}
                              />
                              <button onClick={() => saveCategoryLimit(mult)} disabled={savingLimit === mult}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                                style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                                {savingLimit === mult ? "…" : "Save"}
                              </button>
                              <button onClick={() => setEditLimit(prev => { const n = {...prev}; delete n[mult]; return n; })}
                                className="px-2 py-1 rounded-lg text-[10px]"
                                style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}>✕</button>
                            </>
                          ) : (
                            <>
                              <span className="font-mono text-sm font-bold" style={{ color }}>
                                {currentLimit === 0 ? "∞" : currentLimit + "/day"}
                              </span>
                              <button onClick={() => setEditLimit(prev => ({ ...prev, [mult]: String(currentLimit) }))}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all"
                                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
                                Edit
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Usage bar */}
                      {mult !== 0 && currentLimit > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                            <span>Today: {used} used</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─ Per-model multiplier assignment ─ */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                Per-model tier assignment
              </p>
              <div className="space-y-1.5">
                {models.map((m: any) => {
                  const mult = m.premium_multiplier ?? 0;
                  const multColors: Record<number,string> = { 0: "#22c55e", 1: "#fbbf24", 3: "#f87171" };
                  const multLabels: Record<number,string> = { 0: "Free", 1: "1×", 3: "3×" };
                  const isEditing = m.id in editMult;
                  return (
                    <div key={m.id} className="rounded-lg border px-3 py-2 flex items-center gap-3"
                      style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.05)" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.75)" }}>{m.label}</p>
                        <p className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{m.id}</p>
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {([0,1,3] as const).map(v => (
                            <button key={v}
                              onClick={() => setEditMult(prev => ({ ...prev, [m.id]: String(v) }))}
                              className="px-2 py-1 rounded-md text-[10px] font-bold transition-all"
                              style={{
                                background: editMult[m.id] === String(v) ? `${multColors[v]}20` : "rgba(255,255,255,0.04)",
                                color: editMult[m.id] === String(v) ? multColors[v] : "rgba(255,255,255,0.3)",
                                border: `1px solid ${editMult[m.id] === String(v) ? multColors[v]+"40" : "rgba(255,255,255,0.08)"}`,
                              }}>
                              {multLabels[v]}
                            </button>
                          ))}
                          <button onClick={() => saveModelMult(m.id)} disabled={savingMult === m.id || !(m.id in editMult)}
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ml-1"
                            style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}>
                            {savingMult === m.id ? "…" : "✓"}
                          </button>
                          <button onClick={() => setEditMult(prev => { const n = {...prev}; delete n[m.id]; return n; })}
                            className="px-1.5 py-1 rounded-md text-[10px]"
                            style={{ color: "rgba(255,255,255,0.3)" }}>✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                            style={{ background: `${multColors[mult] ?? "#fff"}14`, color: multColors[mult] ?? "rgba(255,255,255,0.4)" }}>
                            {multLabels[mult] ?? `${mult}×`}
                          </span>
                          <button onClick={() => setEditMult(prev => ({ ...prev, [m.id]: String(mult) }))}
                            className="px-2 py-1 rounded-md text-[10px] border transition-all"
                            style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={loadLimits}
              className="w-full py-2 rounded-xl border text-xs flex items-center justify-center gap-2 transition-all hover:opacity-70"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
              <RefreshCw className="w-3 h-3" /> Refresh usage stats
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

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

        <AiSection />

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