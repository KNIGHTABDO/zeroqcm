import { NextResponse } from "next/server";
// Telegram integration removed — approvals now handled via /admin dashboard.
export async function POST() { return NextResponse.json({ ok: true }); }