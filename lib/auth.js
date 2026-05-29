// Shared auth helpers. Pure Web APIs + jose, so this works in both the
// Edge middleware and the Node serverless functions.
import { SignJWT, jwtVerify } from 'jose';

const encoder = new TextEncoder();

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET is not set');
  return encoder.encode(s);
}

export const SESSION_COOKIE = 'nsai_session';

// Long-lived session issued after a successful login.
export async function createSession(subject, days = 30) {
  return await new SignJWT({ sub: subject })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secretKey());
}

// Short-lived token embedded in the emailed magic link.
export async function createMagicToken(email, next, minutes = 24 * 60) {
  return await new SignJWT({ sub: email, purpose: 'magic', next: next || '/' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${minutes}m`)
    .sign(secretKey());
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(/; */)) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1));
  }
  return null;
}

export function sessionCookie(value, days = 30) {
  const maxAge = days * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Only allow same-origin relative redirects, never an absolute/protocol URL.
export function safeNext(next) {
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/';
}
