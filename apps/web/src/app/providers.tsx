import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { ThemeProvider } from './theme-provider'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A CRM's data is shared and changes under you. 30s is long enough to
      // avoid refetch storms while tabbing, short enough that an admin's edit
      // shows up before anyone notices it hasn't.
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Never retry an auth/permission failure -- it will never succeed, and
        // retrying just delays the redirect.
        const status = (error as { status?: number })?.status
        if (status === 401 || status === 403 || status === 404) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: true,
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    // Query wraps Theme: the theme preference is now server state (the ['me']
    // query is its source of truth), so ThemeProvider must sit inside the
    // QueryClientProvider to read and persist it.
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
