import type { NotificationProvider } from '../notification-types.js'
import { makeStubProvider } from '../notification-provider.js'

// SMS — not implemented. Wire a Twilio/Vonage/MSG91 transport here and register
// it in notification/index.ts; nothing else in the app changes.
export const smsProvider: NotificationProvider = makeStubProvider('sms')
