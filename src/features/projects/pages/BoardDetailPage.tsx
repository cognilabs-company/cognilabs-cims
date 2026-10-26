import { useMemo } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { StateBlock } from '../../../shared/ui/state-block'
import { BoardWorkspace } from '../components/BoardWorkspace'

function parseProjectId(rawValue: string | null) {
  if (!rawValue) {
    return null
  }

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function BoardDetailPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const [searchParams] = useSearchParams()

  const id = Number(boardId)
  const projectId = useMemo(() => parseProjectId(searchParams.get('project')), [searchParams])

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <StateBlock
        tone="error"
        eyebrow="Error"
        title="Invalid board"
        description="The requested board could not be opened."
      />
    )
  }

  if (projectId !== null) {
    const nextSearchParams = new URLSearchParams()
    nextSearchParams.set('board', String(id))

    const selectedCardId = searchParams.get('card')
    if (selectedCardId) {
      nextSearchParams.set('card', selectedCardId)
    }

    return <Navigate to={`/projects/${projectId}?${nextSearchParams.toString()}`} replace />
  }

  return <BoardWorkspace boardId={id} projectId={projectId} mode="fullscreen" />
}
