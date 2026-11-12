import { CaretLeftIcon, CaretRightIcon, ListIcon, SquaresFourIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { formatBytes } from '../lib/items'
import type { ViewMode } from '../lib/explorer'

export type Pager = { page: number; pageCount: number; from: number; to: number; total: number; onPrevious: () => void; onNext: () => void }

/** Bottom strip: "24 items · 3 selected · 4.2 MB", paging, and the two quick view switches (like Explorer). */
export function StatusBar({
  itemCount,
  selectedCount,
  selectedSize,
  loading,
  pager,
  note,
  view,
  onView,
}: {
  itemCount: number | null
  selectedCount: number
  selectedSize: number | null
  loading: boolean
  pager: Pager | null
  /** Extra text (e.g. "showing the first 200"). */
  note?: string | null
  view: ViewMode
  onView: (view: ViewMode) => void
}) {
  const { t } = useLocale()
  return (
    <footer className="fx-status">
      <p className="fx-status__text" aria-live="polite">
        {itemCount !== null ? <span>{t('files.items_count', '{{count}} items', { count: itemCount })}</span> : null}
        {selectedCount ? (
          <>
            <span className="fx-status__dot" aria-hidden="true" />
            <span className="fx-status__strong">{t('files.selected_count', '{{count}} selected', { count: selectedCount })}</span>
            {selectedSize !== null ? (
              <>
                <span className="fx-status__dot" aria-hidden="true" />
                <span>{formatBytes(selectedSize)}</span>
              </>
            ) : null}
          </>
        ) : null}
        {note ? (
          <>
            <span className="fx-status__dot" aria-hidden="true" />
            <span className="truncate">{note}</span>
          </>
        ) : null}
        {loading ? <span className="fx-status__busy" aria-label={t('files.loading', 'Loading…')} /> : null}
      </p>
      {pager ? (
        <div className="fx-status__pager">
          <span className="tabular-nums">{t('files.pager.range', 'Files {{from}}–{{to}} of {{total}}', { from: pager.from, to: pager.to, total: pager.total })}</span>
          <button type="button" className="fx-status__btn" onClick={pager.onPrevious} disabled={pager.page <= 1} aria-label={t('files.pager.previous', 'Previous')} title={t('files.pager.previous', 'Previous')}>
            <CaretLeftIcon size={13} weight="bold" />
          </button>
          <span className="tabular-nums font-semibold text-[var(--muted-strong)]">{pager.page} / {pager.pageCount}</span>
          <button type="button" className="fx-status__btn" onClick={pager.onNext} disabled={pager.page >= pager.pageCount} aria-label={t('files.pager.next', 'Next')} title={t('files.pager.next', 'Next')}>
            <CaretRightIcon size={13} weight="bold" />
          </button>
        </div>
      ) : null}
      <div className="fx-status__views" role="radiogroup" aria-label={t('files.view.label', 'View')}>
        <button type="button" role="radio" aria-checked={view === 'details'} className="fx-status__btn" onClick={() => onView('details')} title={t('files.view.details', 'Details')} aria-label={t('files.view.details', 'Details')}>
          <ListIcon size={15} weight={view === 'details' ? 'bold' : 'regular'} />
        </button>
        <button type="button" role="radio" aria-checked={view !== 'details'} className="fx-status__btn" onClick={() => onView(view === 'details' ? 'large' : view)} title={t('files.view.large', 'Large icons')} aria-label={t('files.view.large', 'Large icons')}>
          <SquaresFourIcon size={15} weight={view !== 'details' ? 'bold' : 'regular'} />
        </button>
      </div>
    </footer>
  )
}
