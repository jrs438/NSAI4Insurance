import { timingSafeEqual } from 'node:crypto';
import { createSession, sessionCookie } from '../../lib/auth.js';

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const passcode = String((body && body.passcode) || '');
  const expected = process.env.ACCESS_PASSCODE || '';

  if (expected.length === 0 || !safeEqual(passcode, expected)) {
    res.status(401).json({ ok: false });
    return;
  }

  const session = await createSession('passcode', 30);
  res.setHeader('Set-Cookie', sessionCookie(session, 30));
  res.status(200).json({ ok: true });
}
