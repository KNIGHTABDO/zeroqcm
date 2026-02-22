"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, BarChart2, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", icon: Home, label: "Accueil" },
  { href: "/semestres/s1_fmpc", icon: BookOpen, label: "S1" },
  { href: "/stats", icon: BarChart2, label: "Stats" },
  { href: "/profil", icon: User, label: "Profil" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-white/[0.06] bg-black/80 backdrop-blur-xl z-40 lg:hidden">
      <div className="flex items-center justify-around py-2 max-w-md mx-auto">
        {TABS.map((tab) => {
          const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-all",
                active ? "text-white" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
