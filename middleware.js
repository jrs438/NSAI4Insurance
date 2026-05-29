// Vercel Edge Middleware: gates the whole site behind a valid session cookie.
// Public paths: the login page and the auth API. Everything else redirects to /login.
import { next } from '@vercel/edge';
import { SESSION_COOKIE, readCookie, verifyToken } from './lib/auth.js';

export const config = {
  // Run on everything except Vercel internals and the favicon.
  matcher: ['/((?!_next|_vercel|favicon.ico).*)'],
};

function isPublic(pathname) {
  return (
    pathname === '/login.html' ||
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/robots.txt'
  );
}

export default async function middleware(request) {
  const url = new URL(request.url);
  if (isPublic(url.pathname)) return next();

  const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE);
  if (token) {
    const payload = await verifyToken(token);
    if (payload && payload.sub) return next();
  }

  const loginUrl = new URL('/login.html', url.origin);
  const dest = url.pathname + url.search;
  if (dest && dest !== '/') loginUrl.searchParams.set('next', dest);
  return Response.redirect(loginUrl, 302);
}
