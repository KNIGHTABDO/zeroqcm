"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight, LogOut } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { OnboardingTour } from "./OnboardingTour";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "@/lib/supabase";

// Pages that render as full-viewport (no sidebar/nav overlay)
const FULLSCREEN_PREFIXES = ["/quiz", "/auth", "/admin"];

// Pages that are public (no activation check)
const PUBLIC_PATHS = ["/", "/auth", "/activate", "/admin"];

// Pages where bottom nav padding is not needed (chat manages its own layout)
const NO_BOTTOM_PAD_PREFIXES = ["/chatwithai"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path   = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [activated, setActivated] = useState<boolean | null>(null);
  const lastCheckedUser = useRef<string | null>(null);

  const isFullscreen   = FULLSCREEN_PREFIXES.some(r => path.startsWith(r));
  const noBottomPad    = NO_BOTTOM_PAD_PREFIXES.some(r => path.startsWith(r));
  const needsLockCheck = PUBLIC_PATHS.every(p => path !== p && !path.startsWith(p + "/"));

  useEffect(() => {
    if (!needsLockCheck) { setActivated(null); lastCheckedUser.current = null; return; }
    if (authLoading || !user) return;
    if (lastCheckedUser.current === user.id) return;
    setActivated(null);
    lastCheckedUser.current = user.id;
    supabase.from("activation_keys").select("status").eq("user_id", user.id).maybeSingle()
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  if (isFullscreen) {
    return (
      <>
        {children}
        <AnimatePresence>
          {isChecking && <LoadingOverlay />}
          {isLocked && <LockOverlay onActivate={() => router.push("/activate")} onSignOut={handleSignOut} />}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <Sidebar />
      <div
        className={[
          "flex-1 min-w-0 overflow-x-hidden lg:ml-60",
          noBottomPad ? "" : "pb-20 lg:pb-0",
        ].join(" ")}
      >
        <div style={{ visibility: hideContent ? "hidden" : "visible" }}>
          {!hideContent && <OnboardingTour />}
          {children}
        </div>
        {!noBottomPad && <BottomNav />}
      </div>
      <AnimatePresence>
        {isChecking && <LoadingOverlay />}
        {isLocked && <LockOverlay onActivate={() => router.push("/activate")} onSignOut={handleSignOut} />}
      </AnimatePresence>
    </div>
  );
}

function LoadingOverlay() {
  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--text)" }} />
    </motion.div>
  );
}

function LockOverlay({ onActivate, onSignOut }: { onActivate: () => void; onSignOut: () => void }) {
  return (
    <motion.div
      key="lock"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "rgba(0,0,0,0.93)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6 max-w-xs w-full"
      >
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
            <Lock className="w-6 h-6" style={{ color: "rgba(255,255,255,0.5)" }} />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-lg font-bold text-white">Accès restreint</p>
          <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.50)" }}>
            Votre compte doit être activé pour accéder à ZeroQCM.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }} onClick={onActivate}
          className="w-full py-3.5 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2"
          style={{ background: "#ffffff", color: "#0a0a0a" }}
        >
          Activer mon compte
          <ArrowRight className="w-4 h-4" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }} onClick={onSignOut}
          className="w-full py-3 rounded-xl text-[13px] font-medium flex items-center justify-center gap-2"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
