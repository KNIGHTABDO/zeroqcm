"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, BarChart2, User, Settings, Sun, Moon, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "@/lib/supabase";

type Semester = { semestre_id: string; nom: string; faculty: string; total_questions: number };

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
  const [semesters, setSemesters] = useState<Semester[]>([]);

  useEffect(() => {
    supabase
      .from("semesters")
      .select("semestre_id, nom, faculty, total_questions")
      .order("faculty")
      .then(({ data }) => setSemesters(data ?? []));
  }, []);

  // Filter semesters by user's annee_etude
  const YEAR_TO_SEM: Record<number, string> = { 1: "S1", 2: "S3", 3: "S5", 4: "S7", 5: "S9" };
  const userSemKey = profile?.annee_etude ? (YEAR_TO_SEM[profile.annee_etude] ?? null) : null;
  const visibleSemesters = userSemKey
    ? semesters.filter((s) => {
        const id = s.semestre_id.toUpperCase();
        const semNum = userSemKey.replace("S","");
        return id.startsWith(userSemKey) || id === ("S" + semNum + "_FMPM") || id === ("S" + semNum + "_FMPR") || id === ("S" + semNum + "_UM6") || id === ("S" + semNum + "_FMPDF");
      })
    : semesters;

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r z-50 transition-colors overflow-y-auto"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* ── Brand header ── */}
      <div className="px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          {/* Logo: ZeroQCM wordmark — no stethoscope, no "FMPC S1-S7" */}
          <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="ZeroQCM" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight" style={{ color: "var(--text)" }}>ZeroQCM</p>
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
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", semOpen ? "" : "-rotate-90")} />
          </button>

          {semOpen && (
            <div className="mt-1 space-y-0.5">
              {semesters.length === 0
                ? [1,2,3,4,5].map(i => (
                    <div key={i} className="h-9 mx-1 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
                  ))
                : visibleSemesters.map((sem) => {
                    const href = `/semestres/${encodeURIComponent(sem.semestre_id)}`;
                    const active = path === href || path.startsWith(href + "/");
                    return (
                      <Link key={sem.semestre_id} href={href}
                        className={cn("flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all",
                          active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]")}
                        style={{ color: active ? "var(--text)" : "var(--text-secondary)" }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{sem.nom}</span>
                        </div>
                        <span className="text-[10px] flex-shrink-0 ml-1" style={{ color: "var(--text-muted)" }}>
                          {(sem.total_questions ?? 0).toLocaleString()}
                        </span>
                      </Link>
                    );
                  })}
            </div>
          )}
        </div>
      </nav>

      {/* User + theme toggle */}
      <div className="px-3 py-3 border-t space-y-1 flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <button onClick={toggle}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.04]"
          style={{ color: "var(--text-secondary)" }}>
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Mode clair" : "Mode sombre"}
        </button>
        {user && (
          <Link href="/profil"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all hover:bg-white/[0.04]"
            style={{ color: "var(--text-secondary)" }}>
            <div className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold" style={{ color: "var(--text)" }}>
                {(profile?.full_name ?? user.email ?? "?")[0].toUpperCase()}
              </span>
            </div>
            <span className="truncate text-xs">{profile?.full_name ?? user.email}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
