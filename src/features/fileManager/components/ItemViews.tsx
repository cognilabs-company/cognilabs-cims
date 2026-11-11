import type { MouseEvent as ReactMouseEvent } from 'react'
import { CheckIcon, DotsThreeIcon, FolderIcon, LockSimpleIcon, MinusIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { FmFile, FmFolder, FmItem } from '../../../shared/api/services/fileManager.service'
import { formatShortDate, formatShortDateTime } from '../../../shared/lib/format'
import { cn } from '../../../shared/lib/cn'
import { Checkbox } from '../../../shared/ui/checkbox'
import { formatBytes, isUploadSource, itemKey, kindOf, sourceLabel, type Translate } from '../lib/items'
import { KindIcon, KindTile } from './KindIcon'

export type MenuOrigin = { rect: DOMRect } | { x: number; y: number }

type ViewProps = {
  folders: FmFolder[]
  files: FmFile[]
  selected: ReadonlySet<string>
  /** Checkboxes are shown (some bulk action is allowed). */
  selectable: boolean
  /** Search results: show where each item lives. */
  showPath: boolean
  busyKeys: ReadonlySet<string>
  menuKey: string | null
  onOpen: (item: FmItem) => void
  onToggle: (item: FmItem, range: boolean) => void
  onMenu: (item: FmItem, origin: MenuOrigin) => void
}

function folderMeta(folder: FmFolder, t: Translate, locale: Parameters<typeof formatShortDate>[1]) {
  if (folder.fileCount !== null || folder.folderCount !== null) {
    const count = (folder.fileCount ?? 0) + (folder.folderCount ?? 0)
    return t('files.items_count', '{{count}} items', { count })
  }
  return folder.updatedAt ? formatShortDate(folder.updatedAt, locale) : ''
}

function fileMeta(file: FmFile, locale: Parameters<typeof formatShortDate>[1]) {
  return [formatBytes(file.size), file.updatedAt ? formatShortDate(file.updatedAt, locale) : ''].filter(Boolean).join(' · ')
}

function openMenuFromContext(event: ReactMouseEvent, item: FmItem, onMenu: ViewProps['onMenu']) {
  event.preventDefault()
  onMenu(item, { x: event.clientX, y: event.clientY })
}

/** Folders and files as 3D folder cards (colour = file type). */
export function FileGrid({ folders, files, selected, selectable, showPath, busyKeys, menuKey, onOpen, onToggle, onMenu }: ViewProps) {
  const { t, locale } = useLocale()
  const items: FmItem[] = [...folders, ...files]

  return (
    <div className="fm-grid" data-selecting={selected.size > 0}>
      {items.map((item) => {
        const key = itemKey(item)
        const kind = kindOf(item)
        const isSelected = selected.has(key)
        const busy = busyKeys.has(key)
        const meta = item.kind === 'folder' ? folderMeta(item, t, locale) : fileMeta(item, locale)
        const system = item.kind === 'folder' && item.system
        return (
          <div
            key={key}
            className="fm-card"
            data-kind={kind}
            data-selected={isSelected}
            onContextMenu={(event) => openMenuFromContext(event, item, onMenu)}
          >
            {selectable ? (
              <span className="fm-card__check grid place-items-center rounded-[9px] bg-[var(--surface)] p-1 shadow-[var(--elev-sm)]">
                <Checkbox
                  size="sm"
                  checked={isSelected}
                  aria-label={t('files.select_item', 'Select “{{name}}”', { name: item.name })}
                  onChange={() => { /* handled on click (needs the shift key) */ }}
                  onClick={(event) => onToggle(item, event.shiftKey)}
                />
              </span>
            ) : null}
            <button
              type="button"
              className="fm-card__more grid h-7 w-7 place-items-center rounded-[9px] bg-[var(--surface)] text-[var(--muted-strong)] shadow-[var(--elev-sm)] hover:text-[var(--foreground)]"
              aria-label={t('files.menu.label', 'Actions for “{{name}}”', { name: item.name })}
              aria-haspopup="menu"
              aria-expanded={menuKey === key}
              onClick={(event) => onMenu(item, { rect: event.currentTarget.getBoundingClientRect() })}
            >
              <DotsThreeIcon size={18} weight="bold" />
            </button>

            <button
              type="button"
              className="fm-card__hit"
              onClick={(event) => {
                if (selectable && (event.metaKey || event.ctrlKey || event.shiftKey)) onToggle(item, event.shiftKey)
                else onOpen(item)
              }}
              aria-label={item.kind === 'folder' ? t('files.open_folder_named', 'Open folder “{{name}}”', { name: item.name }) : t('files.open_file_named', 'Open “{{name}}”', { name: item.name })}
              title={item.name}
            >
              <span className="fm-fold" aria-hidden="true">
                <span className="fm-fold__back" />
                <span className="fm-fold__sheet fm-fold__sheet--3" />
                <span className="fm-fold__sheet fm-fold__sheet--2" />
                <span className="fm-fold__sheet fm-fold__sheet--1" />
                <span className="fm-fold__front">
                  <span className="fm-fold__tag">
                    {system ? <LockSimpleIcon weight="bold" /> : item.kind === 'folder' ? <FolderIcon weight="bold" /> : <KindIcon kind={kind} weight="bold" />}
                    {system ? <span>{t('files.system_short', 'System')}</span> : item.kind === 'file' && item.extension ? <span>{item.extension.toUpperCase().slice(0, 5)}</span> : null}
                  </span>
                  {busy ? <span className="mr-2.5 mb-2.5 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
                </span>
              </span>
            </button>

            <b className="fm-card__name" title={item.name}>{item.name}</b>
            {meta ? <small className="fm-card__meta">{meta}</small> : null}
            {showPath && item.path ? <small className="fm-card__meta" title={item.path}>{item.path}</small> : null}
          </div>
        )
      })}
    </div>
  )
}

/** Folders and files as rows: name · size · modified. */
export function FileList({
  folders,
  files,
  selected,
  selectable,
  showPath,
  busyKeys,
  menuKey,
  onOpen,
  onToggle,
  onMenu,
  allSelected,
  someSelected,
  onToggleAll,
}: ViewProps & { allSelected: boolean; someSelected: boolean; onToggleAll: () => void }) {
  const { t, locale } = useLocale()
  const items: FmItem[] = [...folders, ...files]
  const columns = selectable
    ? 'grid-cols-[22px_minmax(0,1fr)_32px] sm:grid-cols-[22px_minmax(0,1fr)_96px_150px_32px]'
    : 'grid-cols-[minmax(0,1fr)_32px] sm:grid-cols-[minmax(0,1fr)_96px_150px_32px]'

  return (
    <div className="flex flex-col">
      <div className={cn('grid items-center gap-3 border-b border-[var(--border)] px-3 pb-2 text-[11.5px] font-semibold tracking-[0.02em] text-[var(--muted)] uppercase', columns)}>
        {selectable ? (
          <SelectAllBox checked={allSelected} mixed={someSelected && !allSelected} onToggle={onToggleAll} label={t('files.select_all', 'Select all')} />
        ) : null}
        <span>{t('files.column.name', 'Name')}</span>
        <span className="hidden text-right sm:block">{t('files.column.size', 'Size')}</span>
        <span className="hidden sm:block">{t('files.column.modified', 'Modified')}</span>
        <span />
      </div>

      <div role="list">
        {items.map((item) => {
          const key = itemKey(item)
          const kind = kindOf(item)
          const isSelected = selected.has(key)
          const system = item.kind === 'folder' && item.system
          const size = item.kind === 'folder' ? folderMeta(item, t, locale) : formatBytes(item.size)
          const sub = [
            showPath && item.path ? item.path : null,
            system ? t('files.system_folder', 'System folder') : null,
            item.kind === 'file' && item.sourceType && !isUploadSource(item.sourceType) ? sourceLabel(item.sourceType, t) : null,
          ].filter(Boolean).join(' · ')
          return (
            <div
              key={key}
              role="listitem"
              data-selected={isSelected}
              onContextMenu={(event) => openMenuFromContext(event, item, onMenu)}
              className={cn(
                'group grid items-center gap-3 border-b border-[var(--border-subtle,var(--border))] px-3 py-2 transition-colors last:border-b-0',
                columns,
                isSelected ? 'bg-[var(--row-selected)]' : 'hover:bg-[var(--row-hover)]',
              )}
            >
              {selectable ? (
                <Checkbox
                  size="sm"
                  checked={isSelected}
                  aria-label={t('files.select_item', 'Select “{{name}}”', { name: item.name })}
                  onChange={() => { /* handled on click (needs the shift key) */ }}
                  onClick={(event) => onToggle(item, event.shiftKey)}
                />
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  if (selectable && (event.metaKey || event.ctrlKey || event.shiftKey)) onToggle(item, event.shiftKey)
                  else onOpen(item)
                }}
                className="flex min-w-0 items-center gap-3 rounded-[10px] text-left focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none"
                title={item.name}
              >
                <KindTile kind={kind} system={system} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-[var(--foreground)]">{item.name}</span>
                  {sub || size ? (
                    <span className="block truncate text-[11.5px] text-[var(--muted)]">
                      <span className="sm:hidden">{[size, sub].filter(Boolean).join(' · ')}</span>
                      <span className="hidden sm:inline">{sub}</span>
                    </span>
                  ) : null}
                </span>
                {busyKeys.has(key) ? <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" /> : null}
              </button>
              <span className="hidden truncate text-right text-[12.5px] text-[var(--muted-strong)] tabular-nums sm:block">{size}</span>
              <span className="hidden truncate text-[12.5px] text-[var(--muted-strong)] sm:block">
                {item.updatedAt ? formatShortDateTime(item.updatedAt, locale) : '—'}
              </span>
              <button
                type="button"
                aria-label={t('files.menu.label', 'Actions for “{{name}}”', { name: item.name })}
                aria-haspopup="menu"
                aria-expanded={menuKey === key}
                onClick={(event) => onMenu(item, { rect: event.currentTarget.getBoundingClientRect() })}
                className="grid h-8 w-8 place-items-center rounded-[9px] text-[var(--muted)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
              >
                <DotsThreeIcon size={18} weight="bold" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Tri-state "select all" box drawn like the app checkbox (the shared one has no indeterminate look). */
export function SelectAllBox({ checked, mixed, onToggle, label }: { checked: boolean; mixed: boolean; onToggle: () => void; label: string }) {
  const on = checked || mixed
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked ? true : mixed ? 'mixed' : false}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={cn(
        'grid h-4 w-4 shrink-0 place-items-center rounded-[6px] border-[1.6px] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none',
        on ? 'border-transparent bg-[var(--checkbox-on,var(--lime))] text-[var(--lime-ink)]' : 'border-[var(--control-border)] bg-[var(--surface)]',
      )}
    >
      {checked ? <CheckIcon size={11} weight="bold" /> : mixed ? <MinusIcon size={11} weight="bold" /> : null}
    </button>
  )
}
