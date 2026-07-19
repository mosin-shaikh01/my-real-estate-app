# Notification Service

The CRM's single communication layer. **Nothing in the app talks to SMTP (or any
provider) directly** — every feature sends through `NotificationService`, which
resolves a template, injects branding, dispatches to the channel's provider, and
logs the outcome. Email is fully implemented; other channels are wired as honest
stubs so new channels are additive, never a rewrite.

---

## Architecture

```
apps/api/src/
├── notification/                 ← the module (Prisma-free by design)
│   ├── index.ts                  composition root → exports `notificationService`
│   ├── notification-service.ts   orchestrator (template → render → dispatch → log)
│   ├── notification-types.ts     interfaces (Provider, Store, Message, Result…)
│   ├── notification-provider.ts  provider interface + stub factory
│   ├── notification-queue.ts     Dispatcher seam (InlineDispatcher today)
│   ├── providers/
│   │   ├── email-provider.ts     real SMTP via nodemailer (+ retry, timeout)
│   │   ├── sms-provider.ts        ┐
│   │   ├── whatsapp-provider.ts   │ stubs — return not_implemented
│   │   ├── push-provider.ts       │
│   │   ├── inapp-provider.ts      │
│   │   └── webhook-provider.ts    ┘
│   ├── templates/
│   │   ├── layout.ts             branded HTML shell wrapped around every email
│   │   └── default-templates.ts  built-in defaults (seed source + fallback)
│   └── utils/
│       ├── render.ts             {{placeholder}} substitution + HTML escaping
│       └── retry.ts              transient-failure retry helper
├── services/
│   └── notification-data-service.ts   Prisma-backed store + admin read/writes
├── lib/crypto.ts                 AES-256-GCM for secrets at rest
└── routes/notification-routes.ts /api/notifications (Super-Admin gated)
```

### Why the module is Prisma-free

The project rule is *Prisma only in `services/**`*. So the module depends on an
injected **`NotificationStore`** interface; the Prisma implementation
(`prismaNotificationStore`) lives in `services/notification-data-service.ts` and is
wired in at the composition root (`notification/index.ts`). This is clean
dependency injection: the service, providers, dispatcher, and store are all
swappable, which is what makes the module unit-testable with no DB.

### The send pipeline

```
notificationService.send({ channel, template, recipient, data })
  → resolve provider (registry)         not registered / stub → not_implemented
  → resolve template (DB, else default) missing → failed · disabled → skipped
  → resolve recipient address           none → failed
  → resolve branding (CRM Settings)
  → render subject + body (escape) → wrap in branded layout → derive text
  → Dispatcher.dispatch(() => provider.send(message, config))   ← queue seam
  → write NotificationLog (always)
  → return SendResult
```

---

## The API

```ts
import { notificationService } from '../notification/index.js'

await notificationService.send({
  channel: 'email',
  template: 'forgot-password',
  recipient: { email: user.email, name: user.fullName, userId: user.id },
  data: { reset_link: resetUrl },
})
```

`send()` never throws on a delivery failure — it returns a `SendResult`
(`status`, `provider`, `error`, `retryCount`, `previewUrl?`) and records a log
row. Business logic (e.g. forgot-password's always-200 response) is never coupled
to whether email succeeded.

---

## Providers

| Channel | Status | Notes |
|---|---|---|
| Email | ✅ Implemented | SMTP via nodemailer; retry + timeout; console fallback when unconfigured |
| SMS | ⬜ Stub | Wire Twilio/Vonage/MSG91 |
| WhatsApp | ⬜ Stub | WhatsApp Business / Cloud API |
| Push | ⬜ Stub | FCM / APNs / Web Push |
| In-App | ⬜ Stub | Persist a per-user notification + a bell/inbox |
| Webhook | ⬜ Stub | POST to a URL (HMAC-signed) — Slack/Teams/custom |

### Adding a new channel

1. Create `providers/<channel>-provider.ts` exporting a `NotificationProvider`
   with `implemented: true` and a real `send()`.
2. Register it in `notification/index.ts`.
3. If it needs config, add a channel row in `notification_provider_configs` and a
   `getXTransport()` on the store.

No business-logic module changes. That's the whole point.

---

## Email provider

- **Real SMTP** through `nodemailer`. `ssl` → implicit TLS (465), `tls` →
  STARTTLS (587), `none` → plaintext.
- **Transport lifecycle**: a **fresh, non-pooled** transporter is created per send
  and closed after. Deliberately **no pool, no keepAlive, no module-level cache** —
  see below.
- **Retry**: **one** retry for transient failures. Permanent ones (`EAUTH`,
  `EENVELOPE`, `EMESSAGE`) are never retried.
- **Timeouts**: connection 15s, greeting 10s, socket 20s, DNS 10s.
- **Instrumentation**: every send logs its stages as structured JSON —
  `dns.ok/fail` (with resolved IP), `send.start`, `transport.closed`, and
  `send.ok`/`send.fail` carrying the exact Node `code`, SMTP `command` (the failing
  stage: CONN/EHLO/STARTTLS/AUTH/MAIL FROM/DATA), `responseCode`, `response`,
  `errno`, `syscall`, and timing. `SMTP_DEBUG=1` adds the full protocol transcript.
- **`verifyEmailConnection(cfg)`** — an exported connect + greeting + STARTTLS +
  AUTH check (no message), fully staged-logged, for isolating connectivity/auth
  from message problems.
- **Console fallback**: when no transport is configured (or it's disabled), the
  message — including any action link — is logged as one JSON line and reported
  `sent` via provider `console`.
- **Preview URL**: Ethereal test accounts return a preview link, surfaced in the
  test-send result.

### Why no pooling / caching (production note)

For a low-volume CRM (occasional resets/notifications), a pooled or kept-alive
connection would sit **idle between sends, get reaped by the platform or mail
host, and go stale** — producing the classic "first send works, every subsequent
send times out" failure. Per-request non-pooled avoids that entirely: nothing is
shared between sends, so stale-socket reuse is architecturally impossible. Pooling
here would be a workaround that *reduces* reliability.

### "Works locally but times out on the server" (Render, etc.)

This is almost never the code — it's the **mail host rate-limiting/blocking SMTP
from the server's datacenter IP**. Notably, `smtp.hostinger.com` resolves to a
**Cloudflare** address, and Cloudflare/Hostinger throttle SMTP connections from
cloud IPs: the first connects, the rest time out at the **TCP connect** stage
(`code: ETIMEDOUT`, `command: CONN` in the logs). Residential/office IPs aren't
throttled, so it works from a laptop.

**Fix (not a workaround): use a transactional email provider on the server** —
SendGrid, Brevo, Amazon SES, Mailgun (all are presets). They're built to accept
connections from cloud IPs and don't throttle. Configure it in Settings →
Notifications on the deployed instance; the CRM code is unchanged. Keep Hostinger
SMTP for local/office use if you like. Turn on `SMTP_DEBUG=1` on the server to see
the exact failing stage and error code in the logs.

---

## SMTP setup

Configure from **Settings → Notifications → Email** (Super-Admin). Pick a provider
preset to auto-fill host/port/encryption (all overridable):

Gmail · Outlook · Microsoft 365 · Zoho · Hostinger · GoDaddy · cPanel · SendGrid ·
Brevo · Amazon SES · Mailgun · Custom SMTP.

- **Gmail**: needs a Google **App Password** (2-Step Verification on) as the
  password — your normal password won't work over SMTP.
- **SendGrid**: username is the literal `apikey`, password is the API key.
- Enter the fields, tick **Enabled**, **Save**, then **Send a test email**.

Credentials are stored **encrypted** (AES-256-GCM) and never returned by the API —
the config DTO only reports `hasPassword`. Leaving the password blank on save
keeps the stored one.

---

## Templates

DB-backed (`notification_templates`), editable at **Settings → Notifications →
Templates** with a subject field, an HTML editor, a **live preview** (rendered
with sample data + branding, in a sandboxed iframe), and click-to-insert
placeholders. If a template row is missing, the built-in default
(`templates/default-templates.ts`) is used — so the app always has something to
send.

Seeded templates: `welcome`, `forgot-password`, `password-reset`,
`user-invitation`, `property-assignment`, `client-assignment`,
`appointment-reminder`, `daily-report`, `weekly-report`, `monthly-report`,
`general-notification`.

### Placeholders

`{{company_name}}` `{{company_logo}}` `{{user_name}}` `{{agent_name}}`
`{{client_name}}` `{{property_name}}` `{{reset_link}}` `{{action_url}}`
`{{support_email}}` `{{company_website}}` `{{company_address}}` `{{current_year}}`
plus any key you pass in `data`. All values are **HTML-escaped** at substitution,
so a user/client name can never inject markup.

### Adding a template

Add the key to `NOTIFICATION_TEMPLATE_KEYS` + `TEMPLATE_LABELS`
(`packages/shared/src/notifications.ts`) and a default in `default-templates.ts`;
re-run the seed. It then appears in the manager.

---

## Branding

Pulled automatically from **CRM Settings** (company name, logo, primary colour,
website, address, support email) and wrapped around every email by
`templates/layout.ts`. Template authors never repeat branding — it's injected.
The logo is an absolute URL built from `APP_URL`/`WEB_ORIGIN` + the public
`/api/settings/logo` route.

---

## Logging

Every attempt writes a `notification_logs` row: channel, template, provider,
recipient, subject, status (`sent`/`failed`/`skipped`/`not_implemented`/`queued`),
error, retry count, and timestamps. View them at **Settings → Notifications →
Logs** (paginated, newest first).

---

## Future queue support

The service dispatches through a **`Dispatcher`** (`notification-queue.ts`), today
`InlineDispatcher` (send in-process). Because send logic isn't coupled to the HTTP
request, a `BullMQ`/`Redis`/`RabbitMQ` dispatcher can later enqueue the job and a
worker calls the same provider — no change to the service, providers, or callers.

---

## Security

- Provider credentials **encrypted at rest** (AES-256-GCM, `lib/crypto.ts`). The
  key derives from `APP_ENCRYPTION_KEY`, or `JWT_REFRESH_SECRET` when unset — so
  it works with zero extra config. Tampered ciphertext fails closed (decrypts to
  null → treated as "not set").
- Passwords are **never** returned in any API response.
- All `/api/notifications` routes require `notifications.view` (reads) or
  `notifications.manage` (writes/tests) — Super-Admin only. Test-sends are rate
  limited.

---

## Testing

- **Unit** (`apps/api/test/notification.test.ts`): rendering/escaping, branding
  injection, channel routing, disabled/skip and not-implemented paths, logging —
  with a fake store + fake providers, no DB, no SMTP.
- **Real SMTP** during development: use a **nodemailer Ethereal** test account
  (auto-created, no credentials) — configure it in Settings and the test-send
  returns a preview URL proving real delivery.

---

## Deployment

Nothing new is required. No new mandatory env var (encryption falls back to the
existing secret). `nodemailer` is a normal dependency. The admin configures SMTP
from Settings after deploy — no code changes. Works identically on Render,
Hostinger, Railway, Docker, a VPS, and other standard Node hosts. `APP_ENCRYPTION_KEY`
is optional (set it to rotate the encryption key independently of auth secrets).
