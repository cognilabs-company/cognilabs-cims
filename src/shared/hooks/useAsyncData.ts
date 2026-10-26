import { useEffect, useState, type DependencyList } from 'react'

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

type UseAsyncDataOptions<T> = {
  enabled?: boolean
  initialData?: T
  onSuccess?: (data: T) => void
  onError?: (error: unknown) => void
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  dependencies: DependencyList,
  options?: UseAsyncDataOptions<T>,
) {
  const [data, setData] = useState<T | undefined>(options?.initialData)
  const [error, setError] = useState<unknown>(null)
  const [status, setStatus] = useState<AsyncStatus>(options?.initialData !== undefined ? 'success' : 'idle')

  useEffect(() => {
    if (options?.enabled === false) {
      return
    }

    let isActive = true

    async function run() {
      setStatus((current) => (current === 'success' && options?.initialData !== undefined ? current : 'loading'))
      setError(null)

      try {
        const result = await fetcher()

        if (!isActive) {
          return
        }

        setData(result)
        setStatus('success')
        options?.onSuccess?.(result)
      } catch (nextError) {
        if (!isActive) {
          return
        }

        setError(nextError)
        setStatus('error')
        options?.onError?.(nextError)
      }
    }

    void run()

    return () => {
      isActive = false
    }
    // The caller controls rerun semantics through the provided dependencies array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  async function refetch() {
    setStatus('loading')
    setError(null)

    try {
      const result = await fetcher()
      setData(result)
      setStatus('success')
      options?.onSuccess?.(result)

      return result
    } catch (nextError) {
      setError(nextError)
      setStatus('error')
      options?.onError?.(nextError)
      throw nextError
    }
  }

  return {
    data,
    error,
    status,
    isIdle: status === 'idle',
    isLoading: status === 'loading',
    isError: status === 'error',
    isSuccess: status === 'success',
    refetch,
    setData,
  }
}
