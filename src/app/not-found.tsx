"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { useRouter } from "next/navigation";

// ── EKG path points: realistic QRS complex + flatline ──────────────────────
const EKG_PULSE = `M0,50 L60,50 L70,48 L80,30 L90,70 L100,10 L110,80 L120,50 L180,50`;
const FLATLINE   = `M0,50 L480,50`;

function useEKG() {
  const [phase, setPhase] = useState<"pulse" | "flat" | "done">("pulse");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("flat"),  2200);
    const t2 = setTimeout(() => setPhase("done"),  4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return phase;
}

// ── Scanline overlay ────────────────────────────────────────────────────────
function Scanlines() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-2xl"
      style={{ background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px)" }} />
  );
}

// ── Glowing ring pulse ──────────────────────────────────────────────────────
function PulseRing({ delay }: { delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full border"
      style={{ borderColor: "rgba(16,185,129,0.3)", top: "50%", left: "50%", x: "-50%", y: "-50%", width: 80, height: 80 }}
      animate={{ scale: [1, 3.5], opacity: [0.6, 0] }}
      transition={{ duration: 2, repeat: Infinity, delay, ease: "easeOut" }}
    />
  );
}

// ── Animated EKG trace on SVG canvas ───────────────────────────────────────
function EKGTrace({ phase }: { phase: "pulse" | "flat" | "done" }) {
  const ref = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);

  useEffect(() => {
    if (ref.current) setLen(ref.current.getTotalLength());
  }, [phase]);

  return (
    <svg viewBox="0 0 480 100" className="w-full" style={{ height: 80 }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Grid lines */}
      {[20,40,60,80].map(y => (
        <line key={y} x1="0" y1={y} x2="480" y2={y} stroke="rgba(16,185,129,0.06)" strokeWidth="1" />
      ))}
      {[60,120,180,240,300,360,420].map(x => (
        <line key={x} x1={x} y1="0" x2={x} y2="100" stroke="rgba(16,185,129,0.06)" strokeWidth="1" />
      ))}
      {/* Active trace */}
      <AnimatePresence mode="wait">
        {phase === "pulse" && (
          <motion.path key="pulse"
            ref={ref as React.Ref<SVGPathElement>}
            d={`${EKG_PULSE} L200,50 L260,50 ${EKG_PULSE.replace(/M0/,"M200")} L440,50 L480,50`}
            fill="none" stroke="rgb(16,185,129)" strokeWidth="2.5"
            filter="url(#glow)"
            style={{ strokeDasharray: len || 1000, strokeDashoffset: len || 1000 }}
            animate={{ strokeDashoffset: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "linear" }}
          />
        )}
        {(phase === "flat" || phase === "done") && (
          <motion.path key="flat"
            d={FLATLINE}
            fill="none" stroke="rgb(239,68,68)" strokeWidth="2.5"
            filter="url(#glow)"
            initial={{ strokeDasharray: 480, strokeDashoffset: 480, opacity: 1 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 1.2, ease: "linear" }}
          />
        )}
      </AnimatePresence>
    </svg>
  );
}

// ── Typing text effect ──────────────────────────────────────────────────────
function Typewriter({ text, delay = 0, speed = 35 }: { text: string; delay?: number; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [started, text, speed]);

  return <span>{displayed}<span className="animate-pulse">_</span></span>;
}

// ── Main 404 page ───────────────────────────────────────────────────────────
export default function NotFound() {
  const router = useRouter();
  const phase = useEKG();
  const controls = useAnimationControls();
  const [showDiag, setShowDiag] = useState(false);
  const [showBtn, setShowBtn] = useState(false);
  const [shockAnim, setShockAnim] = useState(false);

  useEffect(() => {
    if (phase === "flat") setTimeout(() => setShowDiag(true), 800);
    if (phase === "done")  setTimeout(() => setShowBtn(true), 400);
  }, [phase]);

  function handleDefib() {
    setShockAnim(true);
    controls.start({ scale: [1, 1.04, 0.97, 1.03, 1], transition: { duration: 0.4 } });
    setTimeout(() => { setShockAnim(false); router.push("/"); }, 900);
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4"
      style={{ background: "var(--bg)" }}>

      {/* Ambient background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Green glow (alive phase) */}
        <motion.div
          className="absolute rounded-full blur-[120px]"
          style={{ background: "rgba(16,185,129,0.12)", width: 500, height: 500, top: "30%", left: "50%", x: "-50%", y: "-50%" }}
          animate={phase === "pulse" ? { opacity: [0.6,1,0.6] } : { opacity: 0 }}
          transition={{ duration: 1.5, repeat: phase === "pulse" ? Infinity : 0 }}
        />
        {/* Red glow (dead phase) */}
        <motion.div
          className="absolute rounded-full blur-[140px]"
          style={{ background: "rgba(239,68,68,0.1)", width: 600, height: 600, top: "40%", left: "50%", x: "-50%", y: "-50%" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase !== "pulse" ? 1 : 0 }}
          transition={{ duration: 1.5 }}
        />
      </div>

      {/* Monitor card */}
      <motion.div animate={controls}
        className="relative w-full max-w-lg rounded-2xl border overflow-hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>

        <Scanlines />

        {/* Monitor top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
          <div className="flex items-center gap-2">
            <motion.div className="w-2 h-2 rounded-full"
              style={{ background: phase === "pulse" ? "rgb(16,185,129)" : "rgb(239,68,68)" }}
              animate={phase === "pulse" ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              ZeroQCM · Patient Monitor
            </span>
          </div>
          <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
            {phase === "pulse" ? "STABLE" : "CRITICAL"}
          </span>
        </div>

        {/* EKG trace area */}
        <div className="relative px-5 pt-4 pb-2">
          {/* Pulse rings when alive */}
          {phase === "pulse" && (
            <div className="absolute right-8 top-1/2 pointer-events-none">
              <PulseRing delay={0} />
              <PulseRing delay={0.7} />
            </div>
          )}
          <EKGTrace phase={phase} />
        </div>

        {/* Vitals row */}
        <div className="grid grid-cols-3 gap-px mx-5 mb-4 rounded-xl overflow-hidden border"
          style={{ borderColor: "var(--border)" }}>
          {[
            { label: "BPM", value: phase === "pulse" ? "72" : "0", unit: "" },
            { label: "SPO₂", value: phase === "pulse" ? "99" : "—", unit: "%" },
            { label: "ERR", value: "404", unit: "" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="px-3 py-2.5 text-center" style={{ background: "var(--surface-alt)" }}>
              <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
              <motion.p className="text-xl font-bold tabular-nums font-mono"
                style={{
                  color: label === "ERR" ? "var(--error)" :
                         (phase !== "pulse" && label === "BPM") ? "var(--error)" : "var(--text)",
                }}
                animate={label === "BPM" && phase !== "pulse" ? { opacity: [1, 0.3, 1] } : {}}
                transition={{ duration: 0.6, repeat: Infinity }}>
                {value}{unit}
              </motion.p>
            </div>
          ))}
        </div>

        {/* Alarm banner */}
        <AnimatePresence>
          {phase !== "pulse" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mx-5 mb-4 px-4 py-2.5 rounded-xl flex items-center gap-3"
              style={{ background: "var(--error-subtle)", border: "1px solid var(--error-border)" }}>
              <motion.div className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: "var(--error)" }}
                animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.5, repeat: Infinity }} />
              <span className="text-xs font-semibold font-mono" style={{ color: "var(--error)" }}>
                ALARME · PAGE_NOT_FOUND · ROUTE INTROUVABLE
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Diagnostic terminal */}
        <AnimatePresence>
          {showDiag && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mx-5 mb-4 px-4 py-3 rounded-xl font-mono text-xs space-y-1.5"
              style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
              <p style={{ color: "var(--text-muted)" }}>
                <span style={{ color: "var(--success)" }}>zerøqcm</span>
                <span style={{ color: "var(--text-muted)" }}> ~</span>
                <span style={{ color: "var(--text)" }}> $ diagnose --route</span>
              </p>
              <p style={{ color: "var(--text-muted)" }}>
                <Typewriter text='> Code: 404 · "Route deceased"' delay={100} />
              </p>
              <p style={{ color: "var(--text-muted)" }}>
                <Typewriter text="> Cause: Navigated to unknown territory" delay={900} />
              </p>
              <p style={{ color: "var(--text-muted)" }}>
                <Typewriter text="> Prognosis: Use defibrillator ↓" delay={1900} />
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Defibrillator button */}
        <AnimatePresence>
          {showBtn && (
            <motion.div className="px-5 pb-5"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <motion.button
                onClick={handleDefib}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-xl text-sm font-bold tracking-widest uppercase relative overflow-hidden"
                style={{
                  background: shockAnim ? "var(--success)" : "var(--text)",
                  color: "var(--bg)",
                  letterSpacing: "0.2em",
                }}>
                {/* Shock flash overlay */}
                <AnimatePresence>
                  {shockAnim && (
                    <motion.div className="absolute inset-0"
                      initial={{ opacity: 0.8 }} animate={{ opacity: 0 }}
                      transition={{ duration: 0.6 }}
                      style={{ background: "white" }} />
                  )}
                </AnimatePresence>
                ⚡ Défibriller · Retour à l&apos;accueil
              </motion.button>
              <p className="text-center text-[10px] mt-2 font-mono" style={{ color: "var(--text-muted)" }}>
                CHARGE: 200J · MODE: SYNC · PATIENT: BROWSER
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Big ghost 404 */}
      <motion.p
        className="absolute font-black select-none pointer-events-none"
        style={{
          fontSize: "clamp(120px, 30vw, 280px)",
          lineHeight: 1,
          color: "var(--text)",
          opacity: 0.025,
          bottom: "-2%",
          letterSpacing: "-0.06em",
          zIndex: 0,
        }}
        initial={{ opacity: 0 }} animate={{ opacity: 0.025 }}
        transition={{ delay: 0.8 }}>
        404
      </motion.p>

      {/* Footer note */}
      <motion.p className="relative z-10 mt-6 text-xs text-center font-mono"
        style={{ color: "var(--text-muted)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
        ZeroQCM · Faculté de Médecine · Diagnostic: Route introuvable
      </motion.p>

    </main>
  );
}
