import { verifyToken, createSession, sessionCookie, safeNext } from '../../lib/auth.js';

export default async function handler(req, res) {
  const token = req.query && req.query.token;
  const payload = token ? await verifyToken(String(token)) : null;

  if (!payload || payload.purpose !== 'magic' || !payload.sub) {
    res.statusCode = 302;
    res.setHeader('Location', '/login.html?error=link');
    res.end();
    return;
  }

  const session = await createSession(payload.sub, 30);
  res.setHeader('Set-Cookie', sessionCookie(session, 30));
  res.statusCode = 302;
  res.setHeader('Location', safeNext(payload.next));
  res.end();
}
