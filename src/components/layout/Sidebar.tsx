"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, BarChart2, User, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", icon: Home, label: "Tableau de bord" },
  { href: "/semestres/s1_fmpc", icon: BookOpen, label: "S1 FMPC" },
  { href: "/stats", icon: BarChart2, label: "Statistiques" },
  { href: "/profil", icon: User, label: "Profil" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-60 bg-[#0a0a0a] border-r border-white/[0.06] z-50">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Stethoscope className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">FMPC QCM</p>
            <p className="text-[10px] text-zinc-600">Médecine · Casablanca</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/[0.06]">
        <p className="text-[10px] text-zinc-700">S1 FMPC · 10,697 questions</p>
        <p className="text-[10px] text-zinc-800 mt-0.5">v0.1.0 · beta</p>
      </div>
    </aside>
  );
}
