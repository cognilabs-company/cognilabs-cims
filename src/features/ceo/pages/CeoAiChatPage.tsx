import { Suspense, lazy } from 'react'
import { CimsAiProvider } from '../context/CimsAiContext'
import { AsyncContentLoader } from '../../../shared/ui/async-content-loader'

const CimsAiWorkspace = lazy(async () => {
  const module = await import('../components/CimsAiWorkspace')

  return {
    default: module.CimsAiWorkspace,
  }
})

export function CeoAiChatPage() {
  return (
    <CimsAiProvider>
      <Suspense fallback={<AsyncContentLoader variant="page" />}>
        <CimsAiWorkspace mode="page" />
      </Suspense>
    </CimsAiProvider>
  )
}
