"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "@/lib/supabase";

const FULLSCREEN    = ["/quiz/", "/auth"];
const NO_LOCK_PATHS = ["/activate", "/auth", "/"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path     = usePathname();
  const router   = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [activated, setActivated]     = useState<boolean | null>(null);

  const isFullscreen = FULLSCREEN.some((r) => path.startsWith(r));
  const needsLockCheck = !isFullscreen && NO_LOCK_PATHS.every((p) => path !== p && !path.startsWith(p));

  useEffect(() => {
    if (!needsLockCheck || authLoading) return;
    if (!user) { setActivated(null); return; }

    supabase
      .from("activation_keys")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setActivated(data?.status === "approved");
      });
  }, [user, authLoading, needsLockCheck, path]);

  if (isFullscreen) return <>{children}</>;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <Sidebar />
      <div className="flex-1 min-w-0 overflow-x-hidden lg:ml-64 pb-20 lg:pb-0">
        {children}
        <BottomNav />
      </div>

      {/* Activation lock overlay */}
      <AnimatePresence>
        {needsLockCheck && !authLoading && user && activated === false && (
          <motion.div
            key="lock-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 text-center"
            style={{
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6 max-w-xs"
            >
              {/* Logo */}
              <div className="flex justify-center">
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
                  <rect width="48" height="48" rx="14" fill="white" />
                  <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="black"
                    fontSize="22" fontWeight="800" fontFamily="system-ui,-apple-system,sans-serif">Z</text>
                </svg>
              </div>

              {/* Lock icon */}
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <Lock className="w-7 h-7 text-white/60" />
                </div>
              </div>

              {/* Text */}
              <div className="space-y-2">
                <p className="text-lg font-bold text-white">Accès restreint</p>
                <p className="text-sm text-white/50 leading-relaxed">
                  Votre compte doit être activé pour accéder à ZeroQCM.
                </p>
              </div>

              {/* CTA */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push("/activate")}
                className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{ background: "white", color: "black" }}
              >
                Activer mon compte
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
