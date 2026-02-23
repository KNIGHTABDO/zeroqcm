"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, ShieldCheck,
  LogOut, Menu, X, ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "aabidaabdessamad@gmail.com";

const NAV = [
  { href: "/admin",             label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { href: "/admin/activations", label: "Activations",    icon: ShieldCheck },
  { href: "/admin/users",       label: "Utilisateurs",   icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router  = useRouter();
  const path    = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || !user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#080808" }}>
        <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
      </div>
    );
  }

  const isActive = (item: typeof NAV[0]) =>
    item.exact ? path === item.href : path.startsWith(item.href);

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "white" }}>
            <span className="text-black font-black text-sm leading-none">Z</span>
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>ZeroQCM</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-2.5 h-2.5" style={{ color: "rgba(255,255,255,0.3)" }} />
              <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-2.5 space-y-0.5 pt-3">
        {NAV.map((item) => {
          const active = isActive(item);
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative overflow-hidden"
              style={{
                background: active ? "rgba(255,255,255,0.07)" : "transparent",
                color:      active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.38)",
              }}>
              {active && (
                <motion.div layoutId="admin-nav-indicator"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                  transition={{ type: "spring", damping: 30, stiffness: 500 }} />
              )}
              <item.icon className="w-4 h-4 flex-shrink-0 relative z-10" />
              <span className="relative z-10">{item.label}</span>
              {active && (
                <span className="ml-auto w-1 h-1 rounded-full relative z-10 flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.5)" }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2.5 border-t space-y-0.5" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <Link href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: "rgba(255,255,255,0.3)" }}>
          <ArrowLeft className="w-4 h-4" />
          Retour à l&apos;app
        </Link>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.push("/auth"); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
          style={{ color: "rgba(239,68,68,0.6)" }}>
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ background: "#080808", color: "rgba(255,255,255,0.9)" }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 fixed left-0 top-0 h-screen border-r z-50"
        style={{ background: "#0c0c0c", borderColor: "rgba(255,255,255,0.07)" }}>
        {SidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b"
        style={{ background: "#0c0c0c", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg -ml-1.5"
            style={{ color: "rgba(255,255,255,0.5)" }}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "white" }}>
              <span className="text-black font-black text-xs">Z</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <ShieldCheck className="w-3 h-3" style={{ color: "rgba(255,255,255,0.4)" }} />
          <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
            Admin
          </span>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.75)" }}
              onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: -224 }} animate={{ x: 0 }} exit={{ x: -224 }}
              transition={{ type: "spring", damping: 28, stiffness: 380 }}
              className="fixed left-0 top-0 h-screen w-56 z-50 border-r"
              style={{ background: "#0c0c0c", borderColor: "rgba(255,255,255,0.07)" }}>
              <button onClick={() => setOpen(false)}
                className="absolute top-4 right-3 p-1.5 rounded-lg"
                style={{ color: "rgba(255,255,255,0.35)" }}>
                <X className="w-4 h-4" />
              </button>
              {SidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 min-w-0 lg:ml-56 pt-14 lg:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}