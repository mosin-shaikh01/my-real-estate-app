import type { NotificationProvider } from '../notification-types.js'
import { makeStubProvider } from '../notification-provider.js'

// WhatsApp — not implemented. Wire the WhatsApp Business / Cloud API here.
export const whatsappProvider: NotificationProvider = makeStubProvider('whatsapp')
