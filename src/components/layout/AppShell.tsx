"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

// Full-screen pages that should hide navigation
const FULLSCREEN_ROUTES = ["/quiz/"];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_ROUTES.some((r) => pathname.startsWith(r));

  if (isFullscreen) {
    return <>{children}</>;
  }

  return (
    <div className="flex">
      {/* Sidebar — visible only on lg+ */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 lg:ml-60 min-h-screen">
        {children}
        {/* Bottom nav — hidden on lg */}
        <BottomNav />
      </div>
    </div>
  );
}
