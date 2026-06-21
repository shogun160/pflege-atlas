const PETROL = '#1f5e6d';

// Minimaler HTML-Escape für user-controlled Strings, die in Template-Bodies
// interpoliert werden (displayName, invitedBy, articleTitle, reviewer …).
// Schließt URL-Werte mit ein — defense-in-depth gegen Quote-Injection in
// `href`-Attributen.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function htmlLayout(args: { title: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(args.title)}</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:Georgia,serif;color:#1a1a1a;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#faf7f2;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:8px;padding:32px;">
        <tr><td>
          <div style="font-size:24px;font-weight:700;color:${PETROL};letter-spacing:-0.01em;">Pflege&middot;Atlas</div>
        </td></tr>
        <tr><td style="padding-top:24px;font-size:16px;line-height:1.6;">${args.bodyHtml}</td></tr>
        <tr><td style="padding-top:32px;border-top:1px solid #eee;font-size:13px;color:#666;line-height:1.5;">
          Diese Mail kommt vom PflegeAtlas (pflegeatlas.org).
          <br>Wenn du das nicht erwartet hast, kannst du sie ignorieren.
          <br><a href="https://pflegeatlas.org/datenschutz" style="color:${PETROL};">Datenschutz</a>
          &middot; <a href="https://pflegeatlas.org/impressum" style="color:${PETROL};">Impressum</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function textLayout(args: { bodyText: string }): string {
  return `Pflege·Atlas

${args.bodyText}

---
Diese Mail kommt vom PflegeAtlas (pflegeatlas.org).
Wenn du das nicht erwartet hast, kannst du sie ignorieren.
Datenschutz: https://pflegeatlas.org/datenschutz
Impressum: https://pflegeatlas.org/impressum`;
}
