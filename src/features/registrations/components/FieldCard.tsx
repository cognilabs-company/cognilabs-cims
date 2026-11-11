import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDownIcon, ArrowUpIcon, CaretDownIcon, CopyIcon, DotsSixVerticalIcon, LockSimpleIcon, TrashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { REGISTRATION_FIELD_TYPES, type RegistrationFieldType } from '../../../shared/api/services/registrations.service'
import { cn } from '../../../shared/lib/cn'
import { Input } from '../../../shared/ui/input'
import { SelectField } from '../../../shared/ui/select-field'
import { Switch } from '../../../shared/ui/switch'
import { hasOptions, isFileType, sanitizeKeyInput, type DraftField, type FieldIssues } from '../lib/fields'
import { FIELD_TYPE_ICONS, fieldIssueMessage, fieldLabel, typeHint, typeLabel } from '../lib/labels'
import { AcceptEditor } from './AcceptEditor'
import { OptionsEditor } from './OptionsEditor'

type FieldCardProps = {
  field: DraftField
  open: boolean
  onToggle: () => void
  onChange: (patch: Partial<DraftField>) => void
  onMove: (delta: number) => void
  onDuplicate: () => void
  onRemove: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  issues?: FieldIssues
  /** Show issues that only matter once the user tried to save. */
  showAll: boolean
  serverError?: string
}

const iconButton =
  'grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[var(--muted)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30'

function Labeled({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-semibold text-[var(--muted-strong)]">{label}</label>
      {children}
      {error ? <p className="text-[12px] font-medium text-[var(--danger-text)]">{error}</p> : hint ? <p className="text-[11.5px] leading-[1.4] text-[var(--muted)]">{hint}</p> : null}
    </div>
  )
}

/** One field in the builder: a compact row that opens into its settings. */
export function FieldCard({ field, open, onToggle, onChange, onMove, onDuplicate, onRemove, canMoveUp, canMoveDown, issues, showAll, serverError }: FieldCardProps) {
  const { t } = useLocale()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: field.uid, disabled: field.locked })
  const Icon = FIELD_TYPE_ICONS[field.type]
  const base = `field-${field.uid}`
  const keyIssue = issues?.key && (showAll || field.key !== '') ? fieldIssueMessage(t, issues.key) : undefined
  const labelIssue = issues?.label && showAll ? fieldIssueMessage(t, issues.label) : undefined
  const optionsIssue = issues?.options && showAll ? fieldIssueMessage(t, issues.options) : undefined
  const hasProblem = Boolean(keyIssue || labelIssue || optionsIssue || serverError)
  const showPlaceholder = !field.locked && !['checkbox', 'file', 'image', 'radio', 'multi_select'].includes(field.type)

  const typeOptions = REGISTRATION_FIELD_TYPES.map((type) => ({ value: type, label: typeLabel(t, type), hint: typeHint(t, type) }))

  return (
    <li
      ref={setNodeRef}
      data-uid={field.uid}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'relative rounded-[14px] border bg-[var(--surface)] transition-[border-color,box-shadow]',
        open ? 'border-[var(--border-hover)] shadow-[var(--elev-sm)]' : 'border-[var(--border)]',
        hasProblem && 'border-[var(--danger)]',
        isDragging && 'z-20 shadow-[var(--elev-lg)]',
      )}
    >
      <div className="flex items-center gap-1.5 py-1.5 pr-1.5 pl-1.5 sm:gap-2">
        {field.locked ? (
          <span className="grid h-8 w-7 shrink-0 place-items-center text-[var(--caption)]" title={t('registrations.builder.locked_hint', 'Required for every form — only the label can be changed')}>
            <LockSimpleIcon size={15} />
          </span>
        ) : (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={t('registrations.builder.drag', 'Drag to reorder')}
            className="grid h-8 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-[8px] text-[var(--caption)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)] active:cursor-grabbing"
          >
            <DotsSixVerticalIcon size={18} weight="bold" />
          </button>
        )}
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-[10px]', field.locked ? 'bg-[var(--muted-surface)] text-[var(--muted-strong)]' : 'bg-[var(--blue-dim)] text-[var(--primary)]')}>
          <Icon size={18} weight="duotone" />
        </span>
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 rounded-[8px] py-0.5 text-left">
          <span className="flex min-w-0 items-center gap-1">
            <span className={cn('truncate text-[13.5px] font-semibold', field.label.trim() ? 'text-[var(--foreground)]' : 'text-[var(--caption)] italic')} data-i18n-skip="true">
              {field.label.trim() ? fieldLabel(t, field) : t('registrations.builder.untitled', 'Untitled field')}
            </span>
            {field.required || field.locked ? <span className="text-[var(--danger-text)]" aria-label={t('registrations.builder.required', 'Required')}>*</span> : null}
            {hasProblem ? <WarningCircleIcon size={15} weight="fill" className="shrink-0 text-[var(--danger-text)]" /> : null}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
            <span className="shrink-0">{typeLabel(t, field.type)}</span>
            <span aria-hidden="true">·</span>
            <code className="truncate font-mono text-[11px]" data-i18n-skip="true">{field.key || '—'}</code>
            {hasOptions(field.type) && field.options.length ? (
              <>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="hidden shrink-0 sm:inline">{t('registrations.builder.options_count', '{{count}} options', { count: field.options.length })}</span>
              </>
            ) : null}
          </span>
        </button>
        {!field.locked ? (
          <div className="flex shrink-0 items-center">
            <button type="button" onClick={() => onMove(-1)} disabled={!canMoveUp} aria-label={t('registrations.builder.move_up', 'Move up')} className={iconButton}>
              <ArrowUpIcon size={15} />
            </button>
            <button type="button" onClick={() => onMove(1)} disabled={!canMoveDown} aria-label={t('registrations.builder.move_down', 'Move down')} className={iconButton}>
              <ArrowDownIcon size={15} />
            </button>
          </div>
        ) : null}
        <button type="button" onClick={onToggle} aria-label={open ? t('registrations.builder.collapse', 'Collapse') : t('registrations.builder.expand', 'Edit field')} className={iconButton}>
          <CaretDownIcon size={15} className={cn('transition-transform duration-200', open && 'rotate-180')} />
        </button>
      </div>

      {open ? (
        <div className="border-t border-[var(--border-subtle)] px-3.5 pt-3.5 pb-3 sm:px-4">
          {field.locked ? (
            <div className="grid gap-3">
              <Labeled id={`${base}-label`} label={t('registrations.builder.label', 'Label')} error={labelIssue}>
                <Input id={`${base}-label`} value={field.label} maxLength={255} onChange={(event) => onChange({ label: event.target.value })} aria-invalid={labelIssue ? true : undefined} />
              </Labeled>
              <p className="flex items-start gap-2 rounded-[10px] bg-[var(--muted-surface)] px-3 py-2 text-[12px] leading-[1.45] text-[var(--muted-strong)]">
                <LockSimpleIcon size={14} className="mt-0.5 shrink-0" />
                {t('registrations.builder.locked_text', 'Every form asks for email, name, surname and password — they create the user account after approval. Only the label can be changed.')}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled id={`${base}-label`} label={t('registrations.builder.label', 'Label')} error={labelIssue}>
                <Input id={`${base}-label`} value={field.label} maxLength={255} onChange={(event) => onChange({ label: event.target.value })} aria-invalid={labelIssue ? true : undefined} />
              </Labeled>
              <Labeled
                id={`${base}-key`}
                label={t('registrations.builder.key', 'Key')}
                error={keyIssue}
                hint={field.keyEdited ? t('registrations.builder.key_hint_manual', 'Stored with each answer') : t('registrations.builder.key_hint_auto', 'Made from the label automatically')}
              >
                <Input
                  id={`${base}-key`}
                  value={field.key}
                  maxLength={64}
                  spellCheck={false}
                  autoCapitalize="none"
                  onChange={(event) => onChange({ key: sanitizeKeyInput(event.target.value), keyEdited: true })}
                  aria-invalid={keyIssue ? true : undefined}
                  className="font-mono text-[12.5px]"
                />
              </Labeled>
              <Labeled id={`${base}-type`} label={t('registrations.builder.type', 'Type')}>
                <SelectField
                  id={`${base}-type`}
                  value={field.type}
                  options={typeOptions}
                  onValueChange={(value) => onChange({ type: value as RegistrationFieldType })}
                  aria-label={t('registrations.builder.type', 'Type')}
                />
              </Labeled>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('registrations.builder.required', 'Required')}</span>
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-[var(--border-hover)] px-3">
                  <span className="text-[13px] text-[var(--foreground)]">{field.required ? t('registrations.builder.required_on', 'Applicants must fill it') : t('registrations.builder.required_off', 'Optional')}</span>
                  <Switch checked={field.required} onChange={(checked) => onChange({ required: checked })} label={t('registrations.builder.required', 'Required')} />
                </label>
              </div>
              {showPlaceholder ? (
                <Labeled id={`${base}-placeholder`} label={t('registrations.builder.placeholder', 'Placeholder')}>
                  <Input id={`${base}-placeholder`} value={field.placeholder ?? ''} maxLength={500} onChange={(event) => onChange({ placeholder: event.target.value })} />
                </Labeled>
              ) : null}
              <div className={cn(!showPlaceholder && 'sm:col-span-2')}>
                <Labeled id={`${base}-help`} label={t('registrations.builder.help_text', 'Help text')}>
                  <Input id={`${base}-help`} value={field.help_text ?? ''} maxLength={1000} onChange={(event) => onChange({ help_text: event.target.value })} placeholder={t('registrations.builder.help_placeholder', 'Shown under the field')} />
                </Labeled>
              </div>
              {hasOptions(field.type) ? (
                <div className="sm:col-span-2">
                  <OptionsEditor id={`${base}-options`} options={field.options} onChange={(options) => onChange({ options })} error={optionsIssue} />
                </div>
              ) : null}
              {isFileType(field.type) ? (
                <div className="sm:col-span-2">
                  <AcceptEditor id={`${base}-accept`} kind={field.type === 'image' ? 'image' : 'file'} accept={field.accept} onChange={(accept) => onChange({ accept })} />
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-[var(--border-subtle)] pt-3 sm:col-span-2">
                <button type="button" onClick={onDuplicate} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] px-2.5 text-[12.5px] font-semibold text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
                  <CopyIcon size={14} /> {t('registrations.builder.duplicate', 'Duplicate')}
                </button>
                <button type="button" onClick={onRemove} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] px-2.5 text-[12.5px] font-semibold text-[var(--danger-text)] hover:bg-[var(--danger-dim)]">
                  <TrashIcon size={14} /> {t('registrations.builder.remove', 'Delete field')}
                </button>
              </div>
            </div>
          )}
          {serverError ? <p className="mt-2.5 text-[12px] font-medium text-[var(--danger-text)]">{serverError}</p> : null}
        </div>
      ) : null}
    </li>
  )
}
