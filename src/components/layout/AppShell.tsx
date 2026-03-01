"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { OnboardingTour } from "./OnboardingTour";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "@/lib/supabase";

// Pages with no sidebar/nav (full viewport layout)
const FULLSCREEN_PATHS = ["/quiz/", "/auth", "/admin"];

// Pages that are fully public — no activation check needed
const PUBLIC_PATHS = ["/", "/auth", "/activate", "/admin"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path   = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // null = checking | true = approved | false = not approved
  const [activated, setActivated] = useState<boolean | null>(null);
  const lastCheckedUser = useRef<string | null>(null);

  const isFullscreen   = FULLSCREEN_PATHS.some((r) => path.startsWith(r));
  const needsLockCheck = PUBLIC_PATHS.every((p) => path !== p && !path.startsWith(p + "/"));

  useEffect(() => {
    if (!needsLockCheck) {
      setActivated(null);
      lastCheckedUser.current = null;
      return;
    }
    if (authLoading) return;
    if (!user) return;
    if (lastCheckedUser.current === user.id) return;

    setActivated(null);
    lastCheckedUser.current = user.id;

    supabase
      .from("activation_keys")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (lastCheckedUser.current !== user.id) return;
        if (error) { setActivated(false); return; }
        setActivated(data?.status === "approved");
      });
  }, [user?.id, authLoading, needsLockCheck]);

  useEffect(() => {
    if (!user) { setActivated(null); lastCheckedUser.current = null; }
  }, [user?.id]);

  const isChecking = needsLockCheck && !authLoading && !!user && activated === null;
  const isLocked   = needsLockCheck && !authLoading && !!user && activated === false;
  const hideContent = isChecking || isLocked;

  if (isFullscreen) {
    return (
      <>
        {children}
        <AnimatePresence>
          {isChecking && (
            <motion.div key="fs-checking"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[200] flex items-center justify-center"
              style={{ background: "var(--bg)" }}>
              <div className="w-7 h-7 rounded-full border-2 animate-spin"
                style={{ borderColor: "var(--border)", borderTopColor: "var(--text)" }} />
            </motion.div>
          )}
          {isLocked && <LockOverlay onActivate={() => router.push("/activate")} />}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <Sidebar />
      <div className={`flex-1 min-w-0 overflow-x-hidden lg:ml-64 lg:pb-0 ${path.startsWith("/chatwithai") ? "" : "pb-20"}`}>
        <div style={{ visibility: hideContent ? "hidden" : "visible" }}>
          {!hideContent && <OnboardingTour />}
          {children}
        </div>
        <BottomNav />
      </div>
      <AnimatePresence>
        {isChecking && (
          <motion.div key="checking"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ background: "var(--bg)" }}>
            <div className="w-7 h-7 rounded-full border-2 animate-spin"
              style={{ borderColor: "var(--border)", borderTopColor: "var(--text)" }} />
          </motion.div>
        )}
        {isLocked && <LockOverlay onActivate={() => router.push("/activate")} />}
      </AnimatePresence>
    </div>
  );
}

function LockOverlay({ onActivate }: { onActivate: () => void }) {
  return (
    <motion.div key="lock-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6 max-w-xs">
        <div className="flex justify-center">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
            <rect width="48" height="48" rx="14" fill="white" />
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="black"
              fontSize="22" fontWeight="800" fontFamily="system-ui,-apple-system,sans-serif">Z</text>
          </svg>
        </div>
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Lock className="w-7 h-7 text-white/60" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-lg font-bold text-white">Accès restreint</p>
          <p className="text-sm text-white/50 leading-relaxed">
            Votre compte doit être activé pour accéder à ZeroQCM.
          </p>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onActivate}
          className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: "white", color: "black" }}>
          Activer mon compte
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}