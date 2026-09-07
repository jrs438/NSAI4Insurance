// Vercel Cron target: writes + reads a heartbeat key on Upstash Redis so
// the free-tier database registers activity and doesn't get auto-archived
// after ~10 days idle. Runs daily via the schedule in vercel.json.
//
// Vercel Cron requests carry an Authorization header of `Bearer <CRON_SECRET>`
// when CRON_SECRET is set as an env var in the project. We validate that so
// nobody outside Vercel can trigger this endpoint. If CRON_SECRET isn't set,
// we allow the ping and log a warning (safer default — a keepalive that runs
// without auth is still just a Redis write, no data exposure).
import { Redis } from '@upstash/redis';

function redis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  // Auth check: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
  // when CRON_SECRET is defined in project env vars.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
  } else {
    console.warn('[keepalive] CRON_SECRET not set — endpoint is unauthenticated');
  }

  const r = redis();
  if (!r) {
    console.error('[keepalive] Upstash env vars not configured');
    res.status(500).json({ ok: false, error: 'no_datastore' });
    return;
  }

  const now = new Date().toISOString();
  try {
    // Write and read a small heartbeat key. Either op counts as activity;
    // doing both catches config or permission issues that would let one
    // succeed silently while the other fails.
    await r.set('heartbeat:last', now);
    const echo = await r.get('heartbeat:last');
    console.log(`[keepalive] ok · wrote=${now} · read=${echo}`);
    res.status(200).json({ ok: true, wrote: now, read: echo });
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    console.error('[keepalive] Redis operation failed:', msg);
    res.status(500).json({ ok: false, error: msg });
  }
}
