"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Bookmark, Trophy, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", icon: Home, label: "Accueil" },
  { href: "/semestres", icon: BookOpen, label: "Semestres" },
  { href: "/chatwithai", icon: Sparkles, label: "AI Chat", accent: true },
  { href: "/bookmarks", icon: Bookmark, label: "Favoris" },
  { href: "/profil", icon: User, label: "Profil" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t z-50"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-around px-1 py-1.5 safe-pb">
        {NAV.map((item) => {
          const active = path === item.href || (item.href !== "/" && path.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[52px] min-h-[48px] justify-center relative",
                active ? "opacity-100" : "opacity-50 hover:opacity-75"
              )}
              style={active ? { background: "var(--nav-item-active)" } : {}}>
              <item.icon className="w-5 h-5"
                style={{ color: active && item.accent ? "var(--accent)" : active ? "var(--text)" : "var(--text-secondary)" }} />
              <span className="text-[10px] font-medium"
                style={{ color: active && item.accent ? "var(--accent)" : active ? "var(--text)" : "var(--text-secondary)" }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
