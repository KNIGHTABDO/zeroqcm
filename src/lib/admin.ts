// @ts-nocheck
/**
 * ZeroQCM — Shared admin verification helper
 *
 * Centralises the admin email list and server-side session check.
 * All admin-gated routes import from here — no more scattered email comparisons.
 *
 * Usage:
 *   import { verifyAdmin, isAdminEmail } from "@/lib/admin";
 *   if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

// ── Single source of truth for admin identities ───────────────────────────────
const ADMIN_EMAILS = new Set([
  "aabidaabdessamad@gmail.com",
  "knight007youtu@gmail.com",
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email);
}

/**
 * Server-side admin verification using session cookies.
 * Works in Next.js Route Handlers and Middleware.
 */
export async function verifyAdmin(req?: NextRequest): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );
    const { data: { user } } = await sb.auth.getUser();
    return isAdminEmail(user?.email);
  } catch {
    return false;
  }
}
