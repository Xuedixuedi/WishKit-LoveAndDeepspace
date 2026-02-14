'use client'

import * as React from 'react'

export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), Math.max(0, delayMs))
    return () => window.clearTimeout(t)
  }, [delayMs, value])

  return debounced
}

