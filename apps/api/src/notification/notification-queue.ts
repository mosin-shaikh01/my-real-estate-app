import type { ProviderResult } from './notification-types.js'

// ============================================================================
// Dispatcher — the queue seam
// ============================================================================
// The service never calls a provider directly; it hands the send to a Dispatcher.
// Today that's InlineDispatcher (run it now, in-process). Tomorrow a
// BullMQDispatcher / RabbitMQ dispatcher can enqueue the job and a worker calls
// the same provider — no change to the service, providers, or business logic.
// That is the whole reason send logic is not coupled to the HTTP request.
// ============================================================================

export interface Dispatcher {
  dispatch(run: () => Promise<ProviderResult>): Promise<ProviderResult>
}

/** Sends synchronously in the current process. The default. */
export class InlineDispatcher implements Dispatcher {
  dispatch(run: () => Promise<ProviderResult>): Promise<ProviderResult> {
    return run()
  }
}
