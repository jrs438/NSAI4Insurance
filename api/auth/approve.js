import { verifyToken } from '../../lib/auth.js';
import { addApproved } from '../../lib/allowlist.js';
import { sendMagicLink } from '../../lib/email.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function page(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${title} · NSAI for Insurance</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter+Tight:wght@400;500&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F4EFE6;color:#0F1419;font-family:'Inter Tight',system-ui,sans-serif;padding:24px;}
  .box{max-width:520px;background:#ECE5D6;border:1px solid rgba(28,37,48,0.14);border-radius:10px;padding:38px 34px;}
  .eyebrow{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B6458;display:flex;align-items:center;margin-bottom:16px;}
  .eyebrow::before{content:'';width:24px;height:2px;background:#B8442E;margin-right:11px;}
  h1{font-family:'Fraunces',serif;font-weight:400;font-size:30px;line-height:1.1;letter-spacing:-0.02em;margin:0 0 12px;}
  p{font-size:15px;line-height:1.6;color:#2A3340;margin:0 0 12px;}
  .diag{font-family:'JetBrains Mono',monospace;font-size:12px;color:#6B6458;background:#F4EFE6;border:1px solid rgba(28,37,48,0.10);border-radius:4px;padding:10px 12px;margin-top:14px;word-break:break-word;line-height:1.5;}
</style></head>
<body><div class="box">
  <div class="eyebrow">NSAI for Insurance</div>
  ${bodyHtml}
</div></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const token = req.query && req.query.token;
  const payload = token ? await verifyToken(String(token)) : null;

  if (!payload || payload.purpose !== 'approve' || !payload.sub) {
    res.statusCode = 400;
    res.end(page('Link expired', '<h1>Link expired</h1><p>This approval link is invalid or has expired. Ask them to request access again.</p>'));
    return;
  }

  const email = String(payload.sub);
  const base = process.env.APP_URL || `https://${req.headers.host}`;

  // Split the two failure paths so we can tell you WHICH thing broke, and
  // log the actual error message to Vercel Functions logs for diagnosis.

  // 1. Datastore write — needs Upstash Redis (KV_REST_API_* or UPSTASH_REDIS_REST_*).
  try {
    await addApproved(email);
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    console.error('[approve] addApproved failed:', msg);
    res.statusCode = 500;
    res.end(page('Datastore error', `
      <h1>Datastore write failed</h1>
      <p>Couldn&rsquo;t save <strong>${escapeHtml(email)}</strong> to the approved list. The datastore (Upstash Redis) is either missing, misconfigured, or unreachable.</p>
      <p>Check the Vercel Functions logs for the exact error. Try the link again after fixing.</p>
      <div class="diag">error: ${escapeHtml(msg)}</div>
    `));
    return;
  }

  // 2. Email delivery — needs Resend + a verified sender.
  try {
    await sendMagicLink(email, '/', base);
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    console.error('[approve] sendMagicLink failed:', msg);
    res.statusCode = 500;
    res.end(page('Email delivery error', `
      <h1>Approved &mdash; but the email didn&rsquo;t send</h1>
      <p><strong>${escapeHtml(email)}</strong> has been added to the approved list, but the sign-in link email failed. You can ask them to visit the site and request a new link themselves (it will now work), or fix the email issue and click Approve again to resend.</p>
      <div class="diag">error: ${escapeHtml(msg)}</div>
    `));
    return;
  }

  res.statusCode = 200;
  res.end(page('Approved', `<h1>Approved.</h1><p><strong>${escapeHtml(email)}</strong> has been added, and we&rsquo;ve emailed them a sign-in link.</p>`));
}
