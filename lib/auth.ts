// ── Auth inti — password hashing + session token ────────────────────────────
// Sengaja pakai WebCrypto (crypto.subtle) murni, TANPA dependensi baru:
// jalan identik di Node runtime (route handlers, seed via tsx) dan Edge
// (middleware.ts). Password: PBKDF2-SHA256. Session: payload JSON + HMAC-SHA256,
// disimpan sebagai cookie HTTP-only.

export const SESSION_COOKIE = "amerta_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 jam (satu shift kerja lebih)

const PBKDF2_ITERS = 120_000;
const enc = new TextEncoder();

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    // Jangan diam-diam insecure di production.
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET belum di-set");
    return "amerta-dev-secret";
  }
  return s;
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// ── Password (PBKDF2) ───────────────────────────────────────────────────────

async function deriveBits(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256
  );
}

/** Format simpan: `pbkdf2$<iterasi>$<salt b64url>$<hash b64url>` */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(password, salt, PBKDF2_ITERS);
  return `pbkdf2$${PBKDF2_ITERS}$${b64url(salt)}$${b64url(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, itersStr, saltStr, hashStr] = stored.split("$");
  if (scheme !== "pbkdf2") return false;
  const iters = Number(itersStr);
  if (!Number.isFinite(iters) || iters < 1) return false;
  const got = new Uint8Array(await deriveBits(password, b64urlDecode(saltStr), iters));
  const want = b64urlDecode(hashStr);
  if (got.length !== want.length) return false;
  let diff = 0; // perbandingan waktu-konstan
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

// ── Session token (HMAC-SHA256) ─────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

async function hmacKey() {
  return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const payload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = b64url(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body)));
  return `${body}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      b64urlDecode(sig) as BufferSource,
      enc.encode(body)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (!payload.id || !payload.email) return null;
    return { id: payload.id, email: payload.email, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}
