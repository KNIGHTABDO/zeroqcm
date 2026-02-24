"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

const DUAA_TEXT =
  "اللهم إني أستودعك ما قرأت وما حفظت وما تعلمت، فرده عند حاجتي إليه، إنك على كل شيء قدير";

const DUAA_SUB =
  "من الأدعية المستحبة للمذاكرة والامتحانات لثبات المعلومة وتذكرها عند الحاجة، مع التوكل على الله وتفويض الأمر";

const SUPPRESS_MINUTES = 40;

interface DuaaModalProps {
  /** Pass a stable key so the modal re-evaluates when the user navigates to a new exam/exercise */
  activityId: number | string;
}

export function DuaaModal({ activityId }: DuaaModalProps) {
  const { user, profile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!profile) return;
    if (checked) return;
    setChecked(true);

    const prefs = (profile.preferences ?? {}) as Record<string, unknown>;
    const lastDismissed = prefs["duaa_last_dismissed"] as string | undefined;

    if (lastDismissed) {
      const elapsed = (Date.now() - new Date(lastDismissed).getTime()) / 60_000;
      if (elapsed < SUPPRESS_MINUTES) return; // suppressed
    }

    setVisible(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, activityId]);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (!user || !profile) return;
    const prefs = { ...(profile.preferences ?? {}), duaa_last_dismissed: new Date().toISOString() };
    // Persist to DB (non-blocking)
    Promise.resolve(
      supabase.from("profiles").update({ preferences: prefs }).eq("id", user.id)
    ).catch(() => {});
  }, [user, profile]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="duaa-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl p-6 text-center"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
          >
            {/* Close button */}
            <button
              onClick={dismiss}
              aria-label="Fermer"
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Icon */}
            <div className="text-4xl mb-4 select-none">🤲</div>

            {/* Duaa text */}
            <p
              className="text-base font-medium leading-loose mb-3"
              dir="rtl"
              lang="ar"
              style={{ color: "var(--text)", fontFamily: "'Amiri', serif, sans-serif" }}
            >
              {DUAA_TEXT}
            </p>

            {/* Subtitle */}
            <p
              className="text-xs leading-relaxed mb-5"
              dir="rtl"
              lang="ar"
              style={{ color: "var(--text-muted)" }}
            >
              {DUAA_SUB}
            </p>

            {/* Dismiss button */}
            <button
              onClick={dismiss}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--border)" }}
            >
              بسم الله، لنبدأ ✨
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
