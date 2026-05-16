// Middleware: gates every page request behind install + license state.
//
// Edge runtime can't access Prisma directly, so this middleware does
// allow-listing only. It calls a Node API route (/api/_internal/gate) to
// learn the current state, then redirects accordingly.
//
// The /api/_internal/gate endpoint caches its response with Cache-Control
// to keep this from hammering Prisma on every page view.
import { NextResponse } from "next/server";

// Paths that should NEVER be gated. Even when not installed / license dead,
// these have to remain reachable so the user can fix things.
const ALLOWLIST = [
  "/install",
  "/licensed-expired",
  "/api/install",            // install wizard endpoints
  "/api/license-status",     // recheck endpoint
  "/api/_internal/gate",     // the gate-state endpoint itself
  "/api/auth/logout",        // let people sign out even when locked
  "/_next",
  "/favicon.ico",
];

function isAllowlisted(pathname) {
  return ALLOWLIST.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (isAllowlisted(pathname)) {
    return NextResponse.next();
  }

  // Ask the Node-runtime gate API for current state.
  // Build an absolute URL since fetch from Edge needs one.
  const gateUrl = new URL("/api/_internal/gate", req.url);
  let gate;
  try {
    const r = await fetch(gateUrl, {
      headers: { "x-gate-internal": "1" },
      // Don't cache aggressively at the fetch level — the API sets its own
      // Cache-Control, and Next will respect it for subsequent middleware
      // hits within the same request.
    });
    gate = await r.json();
  } catch {
    // If the gate API itself is down, fail-open (don't lock everyone out due
    // to a deploy issue). The license check is meant to stop honest people
    // not paying — not to be a security barrier.
    return NextResponse.next();
  }

  if (!gate.installed) {
    return NextResponse.redirect(new URL("/install", req.url));
  }
  if (gate.locked) {
    return NextResponse.redirect(new URL("/licensed-expired", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on every page request, skipping static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
