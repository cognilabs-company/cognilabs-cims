import { useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { PlusIcon, XIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { REGISTRATION_FIELD_TYPES, type RegistrationFieldType } from '../../../shared/api/services/registrations.service'
import { cn } from '../../../shared/lib/cn'
import { MAX_FIELDS, hasOptions, keyFromLabel, newDraft, newUid, type DraftField, type FieldIssues } from '../lib/fields'
import { FIELD_TYPE_ICONS, typeHint, typeLabel } from '../lib/labels'
import { FieldCard } from './FieldCard'

type FieldBuilderProps = {
  fields: DraftField[]
  onChange: (fields: DraftField[]) => void
  openUids: ReadonlySet<string>
  onOpenChange: (uid: string, open: boolean) => void
  issues: Record<string, FieldIssues>
  showAll: boolean
  serverErrors: Record<string, string>
}

const IMAGE_ACCEPT = ['.jpg', '.jpeg', '.png', '.webp']

/** The form's fields: required ones first (locked), then custom ones — reorder by dragging or with the arrows. */
export function FieldBuilder({ fields, onChange, openUids, onOpenChange, issues, showAll, serverErrors }: FieldBuilderProps) {
  const { t } = useLocale()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const lockedCount = fields.filter((field) => field.locked).length
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const defaultOptions = () => [1, 2].map((n) => t('registrations.builder.option_default', 'Option {{n}}', { n }))

  function update(uid: string, patch: Partial<DraftField>) {
    onChange(fields.map((field) => {
      if (field.uid !== uid) return field
      if (field.locked) return patch.label !== undefined ? { ...field, label: patch.label } : field
      const next: DraftField = { ...field, ...patch }
      if (patch.label !== undefined && !next.keyEdited) {
        next.key = keyFromLabel(patch.label, new Set(fields.filter((other) => other.uid !== uid).map((other) => other.key)))
      }
      if (patch.type && hasOptions(patch.type) && next.options.length === 0) next.options = defaultOptions()
      if (patch.type === 'image' && next.accept.length === 0) next.accept = [...IMAGE_ACCEPT]
      return next
    }))
  }

  function move(uid: string, delta: number) {
    const from = fields.findIndex((field) => field.uid === uid)
    const to = from + delta
    if (from < lockedCount || to < lockedCount || to >= fields.length) return
    onChange(arrayMove(fields, from, to))
  }

  function add(type: RegistrationFieldType) {
    const draft = newDraft(type, typeLabel(t, type), new Set(fields.map((field) => field.key)))
    if (hasOptions(type)) draft.options = defaultOptions()
    onChange([...fields, draft])
    onOpenChange(draft.uid, true)
    setPaletteOpen(false)
    window.requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(`[data-uid="${draft.uid}"]`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    })
  }

  function duplicate(uid: string) {
    const index = fields.findIndex((field) => field.uid === uid)
    const source = fields[index]
    if (!source || fields.length >= MAX_FIELDS) return
    const label = t('registrations.builder.copy_label', '{{label}} (copy)', { label: source.label })
    const copy: DraftField = {
      ...source,
      options: [...source.options],
      accept: [...source.accept],
      uid: newUid(),
      label,
      key: keyFromLabel(label, new Set(fields.map((field) => field.key))),
      keyEdited: false,
      locked: false,
    }
    onChange([...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)])
    onOpenChange(copy.uid, true)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = fields.findIndex((field) => field.uid === active.id)
    const to = fields.findIndex((field) => field.uid === over.id)
    if (from < lockedCount || to < lockedCount) return
    onChange(arrayMove(fields, from, to))
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={fields.map((field) => field.uid)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {fields.map((field, index) => (
              <FieldCard
                key={field.uid}
                field={field}
                open={openUids.has(field.uid)}
                onToggle={() => onOpenChange(field.uid, !openUids.has(field.uid))}
                onChange={(patch) => update(field.uid, patch)}
                onMove={(delta) => move(field.uid, delta)}
                onDuplicate={() => duplicate(field.uid)}
                onRemove={() => onChange(fields.filter((other) => other.uid !== field.uid))}
                canMoveUp={!field.locked && index > lockedCount}
                canMoveDown={!field.locked && index < fields.length - 1}
                issues={issues[field.uid]}
                showAll={showAll}
                serverError={serverErrors[field.uid]}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {paletteOpen ? (
        <div className="rounded-[16px] border border-[var(--border-hover)] bg-[var(--card)] p-2.5 shadow-[var(--elev-sm)] animate-[mm-fade-up_220ms_cubic-bezier(0.16,1,0.3,1)_backwards]">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <p className="text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('registrations.builder.pick_type', 'Choose a field type')}</p>
            <button type="button" onClick={() => setPaletteOpen(false)} aria-label={t('registrations.common.close', 'Close')} className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
              <XIcon size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {REGISTRATION_FIELD_TYPES.map((type) => {
              const Icon = FIELD_TYPE_ICONS[type]
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => add(type)}
                  className="group/type flex items-center gap-2.5 rounded-[12px] border border-transparent px-2 py-2 text-left transition-colors hover:border-[var(--blue-border)] hover:bg-[var(--blue-dim)]"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[var(--muted-surface)] text-[var(--muted-strong)] transition-colors group-hover/type:bg-[var(--surface)] group-hover/type:text-[var(--primary)]">
                    <Icon size={17} weight="duotone" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-[var(--foreground)]">{typeLabel(t, type)}</span>
                    <span className="block truncate text-[11px] text-[var(--muted)]">{typeHint(t, type)}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          disabled={fields.length >= MAX_FIELDS}
          className={cn(
            'flex h-12 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-hover)] text-[13px] font-semibold text-[var(--primary)] transition-colors',
            'hover:border-[var(--primary)] hover:bg-[var(--blue-dim)] disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          <PlusIcon size={15} weight="bold" />
          {fields.length >= MAX_FIELDS ? t('registrations.builder.max_fields', 'A form can have up to {{count}} fields', { count: MAX_FIELDS }) : t('registrations.builder.add_field', 'Add field')}
        </button>
      )}
    </div>
  )
}
