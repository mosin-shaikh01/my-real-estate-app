import type { ResolvedBranding } from '../notification-types.js'
import { escapeHtml } from '../utils/render.js'

// The branded shell wrapped around every email body. Table-based and inline-
// styled because that is what email clients actually render. Branding (logo,
// name, colour, footer) is injected from CRM Settings, so every message is
// on-brand without the template author repeating it.

export function wrapWithBranding(innerHtml: string, b: ResolvedBranding): string {
  const primary = b.primaryColor || '#4f46e5'
  const secondary = b.secondaryColor || '#6366f1'
  const header = b.companyLogo
    ? `<img src="${escapeHtml(b.companyLogo)}" alt="${escapeHtml(b.companyName)}" height="36" style="height:36px;max-height:36px;" />`
    : `<span style="font-size:20px;font-weight:700;color:#ffffff;">${escapeHtml(b.companyName)}</span>`

  const footerBits = [
    b.companyAddress,
    b.companyWebsite ? `<a href="${escapeHtml(b.companyWebsite)}" style="color:${primary};text-decoration:none;">${escapeHtml(b.companyWebsite)}</a>` : '',
    b.supportEmail ? `<a href="mailto:${escapeHtml(b.supportEmail)}" style="color:${primary};text-decoration:none;">${escapeHtml(b.supportEmail)}</a>` : '',
  ].filter(Boolean)

  const footerCustom = b.footer ? `<p style="margin:0 0 8px;">${escapeHtml(b.footer)}</p>` : ''

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr><td style="height:4px;background:${secondary};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="background:${primary};padding:20px 28px;">${header}</td></tr>
          <tr><td style="padding:28px;color:#1f2937;font-size:15px;line-height:1.6;">
            ${innerHtml}
          </td></tr>
          <tr><td style="padding:20px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:1.6;">
            ${footerCustom}
            ${footerBits.length ? `<p style="margin:0 0 8px;">${footerBits.join(' &middot; ')}</p>` : ''}
            <p style="margin:0;">&copy; ${escapeHtml(b.currentYear)} ${escapeHtml(b.companyName)}. All rights reserved.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}
