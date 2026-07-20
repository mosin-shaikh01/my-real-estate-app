import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { ThemeProvider } from '@/app/theme-provider'
import { ToastProvider } from '@/components/ui/Toast'

// ONE place that wraps a component tree in the app's context providers for
// tests, mirroring app/providers.tsx (Query → Theme → Toast). Any component
// that reaches useToast/useTheme/useQuery renders here without a missing-
// provider throw — the exact regression that let a logout toast added to the
// Topbar white-screen the whole shell test. New tests should render through
// here rather than assembling providers by hand.

export function createTestQueryClient() {
  return new QueryClient({
    // Tests assert on states, not retries/GC — make both deterministic.
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

export function withProviders(ui: ReactNode, qc: QueryClient = createTestQueryClient()) {
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <ToastProvider>{ui}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

/** render() with every app provider in place. Pass a seeded QueryClient to
 *  prime caches (e.g. qc.setQueryData(['me'], …)). */
export function renderWithProviders(ui: ReactElement, qc?: QueryClient) {
  const client = qc ?? createTestQueryClient()
  return { queryClient: client, ...render(withProviders(ui, client)) }
}
