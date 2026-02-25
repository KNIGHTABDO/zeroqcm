"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, BookOpen, Sparkles, Trophy, Grid3x3,
  BarChart2, Bookmark, Users2, Layers, Mic, Award, User, Settings, X
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Always-visible bottom bar items ──────────────────────────────────────────
const PRIMARY_NAV = [
  { href: "/",           icon: Home,     label: "Accueil"   },
  { href: "/semestres",  icon: BookOpen, label: "Semestres" },
  { href: "/chatwithai", icon: Sparkles, label: "AI Chat", accent: true },
  { href: "/leaderboard",icon: Trophy,   label: "Classement" },
];

// ── Items inside the "More" drawer ───────────────────────────────────────────
const MORE_NAV = [
  { href: "/study-rooms",  icon: Users2,   label: "Salles d'étude" },
  { href: "/flashcards",   icon: Layers,   label: "Flashcards"    },
  { href: "/voice",        icon: Mic,      label: "Mode vocal"    },
  { href: "/certificates", icon: Award,    label: "Certificats"   },
  { href: "/stats",        icon: BarChart2,label: "Statistiques"  },
  { href: "/bookmarks",    icon: Bookmark, label: "Favoris"       },
  { href: "/profil",       icon: User,     label: "Profil"        },
  { href: "/settings",     icon: Settings, label: "Paramètres"    },
];

export function BottomNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [path]);

  // Is any "More" item active?
  const moreActive = MORE_NAV.some(
    (i) => path === i.href || (i.href !== "/" && path.startsWith(i.href))
  );

  return (
    <>
      {/* ── Fixed bottom bar ───────────────────────────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 border-t z-50"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-around px-1 py-1.5 safe-pb">
          {PRIMARY_NAV.map((item) => {
            const active =
              path === item.href ||
              (item.href !== "/" && path.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[52px] min-h-[48px] justify-center"
                )}
                style={active ? { background: "var(--nav-item-active)" } : {}}
              >
                <item.icon
                  className="w-5 h-5"
                  style={{
                    color:
                      active && (item as {accent?:boolean}).accent
                        ? "var(--accent)"
                        : active
                        ? "var(--text)"
                        : "var(--text-secondary)",
                    opacity: active ? 1 : 0.5,
                  }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color:
                      active && (item as {accent?:boolean}).accent
                        ? "var(--accent)"
                        : active
                        ? "var(--text)"
                        : "var(--text-secondary)",
                    opacity: active ? 1 : 0.5,
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[52px] min-h-[48px] justify-center"
            )}
            style={open || moreActive ? { background: "var(--nav-item-active)" } : {}}
          >
            {open ? (
              <X className="w-5 h-5" style={{ color: "var(--text)", opacity: 1 }} />
            ) : (
              <Grid3x3
                className="w-5 h-5"
                style={{ color: moreActive ? "var(--text)" : "var(--text-secondary)", opacity: moreActive ? 1 : 0.5 }}
              />
            )}
            <span
              className="text-[10px] font-medium"
              style={{
                color: open || moreActive ? "var(--text)" : "var(--text-secondary)",
                opacity: open || moreActive ? 1 : 0.5,
              }}
            >
              Plus
            </span>
          </button>
        </div>
      </nav>

      {/* ── More drawer ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="lg:hidden fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
              onClick={() => setOpen(false)}
            />

            {/* Drawer panel */}
            <motion.div
              key="drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="lg:hidden fixed bottom-[64px] left-0 right-0 z-50 rounded-t-2xl border-t border-x overflow-hidden"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="px-4 pt-4 pb-3">
                <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: "var(--text-muted)" }}>
                  Plus d'options
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {MORE_NAV.map((item) => {
                    const active =
                      path === item.href ||
                      (item.href !== "/" && path.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-all"
                        style={{
                          background: active ? "var(--nav-item-active)" : "rgba(255,255,255,0.03)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <item.icon
                          className="w-5 h-5"
                          style={{ color: active ? "var(--text)" : "var(--text-secondary)" }}
                        />
                        <span
                          className="text-[10px] font-medium text-center leading-tight"
                          style={{ color: active ? "var(--text)" : "var(--text-secondary)" }}
                        >
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
