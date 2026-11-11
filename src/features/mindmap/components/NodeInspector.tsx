import { ArrowSquareOutIcon, CheckSquareIcon, ListChecksIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { NODE_COLORS, NODE_NOTE_LIMIT, NODE_SHAPES, type MindNode, type NodeShape, type NodeTask } from '../lib/types'

type Props = {
  node: MindNode
  depth: number
  branchColor: string
  canCreateTask: boolean
  onChange: (patch: Partial<Pick<MindNode, 'text' | 'note' | 'link' | 'color' | 'shape'>>, field: string) => void
  onCreateTask: () => void
  onOpenTask: (task: NodeTask) => void
}

const fieldClass =
  'w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none'

function shapePreview(shape: NodeShape) {
  if (shape === 'pill') return 'rounded-full bg-[var(--input-surface)] border border-[var(--border-hover)]'
  if (shape === 'rect') return 'rounded-[2px] bg-[var(--input-surface)] border border-[var(--border-hover)]'
  if (shape === 'outline') return 'rounded-[6px] bg-[var(--card)] border-2'
  return 'rounded-[6px] bg-[var(--input-surface)] border border-[var(--border-hover)]'
}

/** Right panel: everything about the selected node. */
export function NodeInspector({ node, depth, branchColor, canCreateTask, onChange, onCreateTask, onOpenTask }: Props) {
  const { t } = useLocale()
  const shapeLabels: Record<NodeShape, string> = {
    rounded: t('mindmap.shape.rounded', 'Rounded'),
    pill: t('mindmap.shape.pill', 'Pill'),
    rect: t('mindmap.shape.rect', 'Rectangle'),
    outline: t('mindmap.shape.outline', 'Outline'),
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="px-4 pt-4 text-[13.5px] font-bold text-[var(--foreground)]">{t('mindmap.inspector.title', 'Node')}</p>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-3 pb-4">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted-strong)]">{t('mindmap.inspector.text', 'Text')}</span>
          <input value={node.text} onChange={(event) => onChange({ text: event.target.value }, 'text')} className={cn(fieldClass, 'h-10')} maxLength={300} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted-strong)]">{t('mindmap.inspector.note', 'Note')}</span>
          <span className="relative block">
            <textarea
              value={node.note}
              onChange={(event) => onChange({ note: event.target.value.slice(0, NODE_NOTE_LIMIT) }, 'note')}
              rows={4}
              className={cn(fieldClass, 'resize-y py-2 pb-6 leading-snug')}
              placeholder={t('mindmap.inspector.note_placeholder', 'Details, ideas, decisions…')}
            />
            <span className="pointer-events-none absolute right-2.5 bottom-2 text-[10.5px] text-[var(--muted)] tabular-nums">{node.note.length}/{NODE_NOTE_LIMIT}</span>
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted-strong)]">{t('mindmap.inspector.link', 'Link')}</span>
          <input
            type="url"
            value={node.link}
            onChange={(event) => onChange({ link: event.target.value.trim() }, 'link')}
            placeholder="https://..."
            className={cn(fieldClass, 'h-10')}
          />
          <span className="mt-1.5 block text-[11.5px] leading-snug text-[var(--muted)]">{t('mindmap.inspector.link_hint', 'Brief, Drive folder, sample post… A link icon appears on the node.')}</span>
        </label>

        <div>
          <span className="mb-2 block text-[12px] font-semibold text-[var(--muted-strong)]">{t('mindmap.inspector.color', 'Colour')}</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('mindmap.inspector.color', 'Colour')}>
            <button
              type="button"
              role="radio"
              aria-checked={node.color === null}
              title={t('mindmap.inspector.color_auto', 'Automatic (branch colour)')}
              onClick={() => onChange({ color: null }, 'color')}
              className={cn('h-6 w-6 rounded-full border-2 border-dashed transition-transform hover:scale-110', node.color === null ? 'ring-2 ring-[var(--foreground)] ring-offset-2 ring-offset-[var(--card)]' : '')}
              style={{ borderColor: branchColor }}
            />
            {NODE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={node.color === color}
                aria-label={color}
                onClick={() => onChange({ color }, 'color')}
                className={cn('h-6 w-6 rounded-full transition-transform hover:scale-110', node.color === color && 'ring-2 ring-[var(--foreground)] ring-offset-2 ring-offset-[var(--card)]')}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-[12px] font-semibold text-[var(--muted-strong)]">{t('mindmap.inspector.shape', 'Shape')}</span>
          <div className="flex gap-2" role="radiogroup" aria-label={t('mindmap.inspector.shape', 'Shape')}>
            {NODE_SHAPES.map((shape) => (
              <button
                key={shape}
                type="button"
                role="radio"
                aria-checked={node.shape === shape}
                title={shapeLabels[shape]}
                aria-label={shapeLabels[shape]}
                onClick={() => onChange({ shape }, 'shape')}
                className={cn('grid h-9 w-[46px] place-items-center rounded-[9px] transition-colors', node.shape === shape ? 'bg-[var(--blue-dim)] ring-2 ring-[var(--primary)]' : 'hover:bg-[var(--input-surface)]')}
              >
                <span className={cn('block h-[18px] w-[32px]', shapePreview(shape))} style={shape === 'outline' ? { borderColor: branchColor } : undefined} />
              </button>
            ))}
          </div>
        </div>

        {node.task ? (
          <button
            type="button"
            onClick={() => onOpenTask(node.task!)}
            className="flex w-full items-center gap-2.5 rounded-[12px] bg-[var(--success-dim)] px-3 py-2.5 text-left transition-colors hover:brightness-95"
          >
            <CheckSquareIcon size={18} weight="duotone" className="shrink-0 text-[var(--success-text)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-semibold text-[var(--success-text)]">{t('mindmap.task.created', 'Task created')}</span>
              <span className="block truncate text-[11.5px] text-[var(--muted-strong)]">{node.task.title}</span>
            </span>
            <ArrowSquareOutIcon size={15} className="shrink-0 text-[var(--success-text)]" />
          </button>
        ) : canCreateTask ? (
          <button
            type="button"
            onClick={onCreateTask}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <ListChecksIcon size={16} weight="duotone" />
            {t('mindmap.task.create_as', 'Create as a task')}
          </button>
        ) : null}

        <p className="text-[11.5px] text-[var(--muted)] tabular-nums">
          {t('mindmap.inspector.depth', 'Level: {{depth}} · children: {{count}}', { depth, count: node.children.length })}
        </p>
      </div>
    </div>
  )
}
