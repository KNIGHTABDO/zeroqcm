"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowRight, ArrowLeft, Home, BookOpen,
  Sparkles, Bookmark, BarChart2, Settings, Trophy,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "zeroqcm-onboarding-done";

/* ─── Step definitions ──────────────────────────────────────────────── */
type Step = {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  /** CSS selector to spotlight. null = centred modal, no spotlight */
  target: string | null;
  /** Preferred tooltip side relative to target on desktop */
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

/* ─── Spotlight hook ────────────────────────────────────────────────── */
function useSpotlight(selector: string | null) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) { setRect(null); return; }

    const update = () => {
      const els = Array.from(document.querySelectorAll(selector));
      // Prefer the element with non-zero dimensions (i.e. actually visible)
      const visible = els.find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }) ?? els[0] ?? null;
      setRect(visible ? (visible as Element).getBoundingClientRect() : null);
    };

    update();
    const ro = new ResizeObserver(update);
    const mo = new MutationObserver(update);
    Array.from(document.querySelectorAll(selector)).forEach(el => ro.observe(el));
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selector]);

  return rect;
}

/* ─── SVG spotlight overlay ─────────────────────────────────────────── */
function SpotlightOverlay({ rect, padding = 10 }: { rect: DOMRect | null; padding?: number }) {
  const base = "fixed inset-0 z-[900] pointer-events-none";

  if (!rect) {
    return (
      <div
        className={`${base} pointer-events-auto`}
        style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
      />
    );
  }

  const t = Math.round(rect.top - padding);
  const l = Math.round(rect.left - padding);
  const w = Math.round(rect.width + padding * 2);
  const h = Math.round(rect.height + padding * 2);

  return (
    <svg className={base} style={{ width: "100vw", height: "100vh" }}>
      <defs>
        <mask id="zt-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={l} y={t} width={w} height={h} rx="10" fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#zt-mask)" />
      <rect x={l} y={t} width={w} height={h} rx="10" fill="none" stroke="rgba(99,179,237,0.55)" strokeWidth="2" />
    </svg>
  );
}

/* ─── Tooltip positioning (pure CSS, no JS transform conflict) ──────── */
function getTooltipStyle(
  rect: DOMRect | null,
  placement: Step["placement"],
): React.CSSProperties {
  const PAD = 16;
  const CARD_W = 310;

  // No target → perfectly centred using CSS only (no transform in style prop)
  if (!rect) {
    return {
      position: "fixed",
      inset: 0,
      margin: "auto",
      width: `min(${CARD_W}px, calc(100vw - ${PAD * 2}px))`,
      height: "fit-content",
      maxWidth: `calc(100vw - ${PAD * 2}px)`,
    };
  }

  const vw = typeof window !== "undefined" ? window.innerWidth : 375;
  const vh = typeof window !== "undefined" ? window.innerHeight : 812;
  const isMobile = vw < 640;
  const cardW = Math.min(CARD_W, vw - PAD * 2);

  // On mobile: always render card above the bottom nav (above target)
  if (isMobile) {
    // Place above the target with enough room, or below if near top
    const spaceAbove = rect.top;
    const spaceBelow = vh - rect.bottom;
    const useAbove = spaceAbove > spaceBelow || spaceBelow < 200;

    if (useAbove) {
      return {
        position: "fixed",
        bottom: `${vh - rect.top + PAD}px`,
        left: "50%",
        transform: "translateX(-50%)",
        width: `${cardW}px`,
        maxWidth: `calc(100vw - ${PAD * 2}px)`,
      };
    } else {
      return {
        position: "fixed",
        top: `${rect.bottom + PAD}px`,
        left: "50%",
        transform: "translateX(-50%)",
        width: `${cardW}px`,
        maxWidth: `calc(100vw - ${PAD * 2}px)`,
      };
    }
  }

  // Desktop: position by placement
  const midY = Math.round(rect.top + rect.height / 2);

  switch (placement) {
    case "right": {
      const leftPos = rect.right + PAD;
      // Would overflow right? put it to the left instead
      const finalLeft = leftPos + cardW > vw - PAD
        ? rect.left - cardW - PAD
        : leftPos;
      return {
        position: "fixed",
        top: `${Math.max(PAD, Math.min(midY - 110, vh - 280))}px`,
        left: `${Math.max(PAD, finalLeft)}px`,
        width: `${cardW}px`,
      };
    }
    case "left": {
      const leftPos = rect.left - cardW - PAD;
      return {
        position: "fixed",
        top: `${Math.max(PAD, Math.min(midY - 110, vh - 280))}px`,
        left: `${Math.max(PAD, leftPos)}px`,
        width: `${cardW}px`,
      };
    }
    case "top": {
      return {
        position: "fixed",
        bottom: `${vh - rect.top + PAD}px`,
        left: "50%",
        transform: "translateX(-50%)",
        width: `${cardW}px`,
      };
    }
    case "bottom":
    default: {
      return {
        position: "fixed",
        top: `${Math.min(rect.bottom + PAD, vh - 280)}px`,
        left: "50%",
        transform: "translateX(-50%)",
        width: `${cardW}px`,
      };
    }
  }
}

/* ─── Tooltip card ──────────────────────────────────────────────────── */
function TooltipCard({
  step, index, total, rect,
  onNext, onBack, onSkip,
}: {
  step: Step; index: number; total: number; rect: DOMRect | null;
  onNext: () => void; onBack: () => void; onSkip: () => void;
}) {
  const isFirst = index === 0;
  const isLast  = index === total - 1;
  const Icon    = step.icon;
  const posStyle = getTooltipStyle(rect, step.placement);

  return (
    // Wrapper keeps framer animation transforms separate from positioning
    <div className="fixed inset-0 z-[1000] pointer-events-none" aria-modal="true">
      <motion.div
        key={step.id}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto rounded-2xl px-5 py-4 shadow-2xl"
        style={{
          ...posStyle,
          background: "var(--surface, #141414)",
          border: "1px solid rgba(99,179,237,0.2)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,179,237,0.12)",
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(99,179,237,0.12)", border: "1px solid rgba(99,179,237,0.2)" }}
            >
              <Icon className="w-4 h-4" style={{ color: "var(--accent, #63b3ed)" }} />
            </div>
            <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text, #f0f0f0)" }}>
              {step.title}
            </p>
          </div>
          <button
            onClick={onSkip}
            aria-label="Passer le tour"
            className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-muted, #666)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs mb-4" style={{ color: "var(--text-secondary, #888)", lineHeight: 1.65 }}>
          {step.desc}
        </p>

        {/* Footer: dots + buttons */}
        <div className="flex items-center justify-between gap-2">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width:  i === index ? "16px" : "5px",
                  height: "5px",
                  background:
                    i === index   ? "var(--accent, #63b3ed)"
                    : i < index   ? "rgba(99,179,237,0.35)"
                                  : "rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!isFirst && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: "var(--text-muted, #666)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <ArrowLeft className="w-3 h-3" />
                Retour
              </button>
            )}
            <button
              onClick={onNext}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
              style={{
                background: isLast ? "var(--accent, #63b3ed)" : "rgba(99,179,237,0.14)",
                color:      isLast ? "#000" : "var(--accent, #63b3ed)",
                border:     "1px solid rgba(99,179,237,0.28)",
              }}
            >
              {isLast ? "Commencer !" : "Suivant"}
              {!isLast && <ArrowRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Main export ────────────────────────────────────────────────────── */
export function OnboardingTour() {
  const { user }   = useAuth();
  const [visible,  setVisible]  = useState(false);
  const [step,     setStep]     = useState(0);
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const finish = useCallback(async () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
    if (user) {
      try {
        const { data: p } = await supabase.from("profiles").select("preferences").eq("id", user.id).single();
        const prefs = p?.preferences ?? {};
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

  // Scroll spotlight target into view
  useEffect(() => {
    if (!currentStep.target) return;
    const el = document.querySelector(currentStep.target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [step, currentStep.target]);

  if (!visible || !mounted) return null;

  const showSpotlight = !!currentStep.target;

  return (
    <AnimatePresence>
      {visible && (
        <>
          <SpotlightOverlay rect={showSpotlight ? rect : null} />
          <TooltipCard
            step={currentStep}
            index={step}
            total={STEPS.length}
            rect={showSpotlight ? rect : null}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={finish}
          />
        </>
      )}
    </AnimatePresence>
  );
}