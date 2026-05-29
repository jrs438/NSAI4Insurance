import { clearCookie } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Set-Cookie', clearCookie());
  res.statusCode = 302;
  res.setHeader('Location', '/login.html');
  res.end();
}
