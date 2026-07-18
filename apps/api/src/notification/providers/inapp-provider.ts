import type { NotificationProvider } from '../notification-types.js'
import { makeStubProvider } from '../notification-provider.js'

// In-App — not implemented. A real version would persist a Notification row per
// user and expose it through a bell/inbox in the SPA.
export const inAppProvider: NotificationProvider = makeStubProvider('in_app')
