import type { NotificationProvider } from '../notification-types.js'
import { makeStubProvider } from '../notification-provider.js'

// Webhook — not implemented. A real version would POST the payload to a
// configured URL (with an HMAC signature) for Slack/Teams/custom integrations.
export const webhookProvider: NotificationProvider = makeStubProvider('webhook')
