// Allow-list = the static ALLOWED_EMAILS env var (seed list) PLUS any emails
// approved at runtime, stored in Upstash Redis. Used by the Node functions only
// (the Edge middleware just checks the session cookie).
import { Redis } from '@upstash/redis';

let _redis;
function redis() {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  _redis = url && token ? new Redis({ url, token }) : null;
  return _redis;
}

const APPROVED_KEY = 'approved_emails';

function staticList() {
  return (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function isAllowed(email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  if (staticList().includes(e)) return true;
  const r = redis();
  if (!r) return false;
  try {
    return (await r.sismember(APPROVED_KEY, e)) === 1;
  } catch {
    return false;
  }
}

export async function addApproved(email) {
  const e = normalizeEmail(email);
  if (!e) return;
  const r = redis();
  if (!r) throw new Error('No datastore configured (set UPSTASH_REDIS_REST_URL/TOKEN).');
  await r.sadd(APPROVED_KEY, e);
}

// Returns true the first time we should notify the admin about a given email
// within the dedupe window, so a flood of attempts on one address only pings once.
export async function shouldNotify(email, windowSeconds = 86400) {
  const e = normalizeEmail(email);
  if (!e) return false;
  const r = redis();
  if (!r) return true; // no store -> always notify
  try {
    const res = await r.set('pending:' + e, '1', { ex: windowSeconds, nx: true });
    return res !== null && res !== undefined;
  } catch {
    return true;
  }
}
