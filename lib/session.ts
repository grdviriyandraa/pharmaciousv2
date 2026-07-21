// Helper sisi-server (server components / route handlers) — JANGAN diimport
// dari middleware (next/headers tidak tersedia di sana; middleware pakai
// verifySessionToken langsung dari lib/auth).
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "./auth";

export async function getSessionUser(): Promise<SessionUser | null> {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}
