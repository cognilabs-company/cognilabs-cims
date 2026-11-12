import { useState, type ReactNode, type Ref } from 'react'
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CaretRightIcon,
  DotsThreeIcon,
  HardDrivesIcon,
  MagnifyingGlassIcon,
  SidebarSimpleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { FmCrumb } from '../../../shared/api/services/fileManager.service'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { cn } from '../../../shared/lib/cn'
import { dropKey, type DropHandlers, type DropTarget } from '../lib/explorer'

/** Explorer top bar: Back / Forward / Up / Refresh, the clickable path, and search. */
export function AddressBar({
  canBack,
  canForward,
  canUp,
  onBack,
  onForward,
  onUp,
  onRefresh,
  refreshing,
  crumbs,
  rootLabel,
  searchLabel,
  onGo,
  onCrumbMenu,
  onOverflowMenu,
  openMenuKey,
  getDropProps,
  dropHover,
  search,
  onSearchChange,
  searchPlaceholder,
  searchRef,
  onSearchExit,
  onToggleTree,
}: {
  canBack: boolean
  canForward: boolean
  canUp: boolean
  onBack: () => void
  onForward: () => void
  onUp: () => void
  onRefresh: () => void
  refreshing: boolean
  crumbs: FmCrumb[]
  rootLabel: string
  /** Shown as the last part while searching everywhere. */
  searchLabel: string | null
  onGo: (id: string | null) => void
  /** The › after a part lists that folder's sub-folders. */
  onCrumbMenu: (id: string | null, element: HTMLElement) => void
  /** "…" for the parts that do not fit. */
  onOverflowMenu: (hidden: FmCrumb[], element: HTMLElement) => void
  openMenuKey: string | null
  getDropProps: (target: DropTarget) => DropHandlers | null
  dropHover: string | null
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  searchRef: Ref<HTMLInputElement>
  /** Arrow down / Esc on an empty box: back to the items. */
  onSearchExit: () => void
  /** Narrow screens: opens the folder drawer. */
  onToggleTree: () => void
}) {
  const { t } = useLocale()
  const wide = useMediaQuery('(min-width: 1280px)')
  const phone = useMediaQuery('(max-width: 639px)')
  const [searchOpen, setSearchOpen] = useState(false)
  const showSearch = !phone || searchOpen || Boolean(search)
  const keep = wide ? 4 : phone ? 1 : 2
  const hidden = crumbs.length > keep ? crumbs.slice(0, crumbs.length - keep) : []
  const visible = crumbs.slice(hidden.length)

  const navButton = (label: string, shortcut: string | null, icon: ReactNode, onClick: () => void, disabled: boolean, extra?: string) => (
    <button type="button" className={cn('fx-nav-btn', extra)} onClick={onClick} disabled={disabled} aria-label={label} title={shortcut ? `${label} (${shortcut})` : label}>
      {icon}
    </button>
  )

  const crumbButton = (crumb: { id: string | null; name: string }, index: number, last: boolean) => {
    const drop = getDropProps({ id: crumb.id, name: crumb.name, ancestors: crumbs.slice(0, Math.max(0, index)).map((item) => item.id) })
    const key = dropKey(crumb.id)
    return (
      <span key={key} className="fx-crumb">
        <button
          type="button"
          className="fx-crumb__name"
          data-current={(last && !searchLabel) || undefined}
          data-drop={dropHover === key || undefined}
          onClick={() => onGo(crumb.id)}
          title={crumb.name}
          {...(drop ?? {})}
        >
          {crumb.id === null ? <HardDrivesIcon size={15} weight="duotone" className="shrink-0" /> : null}
          <span className={cn('truncate', crumb.id === null && phone && crumbs.length > 0 && 'sr-only')}>{crumb.name}</span>
        </button>
        <button
          type="button"
          className="fx-crumb__sep"
          aria-label={t('files.address.subfolders', 'Folders inside “{{name}}”', { name: crumb.name })}
          aria-haspopup="menu"
          aria-expanded={openMenuKey === key}
          data-open={openMenuKey === key || undefined}
          onClick={(event) => onCrumbMenu(crumb.id, event.currentTarget)}
        >
          <CaretRightIcon size={11} weight="bold" />
        </button>
      </span>
    )
  }

  return (
    <div className="fx-topbar">
      <div className="fx-topbar__nav">
        {navButton(t('files.tree.open', 'Folders'), null, <SidebarSimpleIcon size={17} />, onToggleTree, false, 'fx-nav-btn--tree')}
        {navButton(t('files.back', 'Back'), 'Alt+←', <ArrowLeftIcon size={16} weight="bold" />, onBack, !canBack)}
        {navButton(t('files.forward', 'Forward'), 'Alt+→', <ArrowRightIcon size={16} weight="bold" />, onForward, !canForward, 'fx-nav-btn--wide')}
        {navButton(t('files.up', 'Up to the parent folder'), 'Alt+↑', <ArrowUpIcon size={16} weight="bold" />, onUp, !canUp)}
        {navButton(t('files.refresh', 'Refresh'), 'F5', <ArrowClockwiseIcon size={16} weight="bold" className={cn(refreshing && 'fx-rotate')} />, onRefresh, false, 'fx-nav-btn--wide')}
      </div>

      <nav className="fx-address" data-hidden={(phone && (searchOpen || Boolean(search))) || undefined} aria-label={t('files.breadcrumbs', 'Folder path')}>
        {crumbButton({ id: null, name: rootLabel }, 0, crumbs.length === 0)}
        {hidden.length ? (
          <span className="fx-crumb">
            <button
              type="button"
              className="fx-crumb__name"
              aria-label={t('files.address.more', 'More folders in the path')}
              aria-haspopup="menu"
              onClick={(event) => onOverflowMenu(hidden, event.currentTarget)}
            >
              <DotsThreeIcon size={16} weight="bold" />
            </button>
            <span className="fx-crumb__sep fx-crumb__sep--static" aria-hidden="true"><CaretRightIcon size={11} weight="bold" /></span>
          </span>
        ) : null}
        {visible.map((crumb) => crumbButton(crumb, crumbs.indexOf(crumb) + 1, crumb === crumbs[crumbs.length - 1]))}
        {searchLabel ? (
          <span className="fx-crumb">
            <span className="fx-crumb__name" data-current="">
              <MagnifyingGlassIcon size={14} weight="bold" className="shrink-0" />
              <span className="truncate">{searchLabel}</span>
            </span>
          </span>
        ) : null}
      </nav>

      {showSearch ? (
        <label className={cn('fx-search', phone && 'fx-search--phone')}>
          <MagnifyingGlassIcon size={15} className="fx-search__icon" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            autoFocus={phone && searchOpen && !search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                if (search) onSearchChange('')
                else {
                  setSearchOpen(false)
                  onSearchExit()
                }
              } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
                event.preventDefault()
                onSearchExit()
              }
            }}
            onBlur={() => { if (!search) setSearchOpen(false) }}
            placeholder={searchPlaceholder}
            aria-label={t('files.search.label', 'Search files')}
            className="fx-search__input"
          />
          {search ? (
            <button type="button" className="fx-search__clear" onClick={() => onSearchChange('')} aria-label={t('files.search.clear', 'Clear search')}>
              <XIcon size={13} weight="bold" />
            </button>
          ) : null}
        </label>
      ) : (
        <button type="button" className="fx-nav-btn" onClick={() => setSearchOpen(true)} aria-label={t('files.search.label', 'Search files')} title={t('files.search.label', 'Search files')}>
          <MagnifyingGlassIcon size={17} weight="bold" />
        </button>
      )}
    </div>
  )
}
