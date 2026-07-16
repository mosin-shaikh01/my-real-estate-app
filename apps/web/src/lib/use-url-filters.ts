import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

// ============================================================================
// Filters live in the URL. Not in a store.
// ============================================================================
// An admin who has filtered to "Pune, 2BHK, under ₹80L" must be able to send
// that link to a colleague and have them see the same screen. A store makes
// that impossible, breaks the back button, and loses state on reload — and you
// end up rebuilding this anyway, later, under pressure.
//
// Third usage is what earned this the extraction (clients, properties, and
// requirements next). Two would have been a coincidence.
// ============================================================================

export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()

  const filters = useMemo(() => {
    const out: Partial<Record<K, string>> = {}
    for (const k of keys) {
      const v = params.get(k)
      if (v) out[k] = v
    }
    return out
  }, [params, keys])

  const setFilter = useCallback(
    (key: K, value: string | undefined) => {
      const next = new URLSearchParams(params)
      if (value) next.set(key, value)
      else next.delete(key)
      // Any filter change resets pagination, or you land on an empty page 3 of
      // a 1-page result and think the search is broken.
      if (key !== ('page' as K)) next.delete('page')
      // replace: filtering shouldn't stack twenty history entries that the back
      // button then has to chew through one keystroke at a time.
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const clearAll = useCallback(() => setParams(new URLSearchParams()), [setParams])

  const activeCount = keys.filter((k) => k !== ('page' as K) && params.get(k)).length

  return { filters, setFilter, clearAll, activeCount }
}
