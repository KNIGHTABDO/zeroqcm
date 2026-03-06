"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, BookOpen, Sparkles, Trophy, Grid3x3,
  BarChart2, Bookmark, Award, User, Settings,
  Layers, GraduationCap, Mic, Users2, X
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const PRIMARY_TABS = [
  { href: "/semestres", icon: Home,     label: "Accueil" },
  { href: "/chatwithai",icon: Sparkles, label: "Chat IA" },
  { href: "/leaderboard",icon: Trophy,  label: "Classement" },
  { href: "/bookmarks", icon: Bookmark, label: "Favoris" },
  { href: "/more",      icon: Grid3x3,  label: "Plus",    isMore: true },
];

const MORE_ITEMS = [
  { href: "/flashcards",  icon: Layers,        label: "Flashcards" },
  { href: "/revision",    icon: GraduationCap, label: "Révision ciblée" },
  { href: "/voice",       icon: Mic,           label: "Mode vocal" },
  { href: "/study-rooms", icon: Users2,        label: "Salles d'étude" },
  { href: "/stats",       icon: BarChart2,     label: "Statistiques" },
  { href: "/certificates",icon: Award,         label: "Certificats" },
  { href: "/profile",     icon: User,          label: "Profil" },
  { href: "/settings",    icon: Settings,      label: "Paramètres" },
];

export function BottomNav() {
  const path = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { setMoreOpen(false); }, [path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) =>
    href === "/semestres"
      ? path === "/semestres" || path === "/"
      : path === href || path.startsWith(href + "/");

  const anyMoreActive = MORE_ITEMS.some(item => isActive(item.href));

  return (
    <>
      {/* ── More sheet overlay ── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40, mass: 0.8 }}
              className="fixed left-0 right-0 z-50 lg:hidden rounded-t-2xl overflow-hidden"
              style={{
                bottom: 0,
                background: "var(--nav-bg)",
                borderTop: "1px solid var(--border)",
                paddingBottom: "max(24px, env(safe-area-inset-bottom))",
              }}
            >
              {/* Handle — Staromłyński style */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full" style={{ background: "var(--border-strong)" }} />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-4">
                <p className="text-[15px] font-medium" style={{ color: "var(--text)" }}>Tout</p>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 active:scale-95"
                  style={{
                    background: "var(--surface-alt)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              {/* Grid — neutral, no color accents */}
              <div className="px-4 grid grid-cols-4 gap-2">
                {MORE_ITEMS.map(item => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl transition-all active:scale-95"
                      style={{
                        background: active ? "var(--surface-active)" : "var(--surface-alt)",
                        border: `1px solid ${active ? "var(--border-strong)" : "var(--border)"}`,
                      }}
                    >
                      <Icon
                        className="w-5 h-5"
                        strokeWidth={1.5}
                        style={{ color: active ? "var(--text)" : "var(--text-muted)" }}
                      />
                      <span
                        className="text-[10px] font-medium text-center leading-tight"
                        style={{ color: active ? "var(--text)" : "var(--text-disabled)" }}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Bottom tab bar — Staromłyński: clean, neutral, no color ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 lg:hidden"
        style={{
          background: "var(--nav-bg)",
          borderTop: "1px solid var(--nav-border)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-stretch h-14">
          {PRIMARY_TABS.map(tab => {
            const Icon = tab.icon;

            if (tab.isMore) {
              const active = anyMoreActive || moreOpen;
              return (
                <button
                  key="more"
                  onClick={() => setMoreOpen(v => !v)}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95"
                  style={{ color: active ? "var(--text)" : "var(--nav-text)" }}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                  <span className="text-[9px] font-medium">{tab.label}</span>
                </button>
              );
            }

            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 relative"
                style={{ color: active ? "var(--text)" : "var(--nav-text)" }}
              >
                {/* Active indicator — thin top line, neutral white (Staromłyński style) */}
                {active && (
                  <motion.div
                    layoutId="bottom-nav-dot"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                    style={{ background: "var(--text)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon
                  className={cn("w-5 h-5", active && "scale-110")}
                  strokeWidth={1.5}
                  style={{ transition: "transform 0.15s" }}
                />
                <span className="text-[9px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
