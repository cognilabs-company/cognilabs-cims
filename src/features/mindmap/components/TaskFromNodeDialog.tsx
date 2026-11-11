import { useEffect, useMemo, useState } from 'react'
import { ListChecksIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { projectsService, type BoardDetail, type BoardRecord, type ProjectRecord } from '../../../shared/api/services/projects.service'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Dialog } from '../../../shared/ui/dialog'
import { SelectField } from '../../../shared/ui/select-field'
import { buildFormData } from '../../projects/lib/formdata'
import { outline } from '../lib/tree'
import type { MindMap, MindNode, NodeTask } from '../lib/types'

type Props = {
  map: MindMap
  node: MindNode
  onClose: () => void
  onCreated: (task: NodeTask) => void
}

const LAST_TARGET_KEY = 'cims.mindmap.task-target'

function readLastTarget(): { projectId?: string; boardId?: string; columnId?: string } {
  try {
    return JSON.parse(localStorage.getItem(LAST_TARGET_KEY) ?? '{}') as { projectId?: string; boardId?: string; columnId?: string }
  } catch {
    return {}
  }
}

/** Turn a node into a project card: pick project → board → column; note, link and sub-nodes go to the description. */
export function TaskFromNodeDialog({ map, node, onClose, onCreated }: Props) {
  const { t } = useLocale()
  const last = useMemo(readLastTarget, [])
  const [projects, setProjects] = useState<ProjectRecord[] | null>(null)
  const [boards, setBoards] = useState<BoardRecord[] | null>(null)
  const [board, setBoard] = useState<BoardDetail | null>(null)
  const [projectId, setProjectId] = useState(last.projectId ?? '')
  const [boardId, setBoardId] = useState(last.boardId ?? '')
  const [columnId, setColumnId] = useState(last.columnId ?? '')
  const [title, setTitle] = useState(node.text)
  const [withChildren, setWithChildren] = useState(node.children.length > 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    projectsService.listProjects()
      .then((response) => { if (active) setProjects(response.projects) })
      .catch((cause) => { if (active) { setProjects([]); setError(getApiErrorMessage(cause)) } })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!projectId) return
    let active = true
    projectsService.listBoards(Number(projectId))
      .then((response) => {
        if (!active) return
        const list = (response.boards ?? []).filter((item) => !item.is_archived)
        setBoards(list)
        setBoardId((current) => (list.some((item) => String(item.id) === current) ? current : list[0] ? String(list[0].id) : ''))
      })
      .catch((cause) => { if (active) { setBoards([]); setError(getApiErrorMessage(cause)) } })
    return () => { active = false }
  }, [projectId])

  useEffect(() => {
    if (!boardId) return
    let active = true
    projectsService.getBoard(Number(boardId))
      .then((detail) => {
        if (!active) return
        setBoard(detail)
        const columns = [...detail.columns].sort((a, b) => a.order - b.order)
        setColumnId((current) => (columns.some((column) => String(column.id) === current) ? current : columns[0] ? String(columns[0].id) : ''))
      })
      .catch((cause) => { if (active) { setBoard(null); setError(getApiErrorMessage(cause)) } })
    return () => { active = false }
  }, [boardId])

  const description = useMemo(() => {
    const parts: string[] = []
    if (node.note.trim()) parts.push(node.note.trim())
    if (node.link) parts.push(node.link)
    if (withChildren && node.children.length) parts.push(node.children.flatMap((child) => outline(map, child)).join('\n'))
    parts.push(t('mindmap.task.from_map', 'From mind map: {{title}}', { title: map.title }))
    return parts.join('\n\n')
  }, [map, node, t, withChildren])

  const columns = board && String(board.id) === boardId ? [...board.columns].sort((a, b) => a.order - b.order) : []

  async function create() {
    if (!title.trim() || !columnId) return
    setSaving(true)
    setError(null)
    try {
      const response = await projectsService.createCard(Number(columnId), buildFormData({ title: title.trim(), description }))
      try { localStorage.setItem(LAST_TARGET_KEY, JSON.stringify({ projectId, boardId, columnId })) } catch { /* private mode */ }
      onCreated({ cardId: typeof response?.id === 'number' ? response.id : null, projectId: Number(projectId), boardId: Number(boardId), title: title.trim() })
    } catch (cause) {
      setError(getApiErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('mindmap.task.title', 'Create a task from the node')}
      description={t('mindmap.task.description', 'The card is added to the chosen board column; note, link and sub-nodes go to its description.')}
      headerIcon={<ListChecksIcon size={18} weight="duotone" />}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={() => void create()} loading={saving} disabled={!title.trim() || !columnId}>{t('mindmap.task.create', 'Create task')}</Button>
        </>
      )}
    >
      <div className="space-y-3.5">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('mindmap.task.name', 'Task title')}</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13.5px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('mindmap.task.project', 'Project')}</span>
            <SelectField
              value={projectId}
              onValueChange={(value) => { setProjectId(value); setBoards(null); setBoard(null) }}
              options={(projects ?? []).map((project) => ({ value: String(project.id), label: project.project_name }))}
              placeholder={projects ? t('mindmap.task.choose', 'Choose') : t('common.loading', 'Loading…')}
              searchable
              disabled={!projects}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('mindmap.task.board', 'Board')}</span>
            <SelectField
              value={boardId}
              onValueChange={(value) => { setBoardId(value); setBoard(null) }}
              options={(boards ?? []).map((item) => ({ value: String(item.id), label: item.name }))}
              placeholder={projectId ? (boards ? t('mindmap.task.no_boards', 'No boards') : t('common.loading', 'Loading…')) : '—'}
              disabled={!boards || boards.length === 0}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('mindmap.task.column', 'Column')}</span>
            <SelectField
              value={columnId}
              onValueChange={setColumnId}
              options={columns.map((column) => ({ value: String(column.id), label: column.name, color: column.color ?? undefined }))}
              placeholder={boardId ? t('common.loading', 'Loading…') : '—'}
              disabled={columns.length === 0}
            />
          </div>
        </div>
        {node.children.length > 0 ? (
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--foreground)]">
            <Checkbox checked={withChildren} onChange={(event) => setWithChildren(event.target.checked)} />
            {t('mindmap.task.with_children', 'Add sub-nodes ({{count}}) to the description as a list', { count: node.children.length })}
          </label>
        ) : null}
        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('mindmap.task.preview', 'Description')}</span>
          <div className="max-h-40 overflow-auto rounded-[10px] bg-[var(--muted-surface)] px-3 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap text-[var(--muted-strong)]">{description}</div>
        </div>
        {error ? <p role="alert" className="rounded-[10px] bg-[var(--danger-dim)] px-3 py-2 text-[12.5px] text-[var(--danger-text)]">{error}</p> : null}
      </div>
    </Dialog>
  )
}
