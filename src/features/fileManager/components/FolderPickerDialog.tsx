import { useEffect, useState, type ReactNode } from 'react'
import { ArrowClockwiseIcon, CaretRightIcon, FolderIcon, HouseIcon, LockSimpleIcon, ProhibitIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { fileManagerService, type FmBrowseResult } from '../../../shared/api/services/fileManager.service'
import { cn } from '../../../shared/lib/cn'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { Skeleton } from '../../../shared/ui/skeleton'
import { ItemGlyph } from './ItemGlyph'

export type PickedFolder = { id: string | null; name: string }

/**
 * Browse folders and pick one (Move to…, or where an upload goes).
 * `blockedIds`: folders being moved — they and everything inside them cannot be the target.
 * `sourceParentIds`: where the items are now — picking the same place again is a no-op.
 */
export function FolderPickerDialog({
  title,
  description,
  confirmLabel,
  icon,
  startFolderId,
  allowRoot,
  blockedIds = [],
  sourceParentIds = [],
  onConfirm,
  onClose,
}: {
  title: string
  description?: string
  confirmLabel: string
  icon: ReactNode
  startFolderId: string | null
  allowRoot: boolean
  blockedIds?: string[]
  sourceParentIds?: (string | null)[]
  onConfirm: (target: PickedFolder) => Promise<void> | void
  onClose: () => void
}) {
  const { t } = useLocale()
  const rootName = t('files.root', 'All files')
  const [folderId, setFolderId] = useState<string | null>(blockedIds.includes(startFolderId ?? '') ? null : startFolderId)
  const [reload, setReload] = useState(0)
  const [state, setState] = useState<{ key: string; data: FmBrowseResult | null; failed: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const key = `${folderId ?? 'root'}:${reload}`

  useEffect(() => {
    let alive = true
    fileManagerService.browse({ folderId, page: 1, pageSize: 1 })
      .then((data) => { if (alive) setState({ key, data, failed: false }) })
      .catch(() => { if (alive) setState({ key, data: null, failed: true }) })
    return () => { alive = false }
  }, [folderId, key])

  const ready = state?.key === key ? state : null
  const crumbs = ready?.data?.breadcrumbs ?? []
  const blocked = new Set(blockedIds)
  const insideBlocked = folderId !== null && (blocked.has(folderId) || crumbs.some((crumb) => blocked.has(crumb.id)))
  const samePlace = sourceParentIds.length > 0 && sourceParentIds.every((id) => (id ?? null) === folderId)
  const targetName = folderId === null ? rootName : crumbs[crumbs.length - 1]?.name ?? ready?.data?.folder?.name ?? '…'
  const canPick = Boolean(ready?.data) && !insideBlocked && !samePlace && (folderId !== null || allowRoot)
  const reason = insideBlocked
    ? t('files.picker.inside_itself', 'A folder cannot be moved into itself')
    : samePlace
      ? t('files.picker.same_place', 'The items are already here')
      : folderId === null && !allowRoot
        ? t('files.picker.root_not_allowed', 'Open a folder — files cannot be uploaded to the top level')
        : null

  async function confirm() {
    if (!canPick || busy) return
    setBusy(true)
    try {
      await onConfirm({ id: folderId, name: targetName })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={() => { if (!busy) onClose() }}
      title={title}
      description={description}
      headerIcon={icon}
      size="lg"
      footer={(
        <>
          {reason ? <p className="mr-auto text-[12px] text-[var(--muted)]">{reason}</p> : null}
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t('files.cancel', 'Cancel')}</Button>
          <Button onClick={() => void confirm()} disabled={!canPick} loading={busy}>{confirmLabel}</Button>
        </>
      )}
    >
      {/* Folder names are user data: keep them out of the DOM literal translator. */}
      <div data-i18n-skip="true">
        <nav aria-label={t('files.breadcrumbs', 'Folder path')} className="-mx-1 mb-3 flex flex-wrap items-center gap-0.5 text-[12.5px]">
          <button
            type="button"
            onClick={() => setFolderId(null)}
            className={cn('inline-flex items-center gap-1.5 rounded-[7px] px-1.5 py-1 font-semibold transition-colors hover:bg-[var(--input-surface)]', folderId === null ? 'text-[var(--foreground)]' : 'text-[var(--muted)]')}
          >
            <HouseIcon size={14} weight="bold" />
            {rootName}
          </button>
          {crumbs.map((crumb, index) => (
            <span key={crumb.id} className="inline-flex items-center">
              <CaretRightIcon size={12} className="text-[var(--caption)]" />
              <button
                type="button"
                onClick={() => setFolderId(crumb.id)}
                className={cn('max-w-[180px] truncate rounded-[7px] px-1.5 py-1 font-semibold transition-colors hover:bg-[var(--input-surface)]', index === crumbs.length - 1 ? 'text-[var(--foreground)]' : 'text-[var(--muted)]')}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="min-h-[220px] overflow-hidden rounded-[14px] border border-[var(--border)]">
          {!ready ? (
            <div className="flex flex-col gap-2 p-3" aria-busy="true">
              {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-10 w-full" />)}
            </div>
          ) : ready.failed || !ready.data ? (
            <div className="grid min-h-[220px] place-items-center p-6 text-center">
              <div>
                <p className="text-[13.5px] font-semibold text-[var(--foreground)]">{t('files.picker.failed', 'Could not load folders')}</p>
                <Button variant="secondary" size="sm" className="mt-3" leftIcon={<ArrowClockwiseIcon size={14} />} onClick={() => setReload((value) => value + 1)}>
                  {t('files.retry', 'Try again')}
                </Button>
              </div>
            </div>
          ) : ready.data.folders.length === 0 ? (
            <div className="grid min-h-[220px] place-items-center p-6 text-center">
              <div>
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-[13px] bg-[var(--muted-surface)] text-[var(--muted)]">
                  <FolderIcon size={22} weight="duotone" />
                </span>
                <p className="mt-2.5 text-[13px] font-semibold text-[var(--foreground)]">{t('files.picker.no_subfolders', 'No folders inside')}</p>
                {canPick ? <p className="mt-0.5 text-[12px] text-[var(--muted)]">{t('files.picker.choose_here', 'You can choose this folder.')}</p> : null}
              </div>
            </div>
          ) : (
            <ul className="max-h-[46vh] divide-y divide-[var(--border)] overflow-y-auto" role="list">
              {ready.data.folders.map((folder) => {
                const isBlocked = blocked.has(folder.id)
                return (
                  <li key={folder.id}>
                    <button
                      type="button"
                      disabled={isBlocked}
                      onClick={() => setFolderId(folder.id)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--row-hover)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center text-[var(--muted)]">
                        {isBlocked ? <ProhibitIcon size={18} /> : <ItemGlyph kind="folder" size={28} system={folder.system} filled={(folder.fileCount ?? 0) + (folder.folderCount ?? 0) > 0} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[var(--foreground)]">{folder.name}</span>
                      {folder.system ? <LockSimpleIcon size={13} className="shrink-0 text-[var(--muted)]" aria-label={t('files.system_folder', 'System folder')} /> : null}
                      {!isBlocked ? <CaretRightIcon size={14} className="shrink-0 text-[var(--caption)]" /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="mt-3 text-[12px] text-[var(--muted)]">
          {t('files.picker.target', 'Destination')}: <span className="font-semibold text-[var(--foreground)]">{targetName}</span>
        </p>
      </div>
    </Dialog>
  )
}
