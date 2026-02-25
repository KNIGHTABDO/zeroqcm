import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

const ADMIN_EMAIL   = "aabidaabdessamad@gmail.com";
const PUBLIC_PATHS  = ["/", "/auth", "/activate", "/api", "/_next", "/favicon", "/icon", "/apple", "/site", "/images", "/logo", "/semestres", "/quiz", "/stats", "/settings", "/chatwithai", "/bookmarks", "/revision"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + ".")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
          });
        },
      },
    }
  );

  // getSession() reads the JWT directly from cookies — no network round-trip,
  // no race condition, no false "user not found" when session is valid
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes: only ADMIN_EMAIL — everyone else sees 404
  if (pathname.startsWith("/admin")) {
    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.rewrite(new URL("/not-found", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};