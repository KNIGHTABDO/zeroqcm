"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

interface RequireAuthProps {
  children: React.ReactNode;
  /** Where to redirect after login. Defaults to current path. */
  redirectTo?: string;
}

/**
 * #31 Shared auth gate — wraps any page that requires authentication.
 * Shows a loading spinner during the auth check (eliminates FOUC),
 * then redirects to /auth if the user is not signed in.
 */
export function RequireAuth({ children, redirectTo }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const dest = redirectTo ?? (typeof window !== "undefined" ? window.location.pathname : "/");
      router.replace(`/auth?redirect=${encodeURIComponent(dest)}`);
    }
  }, [user, loading, router, redirectTo]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <Loader2
          className="w-6 h-6 animate-spin"
          style={{ color: "var(--text-muted)" }}
        />
      </div>
    );
  }

  if (!user) {
    // Returning null while redirect is pending — no flash of content
    return null;
  }

  return <>{children}</>;
}
