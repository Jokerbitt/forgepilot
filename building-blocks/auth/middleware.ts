// middleware.ts — Next.js middleware that protects app routes using NextAuth v5.
// Dest: src/middleware.ts

import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Protect /dashboard and /app subtrees. Exclude the NextAuth API,
  // Next internals and static assets.
  matcher: [
    "/dashboard/:path*",
    "/app/:path*",
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
