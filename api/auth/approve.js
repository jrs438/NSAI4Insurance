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
  .box{max-width:460px;background:#ECE5D6;border:1px solid rgba(28,37,48,0.14);border-radius:10px;padding:38px 34px;}
  .eyebrow{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B6458;display:flex;align-items:center;margin-bottom:16px;}
  .eyebrow::before{content:'';width:24px;height:2px;background:#B8442E;margin-right:11px;}
  h1{font-family:'Fraunces',serif;font-weight:400;font-size:30px;line-height:1.1;letter-spacing:-0.02em;margin:0 0 12px;}
  p{font-size:15px;line-height:1.6;color:#2A3340;margin:0;}
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
  try {
    await addApproved(email);
    await sendMagicLink(email, '/', base);
  } catch (e) {
    res.statusCode = 500;
    res.end(page('Something went wrong', `<h1>Couldn&rsquo;t finish</h1><p>Approval failed &mdash; check that the datastore (Upstash Redis) is configured in Vercel, then try the link again.</p>`));
    return;
  }

  res.statusCode = 200;
  res.end(page('Approved', `<h1>Approved.</h1><p><strong>${escapeHtml(email)}</strong> has been added, and we&rsquo;ve emailed them a sign-in link.</p>`));
}
