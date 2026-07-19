import type { NotificationTemplateKey } from '@app/shared'

// Built-in default templates. They are the SEED source and the runtime fallback:
// if an admin hasn't customised a template (or the row is missing), the service
// renders these. Bodies use {{placeholders}} and are wrapped in the branded
// layout at send time — so they intentionally contain no header/footer chrome.

export interface DefaultTemplate {
  name: string
  subject: string
  bodyHtml: string
}

const button = (label: string, urlVar: string) =>
  `<p style="margin:24px 0;"><a href="{{${urlVar}}}" style="display:inline-block;padding:11px 22px;background:{{primary_color}};color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;">${label}</a></p>`

export const DEFAULT_TEMPLATES: Record<NotificationTemplateKey, DefaultTemplate> = {
  welcome: {
    name: 'Welcome Email',
    subject: 'Welcome to {{company_name}}',
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:20px;">Welcome, {{user_name}} 👋</h1>
<p>Your {{company_name}} account is ready. We're glad to have you on board.</p>
${button('Get started', 'action_url')}
<p>If you have any questions, reach us at {{support_email}}.</p>`,
  },
  'forgot-password': {
    name: 'Forgot Password',
    subject: 'Reset your {{company_name}} password',
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:20px;">Reset your password</h1>
<p>Hi {{user_name}}, we received a request to reset the password for your {{company_name}} account.</p>
${button('Reset password', 'reset_link')}
<p style="color:#6b7280;font-size:13px;">This link is valid for 30 minutes and can be used once. If you didn't request it, you can safely ignore this email.</p>`,
  },
  'password-reset': {
    name: 'Password Reset Confirmation',
    subject: 'Your {{company_name}} password was changed',
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:20px;">Password changed</h1>
<p>Hi {{user_name}}, your {{company_name}} password was just changed and you've been signed out of all devices.</p>
<p>If this wasn't you, contact us immediately at {{support_email}}.</p>`,
  },
  'user-invitation': {
    name: 'User Invitation',
    subject: "You've been invited to {{company_name}}",
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:20px;">You're invited</h1>
<p>{{user_name}}, you've been invited to join {{company_name}}. Accept the invitation to set up your account.</p>
${button('Accept invitation', 'action_url')}`,
  },
  'property-assignment': {
    name: 'Property Assignment',
    subject: 'A property was assigned to you',
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:20px;">New property assignment</h1>
<p>Hi {{agent_name}}, the property <strong>{{property_name}}</strong> has been assigned to you.</p>
${button('View property', 'action_url')}`,
  },
  'client-assignment': {
    name: 'Client Assignment',
    subject: 'A client was assigned to you',
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:20px;">New client assignment</h1>
<p>Hi {{agent_name}}, the client <strong>{{client_name}}</strong> has been assigned to you.</p>
${button('View client', 'action_url')}`,
  },
  'appointment-reminder': {
    name: 'Appointment Reminder',
    subject: 'Reminder: upcoming appointment',
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:20px;">Appointment reminder</h1>
<p>Hi {{user_name}}, this is a reminder about your upcoming appointment with {{client_name}}.</p>`,
  },
  'daily-report': {
    name: 'Daily Report',
    subject: 'Your daily report — {{company_name}}',
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:20px;">Daily report</h1>
<p>Hi {{user_name}}, here is your activity summary for today.</p>`,
  },
  'weekly-report': {
    name: 'Weekly Report',
    subject: 'Your weekly report — {{company_name}}',
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:20px;">Weekly report</h1>
<p>Hi {{user_name}}, here is your activity summary for this week.</p>`,
  },
  'monthly-report': {
    name: 'Monthly Report',
    subject: 'Your monthly report — {{company_name}}',
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:20px;">Monthly report</h1>
<p>Hi {{user_name}}, here is your activity summary for this month.</p>`,
  },
  'general-notification': {
    name: 'General Notification',
    subject: '{{company_name}} notification',
    bodyHtml: `<p>Hi {{user_name}},</p>
<p>{{message}}</p>`,
  },
}
