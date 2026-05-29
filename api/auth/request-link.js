import { safeNext } from '../../lib/auth.js';
import { isAllowed, shouldNotify, normalizeEmail } from '../../lib/allowlist.js';
import { sendMagicLink, sendApprovalRequest } from '../../lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const email = normalizeEmail(body && body.email);
  const next = safeNext(body && body.next);

  // Same response either way, so the allow-list can't be probed.
  const generic = { ok: true, message: 'If that address is approved, a sign-in link is on its way.' };
  if (!email) {
    res.status(200).json(generic);
    return;
  }

  const base = process.env.APP_URL || `https://${req.headers.host}`;
  try {
    if (await isAllowed(email)) {
      await sendMagicLink(email, next, base);
    } else if (await shouldNotify(email)) {
      await sendApprovalRequest(email, base);
    }
  } catch (e) {
    // Swallow errors so we never reveal whether the address exists / was sent.
  }

  res.status(200).json(generic);
}
