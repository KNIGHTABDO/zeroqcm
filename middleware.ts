// TEMPORARY STUB — Vercel dxb1 incident (Mar 2 2026)
// Real middleware backed up below, restore once Vercel resolves the incident.
// See: https://www.vercel-status.com/
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// Empty matcher = no routes matched = middleware not invoked
export const config = {
  matcher: [],
};
