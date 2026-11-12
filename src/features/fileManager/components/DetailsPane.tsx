import type { ReactNode } from 'react'
import { XIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import type { FileKind } from '../lib/items'
import type { PropertyRow } from '../lib/properties'
import { ItemGlyph } from './ItemGlyph'

export type PaneSubject = {
  /** Icons to draw: one for an item / the open folder, up to three stacked for a selection. */
  glyphs: { kind: FileKind; extension: string; system: boolean; filled: boolean }[]
  name: string
  subtitle: string
}

export type PaneAction = { id: string; label: string; icon: ReactNode; onRun: () => void; disabled?: boolean; danger?: boolean; busy?: boolean }

/** "Name / value" list of the details pane and the Properties dialog. */
export function PropertiesList({ rows, className }: { rows: PropertyRow[]; className?: string }) {
  return (
    <dl className={cn('fx-props', className)}>
      {rows.map((row) => (
        <div key={row.id} className="fx-props__row">
          <dt>{row.label}</dt>
          <dd title={row.value}>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function SubjectGlyph({ subject, size }: { subject: PaneSubject; size: number }) {
  if (subject.glyphs.length <= 1) {
    const glyph = subject.glyphs[0]
    return glyph ? <ItemGlyph kind={glyph.kind} extension={glyph.extension} system={glyph.system} filled={glyph.filled} size={size} /> : null
  }
  return (
    <span className="fx-stack" style={{ width: size * 1.25, height: size }}>
      {subject.glyphs.slice(0, 3).map((glyph, index) => (
        <span key={index} className="fx-stack__item" data-index={index}>
          <ItemGlyph kind={glyph.kind} extension={glyph.extension} system={false} filled={glyph.filled} size={size * 0.82} />
        </span>
      ))}
    </span>
  )
}

/** Right pane: what is selected (or the open folder), quick actions and its properties. */
export function DetailsPane({
  subject,
  subjectKey,
  rows,
  actions,
  onClose,
}: {
  subject: PaneSubject
  /** Changes when the selection changes — the content fades over. */
  subjectKey: string
  rows: PropertyRow[]
  actions: PaneAction[]
  onClose: () => void
}) {
  const { t } = useLocale()
  return (
    <aside className="fx-details" aria-label={t('files.details.title', 'Details')}>
      <header className="fx-details__head">
        <p>{t('files.details.title', 'Details')}</p>
        <button type="button" className="fx-nav-btn" onClick={onClose} aria-label={t('files.details.hide', 'Hide the details pane')} title={t('files.details.hide', 'Hide the details pane')}>
          <XIcon size={15} weight="bold" />
        </button>
      </header>
      <div key={subjectKey} className="fx-details__body">
        <div className="fx-details__hero">
          <SubjectGlyph subject={subject} size={88} />
        </div>
        <p className="fx-details__name">{subject.name}</p>
        <p className="fx-details__sub">{subject.subtitle}</p>
        {actions.length ? (
          <div className="fx-details__actions">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="fx-details__action"
                data-danger={action.danger || undefined}
                disabled={action.disabled || action.busy}
                onClick={action.onRun}
                title={action.label}
              >
                {action.busy ? <span className="fx-spin" /> : action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        ) : null}
        <PropertiesList rows={rows} />
      </div>
    </aside>
  )
}
