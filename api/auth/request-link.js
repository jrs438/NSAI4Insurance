import { Resend } from 'resend';
import { createMagicToken, safeNext } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const email = String((body && body.email) || '').trim().toLowerCase();
  const next = safeNext(body && body.next);

  // Always respond the same way so the allow-list can't be probed.
  const generic = { ok: true, message: 'If that address is approved, a sign-in link is on its way.' };

  const allowed = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!email || !allowed.includes(email)) {
    res.status(200).json(generic);
    return;
  }

  try {
    const token = await createMagicToken(email, next, 15);
    const base = process.env.APP_URL || `https://${req.headers.host}`;
    const link = `${base}/api/auth/verify?token=${encodeURIComponent(token)}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: 'Your sign-in link · NSAI for Insurance',
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1c2530;line-height:1.6;">
          <p>Use the link below to sign in to <strong>NSAI for Insurance</strong>. It is valid for 15 minutes and can be used once.</p>
          <p><a href="${link}" style="display:inline-block;background:#1c2530;color:#f4efe6;text-decoration:none;padding:12px 22px;border-radius:4px;">Sign in</a></p>
          <p style="color:#6b7280;font-size:13px;">If you didn't request this, you can ignore this email.</p>
        </div>`,
    });
  } catch (e) {
    // Don't leak whether sending failed for a valid address.
    res.status(200).json(generic);
    return;
  }

  res.status(200).json(generic);
}
