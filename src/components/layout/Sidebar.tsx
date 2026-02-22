"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, BarChart2, User, Settings, Stethoscope, Sun, Moon, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "../auth/AuthProvider";

const FACULTIES = [
  { id: "s1_fmpc", label: "S1 FMPC", questions: 10697 },
  { id: "s1_fmpr", label: "S1 FMPR", questions: 10495 },
  { id: "s1_fmpm", label: "S1 FMPM", questions: 8461 },
  { id: "s1_um6", label: "S1 UM6SS", questions: 7188 },
  { id: "s1_fmpdf", label: "S1 FMPDF", questions: 7144 },
];

const NAV = [
  { href: "/", icon: Home, label: "Tableau de bord" },
  { href: "/stats", icon: BarChart2, label: "Statistiques" },
  { href: "/profil", icon: User, label: "Profil" },
  { href: "/settings", icon: Settings, label: "Paramètres" },
];

export function Sidebar() {
  const path = usePathname();
  const { theme, toggle } = useTheme();
  const { user, profile } = useAuth();
  const [semOpen, setSemOpen] = useState(true);

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r z-50 transition-colors overflow-y-auto"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Stethoscope className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>FMPC QCM</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>43 985 questions · 5 facultés</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV.map((item) => {
          const active = path === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]")}
              style={{ color: active ? "var(--text)" : "var(--text-secondary)" }}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* Semesters section */}
        <div className="pt-2">
          <button onClick={() => setSemOpen(!semOpen)}
            className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all hover:bg-white/[0.04]"
            style={{ color: "var(--text-muted)" }}>
            <span>Semestres</span>
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", semOpen && "rotate-180")} />
          </button>
          {semOpen && (
            <div className="mt-1 space-y-0.5">
              {FACULTIES.map((f) => {
                const href = `/semestres/${f.id}`;
                const active = path.startsWith(href);
                return (
                  <Link key={f.id} href={href}
                    className={cn("flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all",
                      active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]")}
                    style={{ color: active ? "var(--text)" : "var(--text-secondary)" }}>
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="font-medium">{f.label}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {(f.questions/1000).toFixed(0)}k
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="px-4 py-3 border-t space-y-2 flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <button onClick={toggle}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm transition-all hover:bg-white/[0.04]"
          style={{ color: "var(--text-secondary)" }}>
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Mode clair" : "Mode sombre"}
        </button>
        {user ? (
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-blue-400">
                {(profile?.full_name ?? user.email ?? "?")[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>
                {profile?.full_name ?? user.email?.split("@")[0]}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{user.email}</p>
            </div>
          </div>
        ) : (
          <Link href="/auth"
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-400 text-white transition-all">
            Se connecter
          </Link>
        )}
      </div>
    </aside>
  );
}
