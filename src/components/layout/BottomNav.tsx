"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, BarChart2, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", icon: Home, label: "Accueil" },
  { href: "/semestres/s1_fmpc", icon: BookOpen, label: "S1" },
  { href: "/stats", icon: BarChart2, label: "Stats" },
  { href: "/settings", icon: Settings, label: "Paramètres" },
  { href: "/profil", icon: User, label: "Profil" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t z-40 lg:hidden pb-safe"
      style={{ background: "rgba(0,0,0,0.85)", borderColor: "var(--border)", backdropFilter: "blur(20px)" }}>
      <div className="flex items-center justify-around py-2 max-w-md mx-auto">
        {TABS.map((tab) => {
          const active = path === tab.href || (tab.href !== "/" && path.startsWith(tab.href));
          return (
            <Link key={tab.href} href={tab.href}
              className={cn("flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all",
                active ? "text-white" : "text-zinc-600")}>
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
