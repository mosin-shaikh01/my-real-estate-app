import type { NotificationData, ResolvedBranding, NotificationRecipient } from '../notification-types.js'

// Placeholder rendering. `{{ name }}` -> escaped value, missing -> ''. Values are
// HTML-escaped so a client/user name can never inject markup into an email.

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => escapeHtml(vars[key] ?? ''))
}

/**
 * The variable map a template sees: branding first, then recipient basics, then
 * the caller's data (which wins). Everything is coerced to a string; escaping
 * happens at substitution time.
 */
export function buildVars(
  branding: ResolvedBranding,
  recipient: NotificationRecipient,
  data: NotificationData | undefined,
): Record<string, string> {
  const vars: Record<string, string> = {
    company_name: branding.companyName,
    company_logo: branding.companyLogo,
    support_email: branding.supportEmail,
    company_website: branding.companyWebsite,
    company_address: branding.companyAddress,
    primary_color: branding.primaryColor,
    secondary_color: branding.secondaryColor,
    current_year: branding.currentYear,
    user_name: recipient.name ?? '',
  }
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && v !== null) vars[k] = String(v)
    }
  }
  return vars
}

/** A minimal HTML->text alternative for the multipart email. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}
