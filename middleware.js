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
    pathname === '/robots.txt' ||
    // Publicly-shareable pages. Remove entries here to put a page back behind
    // the login gate. Page-level <meta name="robots" content="noindex"> keeps
    // them out of search results.
    pathname === '/ai-economics.html' ||
    // Hebrew review prototypes for the Israel team — remove to re-gate.
    pathname === '/index.he.html' ||
    pathname === '/pc-deepdive.he.html'
  );
}

export default async function middleware(request) {
  const url = new URL(request.url);
  if (isPublic(url.pathname)) return next();

  const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE);
  if (token) {
    const payload = await verifyToken(token);
    // Accept sub (this site's payload) OR email (lloyds' payload) — SSO across
    // *.nsai4insurance.com works when both sides sign with the same AUTH_SECRET.
    if (payload && (payload.sub || payload.email)) return next();
  }

  const loginUrl = new URL('/login.html', url.origin);
  const dest = url.pathname + url.search;
  if (dest && dest !== '/') loginUrl.searchParams.set('next', dest);
  return Response.redirect(loginUrl, 302);
}
