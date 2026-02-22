"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/supabase";

type AuthCtxType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, faculty?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthCtx = createContext<AuthCtxType>({} as AuthCtxType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data);
  }

  async function signUp(email: string, password: string, name: string, faculty: string = "FMPC") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // Trigger creates the profile — but also upsert here in case trigger is slow
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: name,
        username: email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase(),
        faculty,
        annee_etude: 1,
        preferences: { theme: "dark", ai_model: "gemini-2.0-flash", ai_key: null, notifications: true, language: "fr" },
      }, { onConflict: "id" });
      await loadProfile(data.user.id);
    }
    return { error: null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  return (
    <AuthCtx.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
