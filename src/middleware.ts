import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// =============================================================================
// MIDDLEWARE
// =============================================================================

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get token from cookies
  const token = request.cookies.get("token")?.value;

  // Public routes that don't require authentication
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy");

  // Skip static assets
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".");

  if (isStaticAsset) {
    return NextResponse.next();
  }

  // If not authenticated and not on public route, redirect to sign-in
  if (!token && !isPublicRoute) {
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // If authenticated and on sign-in page, redirect to select-company
  if (token && pathname.includes("/sign-in")) {
    return NextResponse.redirect(
      new URL("/dashboard/select-company", request.url)
    );
  }

  return NextResponse.next();
}

// =============================================================================
// MATCHER
// =============================================================================

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};