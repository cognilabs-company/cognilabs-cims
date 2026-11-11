import type { ReactNode } from 'react'
import {
  ArrowClockwiseIcon,
  CaretRightIcon,
  DownloadSimpleIcon,
  FileIcon,
  FolderSimpleIcon,
  FunnelIcon,
  GlobeIcon,
  HouseIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  ArrowsOutCardinalIcon,
  ListBulletsIcon,
  SquaresFourIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { FmCrumb } from '../../../shared/api/services/fileManager.service'
import { cn } from '../../../shared/lib/cn'
import { Button } from '../../../shared/ui/button'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import { SelectAllBox } from './ItemViews'

export type ViewMode = 'grid' | 'list'
export type SearchScope = 'folder' | 'all'

const segment = 'inline-flex h-10 shrink-0 items-center rounded-[11px] bg-[var(--muted-surface)] p-0.5'
const segmentButton = 'inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-[12.5px] font-semibold transition-colors'
const segmentOn = 'bg-[var(--card)] text-[var(--foreground)] shadow-[0_1px_3px_rgba(14,21,37,0.12)]'
const segmentOff = 'text-[var(--muted-strong)] hover:text-[var(--foreground)]'

/** Search (this folder / everywhere), type and source filters, grid / list switch. */
export function FilterBar({
  search,
  onSearchChange,
  scope,
  onScopeChange,
  extension,
  extensionOptions,
  onExtensionChange,
  source,
  sourceOptions,
  onSourceChange,
  view,
  onViewChange,
}: {
  search: string
  onSearchChange: (value: string) => void
  scope: SearchScope
  onScopeChange: (scope: SearchScope) => void
  extension: string
  extensionOptions: SelectFieldOption[]
  onExtensionChange: (value: string) => void
  source: string
  sourceOptions: SelectFieldOption[]
  onSourceChange: (value: string) => void
  view: ViewMode
  onViewChange: (view: ViewMode) => void
}) {
  const { t } = useLocale()
  const showScope = Boolean(search.trim()) || scope === 'all'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex min-w-0 flex-[1_1_100%] items-center sm:flex-[1_1_260px]">
        <MagnifyingGlassIcon size={16} className="pointer-events-none absolute left-3 text-[var(--muted)]" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape' && search) { event.preventDefault(); onSearchChange('') } }}
          placeholder={scope === 'all' ? t('files.search.placeholder_all', 'Search all files and folders') : t('files.search.placeholder', 'Search in this folder')}
          aria-label={t('files.search.label', 'Search files')}
          data-ui-control="true"
          className="control-field min-h-10 w-full rounded-[10px] pr-9 pl-9 text-[13.5px] placeholder:text-[13px] placeholder:text-[var(--caption)] [&::-webkit-search-cancel-button]:hidden"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label={t('files.search.clear', 'Clear search')}
            className="absolute right-1.5 grid h-7 w-7 place-items-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
          >
            <XIcon size={14} weight="bold" />
          </button>
        ) : null}
      </label>

      {showScope ? (
        <div role="radiogroup" aria-label={t('files.scope.label', 'Where to search')} className={segment}>
          {([
            ['folder', t('files.scope.here', 'This folder'), <FolderSimpleIcon key="i" size={14} weight="bold" />],
            ['all', t('files.scope.everywhere', 'Everywhere'), <GlobeIcon key="i" size={14} weight="bold" />],
          ] as const).map(([value, label, icon]) => (
            <button key={value} type="button" role="radio" aria-checked={scope === value} onClick={() => onScopeChange(value)} className={cn(segmentButton, scope === value ? segmentOn : segmentOff)}>
              {icon}
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-w-[132px] flex-1 sm:w-[168px] sm:flex-none">
        <SelectField
          value={extension}
          options={extensionOptions}
          onValueChange={onExtensionChange}
          placeholder={t('files.filter.all_types', 'All types')}
          searchable
          searchPlaceholder={t('files.filter.type_search', 'Find a type…')}
          emptyMessage={t('files.filter.none', 'Nothing found')}
          leadingIcon={<FileIcon size={15} />}
          aria-label={t('files.filter.type', 'File type')}
        />
      </div>

      {sourceOptions.length > 1 ? (
        <div className="min-w-[132px] flex-1 sm:w-[190px] sm:flex-none">
          <SelectField
            value={source}
            options={sourceOptions}
            onValueChange={onSourceChange}
            placeholder={t('files.filter.all_sources', 'All sources')}
            leadingIcon={<FunnelIcon size={15} />}
            aria-label={t('files.filter.source', 'Source')}
          />
        </div>
      ) : null}

      <div role="radiogroup" aria-label={t('files.view.label', 'View')} className={cn(segment, 'ml-auto')}>
        {([
          ['grid', t('files.view.grid', 'Grid'), <SquaresFourIcon key="i" size={16} weight="bold" />],
          ['list', t('files.view.list', 'List'), <ListBulletsIcon key="i" size={16} weight="bold" />],
        ] as const).map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={view === value}
            aria-label={label}
            title={label}
            onClick={() => onViewChange(value)}
            className={cn(segmentButton, 'w-9 justify-center px-0', view === value ? segmentOn : segmentOff)}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}

/** All files › Registrations › Developers — every part except the last one opens that folder. */
export function Breadcrumbs({ crumbs, searchLabel, onGo, trailing }: { crumbs: FmCrumb[]; searchLabel: string | null; onGo: (id: string | null) => void; trailing?: ReactNode }) {
  const { t } = useLocale()
  const atRoot = crumbs.length === 0 && !searchLabel
  const crumbButton = 'inline-flex max-w-[220px] items-center gap-1.5 truncate rounded-[8px] px-1.5 py-1 font-semibold transition-colors'

  return (
    <div className="flex min-h-10 items-center gap-2">
      <nav aria-label={t('files.breadcrumbs', 'Folder path')} className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 text-[13px]">
        {atRoot ? (
          <span className={cn(crumbButton, 'text-[var(--foreground)]')} aria-current="page">
            <HouseIcon size={15} weight="bold" />
            {t('files.root', 'All files')}
          </span>
        ) : (
          <button type="button" onClick={() => onGo(null)} className={cn(crumbButton, 'text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]')}>
            <HouseIcon size={15} weight="bold" />
            {t('files.root', 'All files')}
          </button>
        )}
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1 && !searchLabel
          return (
            <span key={crumb.id} className="inline-flex min-w-0 items-center">
              <CaretRightIcon size={12} weight="bold" className="mx-0.5 shrink-0 text-[var(--caption)]" />
              {last ? (
                <span className={cn(crumbButton, 'text-[var(--foreground)]')} aria-current="page" title={crumb.name}>
                  {crumb.system ? <LockSimpleIcon size={13} className="shrink-0 text-[var(--muted)]" /> : null}
                  <span className="truncate">{crumb.name}</span>
                </span>
              ) : (
                <button type="button" onClick={() => onGo(crumb.id)} className={cn(crumbButton, 'text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]')} title={crumb.name}>
                  <span className="truncate">{crumb.name}</span>
                </button>
              )}
            </span>
          )
        })}
        {searchLabel ? (
          <span className="inline-flex min-w-0 items-center">
            <CaretRightIcon size={12} weight="bold" className="mx-0.5 shrink-0 text-[var(--caption)]" />
            <span className={cn(crumbButton, 'text-[var(--foreground)]')} aria-current="page">
              <MagnifyingGlassIcon size={14} weight="bold" className="shrink-0" />
              <span className="truncate">{searchLabel}</span>
            </span>
          </span>
        ) : null}
      </nav>
      {trailing}
    </div>
  )
}

export function RefreshButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  const { t } = useLocale()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('files.refresh', 'Refresh')}
      title={t('files.refresh', 'Refresh')}
      className="mm-press grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[var(--border)] bg-[var(--card)] text-[var(--muted-strong)] hover:bg-[var(--input-surface)]"
    >
      <ArrowClockwiseIcon size={16} className={cn(loading && 'animate-spin')} />
    </button>
  )
}

/** Shown instead of the path while something is selected. */
export function SelectionBar({
  count,
  total,
  canZip,
  canMove,
  canDelete,
  zipping,
  lockedReason,
  onSelectAll,
  onClear,
  onZip,
  onMove,
  onDelete,
}: {
  count: number
  total: number
  canZip: boolean
  canMove: boolean
  canDelete: boolean
  zipping: boolean
  /** Set when the selection holds a system folder: Move / Delete are hidden and this says why. */
  lockedReason: string | null
  onSelectAll: () => void
  onClear: () => void
  onZip: () => void
  onMove: () => void
  onDelete: () => void
}) {
  const { t } = useLocale()
  return (
    <div className="mm-pop flex min-h-10 flex-wrap items-center gap-2 rounded-[12px] bg-[var(--blue-dim)] py-1 pr-1.5 pl-3 sm:flex-nowrap">
      <SelectAllBox checked={count === total} mixed={count > 0 && count < total} onToggle={count === total ? onClear : onSelectAll} label={count === total ? t('files.clear_selection', 'Clear selection') : t('files.select_all', 'Select all')} />
      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--blue-text)]" aria-live="polite">
        {t('files.selected_count', '{{count}} selected', { count })}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {canZip ? (
          <Button size="sm" variant="ghost" className="text-[var(--blue-text)] hover:bg-[var(--surface)]" leftIcon={<DownloadSimpleIcon size={15} weight="bold" />} loading={zipping} onClick={onZip}>
            {t('files.zip.download', 'Download ZIP')}
          </Button>
        ) : null}
        {lockedReason && (canMove || canDelete) ? (
          <span className="inline-flex items-center gap-1 px-1.5 text-[12px] font-medium text-[var(--blue-text)]" title={lockedReason}>
            <LockSimpleIcon size={13} weight="bold" />
            <span className="hidden md:inline">{lockedReason}</span>
          </span>
        ) : null}
        {canMove && !lockedReason ? (
          <Button size="sm" variant="ghost" className="text-[var(--blue-text)] hover:bg-[var(--surface)]" leftIcon={<ArrowsOutCardinalIcon size={15} weight="bold" />} onClick={onMove}>
            {t('files.move', 'Move')}
          </Button>
        ) : null}
        {canDelete && !lockedReason ? (
          <Button size="sm" variant="ghost" className="text-[var(--danger-text)] hover:bg-[var(--danger-dim)]" leftIcon={<TrashIcon size={15} weight="bold" />} onClick={onDelete}>
            {t('files.delete', 'Delete')}
          </Button>
        ) : null}
        <button
          type="button"
          onClick={onClear}
          aria-label={t('files.clear_selection', 'Clear selection')}
          title={t('files.clear_selection', 'Clear selection')}
          className="grid h-8 w-8 place-items-center rounded-[9px] text-[var(--blue-text)] hover:bg-[var(--surface)]"
        >
          <XIcon size={15} weight="bold" />
        </button>
      </div>
    </div>
  )
}
