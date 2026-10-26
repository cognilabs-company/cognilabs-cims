import { useRouteError } from 'react-router-dom'
import { StateBlock } from '../shared/ui/state-block'
import { CHUNK_RELOAD_KEY, isDynamicImportError } from './lib/chunkRecovery'

export function RouteErrorBoundary() {
  const error = useRouteError()
  const isChunkError = isDynamicImportError(error)
  const message = error instanceof Error ? error.message : 'Unexpected application error'

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <StateBlock
          tone="error"
          eyebrow={isChunkError ? 'App update' : 'Application error'}
          title={isChunkError ? 'The app was updated. Please reload this page.' : 'Something went wrong'}
          description={isChunkError
            ? 'A new frontend build was deployed and this page is still pointing to an old JS chunk.'
            : message}
          actionLabel="Reload page"
          onAction={() => {
            if (typeof window !== 'undefined') {
              window.sessionStorage.removeItem(CHUNK_RELOAD_KEY)
              window.location.reload()
            }
          }}
        />
      </div>
    </div>
  )
}
