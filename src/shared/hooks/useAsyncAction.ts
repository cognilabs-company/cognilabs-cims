import { useState } from 'react'

export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
) {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function run(...args: TArgs) {
    setIsRunning(true)
    setError(null)

    try {
      return await action(...args)
    } catch (nextError) {
      setError(nextError)
      throw nextError
    } finally {
      setIsRunning(false)
    }
  }

  return {
    run,
    isRunning,
    error,
  }
}
