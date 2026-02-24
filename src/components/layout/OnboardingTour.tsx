"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ArrowLeft, Home, BookOpen, Sparkles, Bookmark, BarChart2, Settings, Trophy } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "zeroqcm-onboarding-done";

type Step = {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  /** CSS selector of element to spotlight. null = center-screen modal */
  target: string | null;
  /** Where to show the tooltip relative to target */
  placement?: "top" | "bottom" | "left" | "right";
};

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "Bienvenue sur ZeroQCM 🎉",
    desc: "La plateforme de révision médicale gratuite pour les étudiants marocains. Faisons un tour rapide pour te montrer l'essentiel.",
    icon: Sparkles,
    target: null,
  },
  {
    id: "semestres",
    title: "Tes semestres S1 → S9",
    desc: "Toute ta scolarité en un seul endroit. 180 000+ questions classées par semestre, module et activité.",
    icon: BookOpen,
    target: "[data-tour='semestres']",
    placement: "right",
  },
  {
    id: "quiz",
    title: "Lance un QCM en 1 clic",
    desc: "Clique sur n'importe quelle activité pour démarrer un quiz chronométré avec corrections détaillées.",
    icon: Home,
    target: "[data-tour='dashboard']",
    placement: "right",
  },
  {
    id: "chatai",
    title: "Ton tuteur IA 24h/24",
    desc: "Pose n'importe quelle question médicale. L'IA cherche dans la base et t'explique avec des QCM réels.",
    icon: Sparkles,
    target: "[data-tour='chatwithai']",
    placement: "right",
  },
  {
    id: "bookmarks",
    title: "Marque les questions importantes",
    desc: "Bookmark les questions difficiles pendant un quiz. Révise-les quand tu veux depuis tes Favoris.",
    icon: Bookmark,
    target: "[data-tour='bookmarks']",
    placement: "right",
  },
  {
    id: "stats",
    title: "Suis ta progression",
    desc: "Taux de réussite par module, série quotidienne, classement — tout est tracé automatiquement.",
    icon: BarChart2,
    target: "[data-tour='stats']",
    placement: "right",
  },
  {
    id: "settings",
    title: "Choisis ton modèle IA",
    desc: "GPT-5 mini, GPT-4o, DeepSeek… Personnalise le modèle utilisé pour les explications et le chat.",
    icon: Settings,
    target: "[data-tour='settings']",
    placement: "right",
  },
  {
    id: "done",
    title: "Tu es prêt(e) !",
    desc: "Commence par explorer tes semestres ou pose une question à l'IA. Bonne révision 💪",
    icon: Trophy,
    target: null,
  },
];

function useSpotlight(selector: string | null) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) { setRect(null); return; }

    const update = () => {
      // Find all matching elements, prefer the one that's visible (non-zero width)
      const els = document.querySelectorAll(selector);
      let target: Element | null = null;
      els.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) target = el;
      });
      if (!target) target = els[0] ?? null;
      if (target) setRect((target as Element).getBoundingClientRect());
      else setRect(null);
    };

    update();
    const ro = new ResizeObserver(update);
    const mo = new MutationObserver(update);
    document.querySelectorAll(selector).forEach(el => ro.observe(el));
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => { ro.disconnect(); mo.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [selector]);

  return rect;
}

function SpotlightOverlay({ rect, padding = 8 }: { rect: DOMRect | null; padding?: number }) {
  if (!rect) return (
    <div className="fixed inset-0 z-[900]" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
  );

  const top = rect.top - padding;
  const left = rect.left - padding;
  const width = rect.width + padding * 2;
  const height = rect.height + padding * 2;

  return (
    <svg className="fixed inset-0 z-[900] pointer-events-none" style={{ width: "100vw", height: "100vh" }}>
      <defs>
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={left} y={top} width={width} height={height} rx="12" fill="black" />
        </mask>
      </defs>
      <rect
        width="100%" height="100%"
        fill="rgba(0,0,0,0.75)"
        mask="url(#spotlight-mask)"
        style={{ backdropFilter: "blur(4px)" }}
      />
      {/* Glowing border around spotlight */}
      <rect
        x={left} y={top} width={width} height={height} rx="12"
        fill="none"
        stroke="rgba(99,179,237,0.5)"
        strokeWidth="2"
      />
    </svg>
  );
}

function TooltipCard({
  step,
  index,
  total,
  rect,
  onNext,
  onBack,
  onSkip,
}: {
  step: Step;
  index: number;
  total: number;
  rect: DOMRect | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const Icon = step.icon;

  // Position tooltip near spotlight rect
  const getStyle = (): React.CSSProperties => {
    if (!rect) {
      // Center screen
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(340px, 90vw)",
      };
    }

    const PAD = 16;
    const TIP_W = Math.min(300, window.innerWidth * 0.9);
    const placement = step.placement ?? "bottom";

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    switch (placement) {
      case "right": {
        let left = rect.right + PAD;
        let top = rect.top + rect.height / 2;
        // Clamp right overflow
        if (left + TIP_W > vw - PAD) left = rect.left - TIP_W - PAD;
        // On mobile, fall below
        if (vw < 640) {
          return { position: "fixed", bottom: `${vh - rect.bottom - rect.height - PAD}px`, left: "50%", transform: "translateX(-50%)", width: `${TIP_W}px` };
        }
        return { position: "fixed", top: `${Math.max(PAD, Math.min(top - 80, vh - 260))}px`, left: `${left}px`, width: `${TIP_W}px` };
      }
      case "left": {
        const left = rect.left - TIP_W - PAD;
        const top = rect.top + rect.height / 2;
        if (vw < 640) {
          return { position: "fixed", bottom: `${vh - rect.bottom - rect.height - PAD}px`, left: "50%", transform: "translateX(-50%)", width: `${TIP_W}px` };
        }
        return { position: "fixed", top: `${Math.max(PAD, Math.min(top - 80, vh - 260))}px`, left: `${Math.max(PAD, left)}px`, width: `${TIP_W}px` };
      }
      case "top": {
        const bottom = vh - rect.top + PAD;
        return { position: "fixed", bottom: `${bottom}px`, left: "50%", transform: "translateX(-50%)", width: `${TIP_W}px` };
      }
      case "bottom":
      default: {
        const top2 = rect.bottom + PAD;
        return { position: "fixed", top: `${Math.min(top2, vh - 260)}px`, left: "50%", transform: "translateX(-50%)", width: `${TIP_W}px` };
      }
    }
  };

  return (
    <motion.div
      key={step.id}
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -8 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="z-[1000] rounded-2xl px-5 py-4 shadow-2xl"
      style={{
        ...getStyle(),
        background: "var(--surface, #1a1a1a)",
        border: "1px solid rgba(99,179,237,0.2)",
        boxShadow: "0 0 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,179,237,0.15)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(99,179,237,0.12)", border: "1px solid rgba(99,179,237,0.2)" }}>
            <Icon className="w-4 h-4" style={{ color: "var(--accent, #63b3ed)" }} />
          </div>
          <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text, #f0f0f0)" }}>{step.title}</p>
        </div>
        <button onClick={onSkip}
          className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ color: "var(--text-muted, #666)" }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--text-secondary, #999)", lineHeight: 1.6 }}>
        {step.desc}
      </p>

      {/* Progress dots */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i}
              className="rounded-full transition-all"
              style={{
                width: i === index ? "18px" : "6px",
                height: "6px",
                background: i === index ? "var(--accent, #63b3ed)" : i < index ? "rgba(99,179,237,0.4)" : "rgba(255,255,255,0.12)",
              }} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {!isFirst && (
            <button onClick={onBack}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ color: "var(--text-muted, #666)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <ArrowLeft className="w-3 h-3" /> Retour
            </button>
          )}
          <button onClick={onNext}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: isLast ? "var(--accent, #63b3ed)" : "rgba(99,179,237,0.15)", color: isLast ? "#000" : "var(--accent, #63b3ed)", border: "1px solid rgba(99,179,237,0.3)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}>
            {isLast ? "Commencer !" : "Suivant"}
            {!isLast && <ArrowRight className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function OnboardingTour() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Small delay to let the page settle before starting tour
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const finish = useCallback(async () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
    // Also persist to Supabase so it doesn't re-show on other devices
    if (user) {
      try {
        const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).single();
        const prefs = profile?.preferences ?? {};
        await supabase.from("profiles").update({ preferences: { ...prefs, onboarding_done: true } }).eq("id", user.id);
      } catch { /* non-blocking */ }
    }
  }, [user]);

  const handleNext = useCallback(() => {
    if (step >= STEPS.length - 1) finish();
    else setStep(s => s + 1);
  }, [step, finish]);

  const handleBack = useCallback(() => setStep(s => Math.max(0, s - 1)), []);

  const currentStep = STEPS[step];
  const rect = useSpotlight(mounted ? currentStep.target : null);

  // Scroll target into view if off-screen
  useEffect(() => {
    if (!currentStep.target) return;
    const el = document.querySelector(currentStep.target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [step, currentStep.target]);

  if (!visible || !mounted) return null;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <SpotlightOverlay rect={currentStep.target ? rect : null} />

          {/* Tooltip */}
          <TooltipCard
            step={currentStep}
            index={step}
            total={STEPS.length}
            rect={currentStep.target ? rect : null}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={finish}
          />
        </>
      )}
    </AnimatePresence>
  );
}