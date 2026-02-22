"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

const FULLSCREEN = ["/quiz/", "/auth"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isFullscreen = FULLSCREEN.some((r) => path.startsWith(r));
  if (isFullscreen) return <>{children}</>;
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <Sidebar />
      <div className="flex-1 min-w-0 overflow-x-hidden lg:ml-60">
        {children}
        <BottomNav />
      </div>
    </div>
  );
}
