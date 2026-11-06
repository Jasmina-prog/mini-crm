import { useCallback, useEffect, useState, type DependencyList } from 'react'
import { errorMessage } from './errors'

interface AsyncState<T> {
  data: T | undefined
  error: string | undefined
  loading: boolean
}

/** Минимальная загрузка данных: data / error / loading + reload(). */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: undefined, loading: true })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: undefined }))
    fn().then(
      (data) => !cancelled && setState({ data, error: undefined, loading: false }),
      (e) => !cancelled && setState({ data: undefined, error: errorMessage(e), loading: false }),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
