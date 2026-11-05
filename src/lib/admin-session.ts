/**
 * Sessão de administrador assinada (HMAC-SHA256), compatível com Edge (middleware) e Node.
 * O cookie deixa de ser um texto fixo forjável: precisa ser emitido pelo servidor.
 *
 * Segredo: AUTH_SESSION_SECRET (recomendado). Se ausente, usa SUPABASE_SERVICE_ROLE_KEY.
 */
export const ADMIN_COOKIE = "barbearia_admin_session";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

function secret(): string {
  return process.env.AUTH_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

export async function createAdminSessionToken(): Promise<string> {
  const payload = `admin.${Date.now()}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyAdminSessionToken(token?: string | null): Promise<boolean> {
  if (!token || !secret()) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "admin") return false;
  const issuedAt = Number(parts[1]);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > MAX_AGE_MS) return false;
  const expected = await hmac(`${parts[0]}.${parts[1]}`);
  const given = parts[2];
  if (expected.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
