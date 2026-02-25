import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

const ADMIN_EMAIL = "aabidaabdessamad@gmail.com";

// All client-side pages — auth is handled via useAuth() hook on the client.
// Middleware only gates /admin (server-side admin check).
// Everything else passes through freely.
const BYPASS_PATHS = [
  "/", "/auth", "/activate", "/api", "/_next",
  "/favicon", "/icon", "/apple", "/site", "/images", "/logo",
  "/semestres", "/quiz", "/stats", "/settings",
  "/chatwithai", "/bookmarks", "/revision",
  "/profil",
];

function isBypass(pathname: string): boolean {
  return BYPASS_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + ".")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only /admin/* routes need server-side auth gating
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Admin gate: verify session from cookie
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) = {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return NextResponse.rewrite(new URL("/not-found", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
