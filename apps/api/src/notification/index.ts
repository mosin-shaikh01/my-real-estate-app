import { prismaNotificationStore } from '../services/notification-data-service.js'
import { NotificationService } from './notification-service.js'
import { emailProvider } from './providers/email-provider.js'
import { inAppProvider } from './providers/inapp-provider.js'
import { pushProvider } from './providers/push-provider.js'
import { smsProvider } from './providers/sms-provider.js'
import { webhookProvider } from './providers/webhook-provider.js'
import { whatsappProvider } from './providers/whatsapp-provider.js'

// ============================================================================
// The wired-up NotificationService — import THIS everywhere.
// ============================================================================
// Composition root: the Prisma store + every channel provider. Email is real;
// the rest are honest stubs. Registering a new channel is a one-line change here
// plus its provider file — no business-logic module ever changes.
//
//   import { notificationService } from '../notification/index.js'
//   await notificationService.send({ channel: 'email', template: 'forgot-password',
//                                    recipient: user, data: { reset_link } })
// ============================================================================

export const notificationService = new NotificationService(prismaNotificationStore, [
  emailProvider,
  smsProvider,
  whatsappProvider,
  pushProvider,
  inAppProvider,
  webhookProvider,
])

export { NotificationService } from './notification-service.js'
export type * from './notification-types.js'
