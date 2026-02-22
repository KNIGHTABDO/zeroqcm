"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, BarChart2, User, Settings, Stethoscope, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "../auth/AuthProvider";

const NAV = [
  { href: "/", icon: Home, label: "Tableau de bord" },
  { href: "/semestres/s1_fmpc", icon: BookOpen, label: "S1 FMPC" },
  { href: "/stats", icon: BarChart2, label: "Statistiques" },
  { href: "/profil", icon: User, label: "Profil" },
  { href: "/settings", icon: Settings, label: "Paramètres" },
];

export function Sidebar() {
  const path = usePathname();
  const { theme, toggle } = useTheme();
  const { user, profile } = useAuth();

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-60 border-r z-50 transition-colors"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-6 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Stethoscope className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>FMPC QCM</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Médecine · Casablanca</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = path === item.href || (item.href !== "/" && path.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active ? "bg-white/[0.08] text-white" : "hover:bg-white/[0.04]"
              )}
              style={{ color: active ? "var(--text)" : "var(--text-secondary)" }}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
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
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                {user.email}
              </p>
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
