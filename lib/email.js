import { Resend } from 'resend';
import { createMagicToken, createApproveToken } from './auth.js';

const LINK_TTL_MINUTES = 7 * 24 * 60; // sign-in link valid 7 days

function resend() {
  return new Resend(process.env.RESEND_API_KEY);
}
function fromAddress() {
  return process.env.FROM_EMAIL;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ---- shared shell ----
function card(innerHtml, footer = 'NSAI4INSURANCE.COM') {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ece7dc;margin:0;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;max-width:520px;background:#1c2530;border-radius:10px;">
      <tr><td style="padding:42px 42px 38px;">${innerHtml}</td></tr>
    </table>
    <div style="font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:2px;color:#9a9486;margin-top:18px;">${footer}</div>
  </td></tr>
</table>`;
}
function button(href, label) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
  <td style="border-radius:6px;background:#c8a951;">
    <a href="${href}" style="display:inline-block;padding:15px 32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1.5px;color:#1c2530;text-decoration:none;text-transform:uppercase;">${label}</a>
  </td>
</tr></table>`;
}

export async function sendMagicLink(email, next, base) {
  const token = await createMagicToken(email, next, LINK_TTL_MINUTES);
  const link = `${base}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const inner = `
    <div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:3px;color:#c8a951;text-transform:uppercase;margin-bottom:18px;">NSAI &middot; for Insurance</div>
    <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:28px;line-height:1.2;color:#f4efe6;">Your sign-in link</h1>
    <p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:rgba(244,239,230,0.72);">Use the button below to sign in to the private NSAI for Insurance site. This link is valid for <strong style="color:#f4efe6;">7 days</strong>.</p>
    ${button(link, 'Sign in &rarr;')}
    <p style="margin:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:rgba(244,239,230,0.5);">Or paste this URL into your browser:<br><a href="${link}" style="color:#c8a951;word-break:break-all;">${link}</a></p>
    <div style="height:1px;line-height:1px;font-size:1px;background:rgba(244,239,230,0.14);margin:30px 0;">&nbsp;</div>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:rgba(244,239,230,0.45);">If you didn't request this, you can safely ignore this email &mdash; the site can't be accessed without signing in.</p>`;
  await resend().emails.send({
    from: fromAddress(),
    to: email,
    subject: 'Your sign-in link · NSAI for Insurance',
    text:
      'NSAI for Insurance — sign-in link\n\n' +
      'Use the link below to sign in to the private NSAI for Insurance site. It is valid for 7 days.\n\n' +
      link +
      "\n\nIf you didn't request this, you can ignore this email.",
    html: card(inner),
  });
}

export async function sendApprovalRequest(email, base) {
  const admin = process.env.ADMIN_EMAIL;
  if (!admin) return;
  const token = await createApproveToken(email, 7);
  const approveLink = `${base}/api/auth/approve?token=${encodeURIComponent(token)}`;
  const safe = escapeHtml(email);
  const inner = `
    <div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:3px;color:#c8a951;text-transform:uppercase;margin-bottom:18px;">Access request</div>
    <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;line-height:1.2;color:#f4efe6;">Someone wants in</h1>
    <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:rgba(244,239,230,0.72);">This address requested access to the private NSAI for Insurance site:</p>
    <p style="margin:0 0 26px;font-family:'Courier New',Courier,monospace;font-size:16px;color:#f4efe6;">${safe}</p>
    ${button(approveLink, 'Approve access &rarr;')}
    <p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:rgba(244,239,230,0.6);">Approving adds them to the allow-list and emails them a sign-in link automatically.</p>
    <div style="height:1px;line-height:1px;font-size:1px;background:rgba(244,239,230,0.14);margin:28px 0;">&nbsp;</div>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:rgba(244,239,230,0.45);">Don't recognize this address? Just ignore this email &mdash; nothing happens unless you approve.</p>`;
  await resend().emails.send({
    from: fromAddress(),
    to: admin,
    subject: `Access request: ${email}`,
    text:
      `${email} requested access to the NSAI for Insurance site.\n\n` +
      `Approve (adds them and emails their sign-in link):\n${approveLink}\n\n` +
      "If you don't recognize this address, ignore this email.",
    html: card(inner, 'NSAI4INSURANCE.COM · ADMIN'),
  });
}
