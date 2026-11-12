import { useEffect, useState, useSyncExternalStore } from 'react'
import { ArrowClockwiseIcon, CaretDownIcon, CaretUpIcon, CheckCircleIcon, CloudArrowUpIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { getApiErrorStatus } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { extensionOf } from '../../../shared/api/services/fileManager.service'
import { fileKind, formatBytes, type Translate } from '../lib/items'
import type { UploadItem, UploadQueue } from '../lib/uploadQueue'
import { KindTile } from './KindIcon'

function failureText(item: UploadItem, t: Translate) {
  const status = getApiErrorStatus(item.error)
  if (status === 413) return t('files.error.too_large', 'The file is too large for the server')
  if (status === 403) return t('files.error.forbidden', 'You do not have permission for this action')
  if (status === 404) return t('files.upload.folder_missing', 'The folder no longer exists')
  if (status === 409) return t('files.error.conflict', 'An item with this name already exists here')
  if (status === 422) return t('files.error.invalid', 'The request has invalid data')
  if (status === 0) return t('files.error.network', 'Network error — check the connection')
  return t('files.upload.error_generic', 'Upload failed')
}

/** Floating card (bottom right; full width on phones) with every upload of this visit and its progress. */
export function UploadPanel({ queue }: { queue: UploadQueue }) {
  const { t } = useLocale()
  const items = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot)
  const [collapsed, setCollapsed] = useState(false)
  const active = items.filter((item) => item.status === 'queued' || item.status === 'uploading')
  const failed = items.filter((item) => item.status === 'error').length
  const done = items.filter((item) => item.status === 'done').length
  const isActive = active.length > 0

  // Leaving the page while files are still uploading would drop them.
  useEffect(() => {
    if (!isActive) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isActive])

  if (!items.length) return null

  const totalBytes = active.reduce((sum, item) => sum + (item.total || item.file.size), 0)
  const loadedBytes = active.reduce((sum, item) => sum + Math.min(item.loaded, item.total || item.file.size), 0)
  const percent = totalBytes ? Math.round((loadedBytes / totalBytes) * 100) : 0

  const title = isActive
    ? t('files.upload.progress_title', 'Uploading {{count}} files…', { count: active.length })
    : failed
      ? t('files.upload.done_with_errors', '{{done}} uploaded, {{failed}} failed', { done, failed })
      : t('files.upload.done_title', '{{count}} files uploaded', { count: done })

  return (
    <section
      aria-label={t('files.upload.panel', 'Uploads')}
      className="fx-upload-panel fixed inset-x-3 bottom-[76px] z-[90] overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--elev-xl)] sm:inset-x-auto sm:right-10 sm:bottom-[84px] sm:w-[380px]"
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <span className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-[11px]',
          isActive ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : failed ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]' : 'bg-[var(--success-dim)] text-[var(--success-text)]',
        )}>
          {isActive ? <CloudArrowUpIcon size={19} weight="duotone" /> : failed ? <WarningCircleIcon size={19} weight="duotone" /> : <CheckCircleIcon size={19} weight="duotone" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-[var(--foreground)]" aria-live="polite">{title}</p>
          {isActive ? (
            <div className="flex items-center gap-2">
              <p className="min-w-0 truncate text-[11.5px] text-[var(--muted)] tabular-nums">{percent}% · {formatBytes(loadedBytes) || '0 B'} / {formatBytes(totalBytes)}</p>
              <button type="button" onClick={() => queue.cancelAll()} className="-my-0.5 ml-auto shrink-0 rounded-[7px] px-1.5 py-0.5 text-[11.5px] font-semibold text-[var(--danger-text)] hover:bg-[var(--danger-dim)]">
                {t('files.upload.cancel_all', 'Cancel all')}
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('files.upload.expand', 'Show uploads') : t('files.upload.collapse', 'Hide the list')}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
        >
          {collapsed ? <CaretUpIcon size={15} weight="bold" /> : <CaretDownIcon size={15} weight="bold" />}
        </button>
        {!isActive ? (
          <button
            type="button"
            onClick={() => queue.clearFinished()}
            aria-label={t('files.close', 'Close')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
          >
            <XIcon size={15} weight="bold" />
          </button>
        ) : null}
      </header>

      {isActive ? (
        <div className="h-1 bg-[var(--track)]">
          <div className="fm-progress-bar h-full bg-[var(--primary)]" style={{ width: `${percent}%` }} />
        </div>
      ) : null}

      {!collapsed ? (
        <ul className="max-h-[min(320px,45vh)] divide-y divide-[var(--border)] overflow-y-auto border-t border-[var(--border)]">
          {items.map((item) => {
            const itemPercent = item.total ? Math.min(100, Math.round((item.loaded / item.total) * 100)) : 0
            const kind = fileKind(extensionOf(item.file.name), item.file.type)
            return (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <KindTile kind={kind} extension={extensionOf(item.file.name)} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-[var(--foreground)]" title={item.file.name}>{item.file.name}</p>
                  {item.status === 'uploading' ? (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--track)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={itemPercent} aria-label={item.file.name}>
                        <div className="fm-progress-bar h-full rounded-full bg-[var(--primary)]" style={{ width: `${itemPercent}%` }} />
                      </div>
                      <span className="w-9 text-right text-[11px] font-medium text-[var(--muted)] tabular-nums">{itemPercent}%</span>
                    </div>
                  ) : (
                    <p className={cn(
                      'truncate text-[11.5px]',
                      item.status === 'error' ? 'text-[var(--danger-text)]' : item.status === 'done' ? 'text-[var(--success-text)]' : 'text-[var(--muted)]',
                    )}>
                      {item.status === 'queued'
                        ? t('files.upload.queued', 'Waiting… · {{folder}}', { folder: item.folderName })
                        : item.status === 'done'
                          ? t('files.upload.done_one', 'Uploaded to {{folder}}', { folder: item.folderName })
                          : item.status === 'cancelled'
                            ? t('files.upload.cancelled', 'Cancelled')
                            : failureText(item, t)}
                    </p>
                  )}
                </div>
                {item.status === 'queued' || item.status === 'uploading' ? (
                  <button type="button" onClick={() => queue.cancel(item.id)} aria-label={t('files.upload.cancel_one', 'Cancel upload')} title={t('files.upload.cancel_one', 'Cancel upload')} className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
                    <XIcon size={13} weight="bold" />
                  </button>
                ) : item.status === 'error' || item.status === 'cancelled' ? (
                  <button type="button" onClick={() => queue.retry(item.id)} aria-label={t('files.retry', 'Try again')} title={t('files.retry', 'Try again')} className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
                    <ArrowClockwiseIcon size={14} weight="bold" />
                  </button>
                ) : (
                  <CheckCircleIcon size={18} weight="fill" className="shrink-0 text-[var(--success-text)]" />
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
