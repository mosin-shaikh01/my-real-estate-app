import type { NotificationProvider } from '../notification-types.js'
import { makeStubProvider } from '../notification-provider.js'

// Push — not implemented. Wire FCM / APNs / Web Push here.
export const pushProvider: NotificationProvider = makeStubProvider('push')
