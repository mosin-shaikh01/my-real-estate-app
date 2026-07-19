import type { NotificationChannel } from '@app/shared'
import type { NotificationProvider, OutboundMessage, ProviderResult } from './notification-types.js'

// Shared helpers for providers. A provider is any object with a `channel` and a
// `send()`; these keep the not-yet-implemented channels honest and uniform.

export function notImplemented(channel: NotificationChannel): ProviderResult {
  return {
    status: 'not_implemented',
    provider: null,
    error: `The ${channel} channel is not implemented yet`,
    retryCount: 0,
  }
}

/** Base for the "coming soon" channels: correct shape, honest result. */
export function makeStubProvider(channel: NotificationChannel): NotificationProvider {
  return {
    channel,
    implemented: false,
    async send(_message: OutboundMessage): Promise<ProviderResult> {
      return notImplemented(channel)
    },
  }
}
