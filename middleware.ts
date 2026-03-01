// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * ZeroQCM — Next.js Middleware (unified)
 *
 * Protects auth-required routes by checking the Supabase session server-side.
 * If the user is not authenticated, they are redirected to /auth.
 * If the user is not admin and tries to access /admin, they get a 404.
 *
 * Public routes (no auth needed):
 *   /                — landing page
 *   /auth            — login / signup
 *   /api/...         — API routes (each route handles its own auth)
 *   /_next/...       — Next.js internals
 *   /favicon.ico
 *   /og              — Open Graph images
 *
 * Protected routes (redirect to /auth if not logged in):
 *   /dashboard, /chatwithai, /quiz, /modules, /semestres,
 *   /flashcards, /bookmarks, /revision, /stats, /profil,
 *   /settings, /leaderboard, /certificates, /study-rooms, /voice,
 *   /activate
 *
 * Admin routes: /admin/* — must be logged in AND have admin email
 */

const ADMIN_EMAIL = "aabidaabdessamad@gmail.com";
const PUBLIC_PATHS = new Set(["/", "/auth"]);
const PUBLIC_PREFIXES = ["/api/", "/_next/", "/favicon", "/og", "/images/", "/icons/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow all public paths immediately
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Set up Supabase client with proper cookie forwarding
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in → redirect to /auth
  if (!user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes: require admin email
  if (pathname.startsWith("/admin")) {
    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.rewrite(new URL("/not-found", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (Next.js static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - /api routes (they handle their own auth)
     * - / and /auth (public)
     */
    "/((?!_next/static|_next/image|favicon\.ico|api/|auth|$).*)",
  ],
};
