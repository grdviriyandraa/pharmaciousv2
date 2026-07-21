import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Gerbang rute (Edge). Halaman app butuh session; /login & / dialihkan sesuai
// status. Catatan offline: halaman yang sudah di-cache service worker tetap
// terbuka tanpa menyentuh middleware — itu memang perilaku PWA yang diinginkan
// (app shell offline), data sensitif tetap di API yang tidak di-cache.

const PROTECTED = ["/dashboard", "/inspection", "/batches", "/suppliers"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const user = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && (isProtected || pathname === "/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (isProtected) url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/inspection/:path*", "/batches/:path*", "/suppliers/:path*"],
};
