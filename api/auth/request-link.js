import { Resend } from 'resend';
import { createMagicToken, safeNext } from '../../lib/auth.js';

// How long the emailed sign-in link stays valid.
const LINK_TTL_MINUTES = 24 * 60; // 24 hours

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
    const token = await createMagicToken(email, next, LINK_TTL_MINUTES);
    const base = process.env.APP_URL || `https://${req.headers.host}`;
    const link = `${base}/api/auth/verify?token=${encodeURIComponent(token)}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: 'Your sign-in link · NSAI for Insurance',
      text:
        'NSAI for Insurance — sign-in link\n\n' +
        'Use the link below to sign in to the private NSAI for Insurance site. ' +
        'It is valid for 24 hours.\n\n' +
        link +
        "\n\nIf you didn't request this, you can ignore this email.",
      html: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ece7dc;margin:0;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;max-width:520px;background:#1c2530;border-radius:10px;">
      <tr><td style="padding:42px 42px 38px;">
        <div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:3px;color:#c8a951;text-transform:uppercase;margin-bottom:18px;">NSAI &middot; for Insurance</div>
        <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:28px;line-height:1.2;color:#f4efe6;">Your sign-in link</h1>
        <p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:rgba(244,239,230,0.72);">Use the button below to sign in to the private NSAI for Insurance site. This link is valid for <strong style="color:#f4efe6;">24 hours</strong>.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-radius:6px;background:#c8a951;">
            <a href="${link}" style="display:inline-block;padding:15px 32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1.5px;color:#1c2530;text-decoration:none;text-transform:uppercase;">Sign in &rarr;</a>
          </td>
        </tr></table>
        <p style="margin:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:rgba(244,239,230,0.5);">Or paste this URL into your browser:<br><a href="${link}" style="color:#c8a951;word-break:break-all;">${link}</a></p>
        <div style="height:1px;line-height:1px;font-size:1px;background:rgba(244,239,230,0.14);margin:30px 0;">&nbsp;</div>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:rgba(244,239,230,0.45);">If you didn't request this, you can safely ignore this email &mdash; the site can't be accessed without signing in.</p>
      </td></tr>
    </table>
    <div style="font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:2px;color:#9a9486;margin-top:18px;">NSAI4INSURANCE.COM</div>
  </td></tr>
</table>`,
    });
  } catch (e) {
    // Don't leak whether sending failed for a valid address.
    res.status(200).json(generic);
    return;
  }

  res.status(200).json(generic);
}
