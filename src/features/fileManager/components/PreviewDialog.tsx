import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  CaretLeftIcon,
  CaretRightIcon,
  DownloadSimpleIcon,
  EyeSlashIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { fileManagerService, type FmDocBlock, type FmFile, type FmPreview, type FmSheet } from '../../../shared/api/services/fileManager.service'
import { getApiErrorStatus } from '../../../shared/lib/api-error'
import { formatShortDateTime } from '../../../shared/lib/format'
import { cn } from '../../../shared/lib/cn'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { BrandLoader } from '../../../shared/ui/loader'
import { columnName, parseCsv } from '../lib/csv'
import { formatBytes, isAbortError, kindOf, previewNeighbours } from '../lib/items'
import { KindIcon } from './KindIcon'

type BodyState =
  | { status: 'loading' }
  | { status: 'ready'; preview: FmPreview; url: string | null }
  | { status: 'error'; error: unknown }

function isTyping(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

/** Preview of one file, with ← / → through the files of the current listing. */
export function PreviewDialog({
  file,
  files,
  canDownload,
  downloading,
  onNavigate,
  onDownload,
  onClose,
}: {
  file: FmFile
  files: FmFile[]
  canDownload: boolean
  downloading: boolean
  onNavigate: (file: FmFile) => void
  onDownload: (file: FmFile) => void
  onClose: () => void
}) {
  const { t, locale } = useLocale()
  const { previous, next, index } = previewNeighbours(files, file.id)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'ArrowLeft' && previous) onNavigate(previous)
      if (event.key === 'ArrowRight' && next) onNavigate(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, onNavigate, previous])

  const meta = [
    file.extension ? file.extension.toUpperCase() : null,
    formatBytes(file.size) || null,
    file.updatedAt ? formatShortDateTime(file.updatedAt, locale) : null,
  ].filter(Boolean).join(' · ')

  return (
    <Dialog
      open
      onClose={onClose}
      title={file.name}
      description={meta}
      headerIcon={<KindIcon kind={kindOf(file)} size={18} />}
      size="xl"
      className="sm:max-w-[min(1080px,94vw)]"
      footer={(
        <>
          {files.length > 1 && index >= 0 ? (
            <div className="mr-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" aria-label={t('files.preview.previous', 'Previous file')} title={t('files.preview.previous', 'Previous file')} disabled={!previous} onClick={() => previous && onNavigate(previous)}>
                <CaretLeftIcon size={15} weight="bold" />
              </Button>
              <span className="min-w-[52px] text-center text-[12px] font-medium text-[var(--muted)] tabular-nums">{index + 1} / {files.length}</span>
              <Button variant="ghost" size="sm" aria-label={t('files.preview.next', 'Next file')} title={t('files.preview.next', 'Next file')} disabled={!next} onClick={() => next && onNavigate(next)}>
                <CaretRightIcon size={15} weight="bold" />
              </Button>
            </div>
          ) : null}
          <Button variant="ghost" onClick={onClose}>{t('files.close', 'Close')}</Button>
          {canDownload ? (
            <Button leftIcon={<DownloadSimpleIcon size={15} weight="bold" />} loading={downloading} onClick={() => onDownload(file)}>
              {t('files.download', 'Download')}
            </Button>
          ) : null}
        </>
      )}
    >
      {/* Document content is shown as it is — never through the DOM literal translator. */}
      <div data-i18n-skip="true">
        <PreviewBody key={file.id} file={file} canDownload={canDownload} onDownload={() => onDownload(file)} />
      </div>
    </Dialog>
  )
}

function PreviewBody({ file, canDownload, onDownload }: { file: FmFile; canDownload: boolean; onDownload: () => void }) {
  const { t } = useLocale()
  const [state, setState] = useState<BodyState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const kind = kindOf(file)

  useEffect(() => {
    let alive = true
    let url: string | null = null
    const controller = new AbortController()
    fileManagerService.preview(file.id, controller.signal)
      .then((preview) => {
        if (!alive) return
        if (preview.type === 'binary') {
          // Chrome only renders a PDF blob URL when the blob says it is a PDF.
          const blob = kind === 'pdf' && !preview.blob.type.includes('pdf') ? new Blob([preview.blob], { type: 'application/pdf' }) : preview.blob
          url = URL.createObjectURL(blob)
        }
        setState({ status: 'ready', preview, url })
      })
      .catch((error: unknown) => {
        if (alive && !isAbortError(error)) setState({ status: 'error', error })
      })
    return () => {
      alive = false
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [attempt, file.id, kind])

  if (state.status === 'loading') {
    return (
      <div role="status" className="grid min-h-[320px] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <BrandLoader size={22} />
          <p className="loading-text text-[13px] font-medium">{t('files.preview.loading', 'Opening the file…')}</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    const status = getApiErrorStatus(state.error)
    return (
      <Notice
        tone="error"
        title={status === 404
          ? t('files.preview.not_found', 'This file no longer exists')
          : status === 403
            ? t('files.error.forbidden', 'You do not have permission for this action')
            : t('files.preview.failed', 'Could not open the file')}
        action={status === 404 || status === 403 ? null : (
          <Button variant="secondary" size="sm" leftIcon={<ArrowClockwiseIcon size={14} />} onClick={() => { setState({ status: 'loading' }); setAttempt((value) => value + 1) }}>
            {t('files.retry', 'Try again')}
          </Button>
        )}
      />
    )
  }

  const { preview, url } = state
  const truncatedNote = (
    <p className="mb-3 rounded-[10px] bg-[var(--warning-dim)] px-3 py-2 text-[12.5px] font-medium text-[var(--warning-text)]">
      {t('files.preview.truncated', 'Only the beginning of the file is shown — download it to see everything.')}
    </p>
  )

  if (preview.type === 'unsupported' || (preview.type === 'binary' && !url)) {
    return <Unsupported canDownload={canDownload} onDownload={onDownload} />
  }

  if (preview.type === 'binary' && url) {
    const type = preview.contentType || preview.blob.type
    const isImage = type.startsWith('image/') || (kind === 'image' && !type.includes('pdf'))
    const isPdf = type.includes('pdf') || kind === 'pdf'
    if (!isImage && !isPdf) return <Unsupported canDownload={canDownload} onDownload={onDownload} />
    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-end">
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12.5px] font-semibold text-[var(--blue-text)] hover:bg-[var(--blue-dim)]">
            <ArrowSquareOutIcon size={14} weight="bold" />
            {t('files.preview.open_tab', 'Open in a new tab')}
          </a>
        </div>
        {isImage ? (
          <div className="grid min-h-[240px] place-items-center rounded-[14px] bg-[var(--muted-surface)] p-2">
            <img src={url} alt={file.name} className="max-h-[68vh] max-w-full rounded-[8px] object-contain" />
          </div>
        ) : (
          <iframe src={url} title={file.name} className="h-[68vh] w-full rounded-[12px] border border-[var(--border)] bg-[var(--muted-surface)]" />
        )}
      </div>
    )
  }

  if (preview.type === 'text') {
    const isCsv = preview.format === 'csv' || file.extension === 'csv'
    return (
      <div>
        {preview.truncated ? truncatedNote : null}
        {isCsv ? (
          <CsvTable content={preview.content} />
        ) : preview.content.trim() ? (
          <pre className="max-h-[66vh] overflow-auto rounded-[12px] border border-[var(--border)] bg-[var(--muted-surface)] p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words text-[var(--foreground)]">
            {preview.content}
          </pre>
        ) : (
          <Notice title={t('files.preview.empty', 'The file is empty')} />
        )}
      </div>
    )
  }

  if (preview.type === 'docx') {
    return (
      <div>
        {preview.truncated ? truncatedNote : null}
        {preview.blocks.length ? <DocBlocks blocks={preview.blocks} /> : <Notice title={t('files.preview.empty', 'The file is empty')} />}
      </div>
    )
  }

  if (preview.type === 'xlsx') {
    return (
      <div>
        {preview.truncated ? truncatedNote : null}
        {preview.sheets.length ? <Sheets sheets={preview.sheets} /> : <Notice title={t('files.preview.empty', 'The file is empty')} />}
      </div>
    )
  }

  return <Unsupported canDownload={canDownload} onDownload={onDownload} />
}

function Notice({ title, text, tone = 'muted', action }: { title: string; text?: string; tone?: 'muted' | 'error'; action?: ReactNode }) {
  return (
    <div className="grid min-h-[280px] place-items-center p-4 text-center">
      <div className="max-w-sm">
        <span className={cn('mx-auto grid h-14 w-14 place-items-center rounded-[16px]', tone === 'error' ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]' : 'bg-[var(--muted-surface)] text-[var(--muted)]')}>
          {tone === 'error' ? <WarningCircleIcon size={28} weight="duotone" /> : <EyeSlashIcon size={28} weight="duotone" />}
        </span>
        <p className="mt-3.5 text-[15px] font-bold text-[var(--foreground)]">{title}</p>
        {text ? <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">{text}</p> : null}
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  )
}

function Unsupported({ canDownload, onDownload }: { canDownload: boolean; onDownload: () => void }) {
  const { t } = useLocale()
  return (
    <Notice
      title={t('files.preview.unavailable', 'Preview is not available for this file')}
      text={canDownload ? t('files.preview.unavailable_text', 'Download the file to open it on your device.') : undefined}
      action={canDownload ? (
        <Button leftIcon={<DownloadSimpleIcon size={15} weight="bold" />} onClick={onDownload}>{t('files.download', 'Download')}</Button>
      ) : null}
    />
  )
}

const tableClass = 'w-full border-collapse text-[12.5px] text-[var(--foreground)]'
const cellClass = 'border border-[var(--border)] px-2.5 py-1.5 align-top whitespace-pre-wrap'

function CsvTable({ content }: { content: string }) {
  const rows = useMemo(() => parseCsv(content), [content])
  const { t } = useLocale()
  if (!rows.length) return <Notice title={t('files.preview.empty', 'The file is empty')} />
  const [head, ...body] = rows
  return (
    <div className="max-h-[66vh] overflow-auto rounded-[12px] border border-[var(--border)]">
      <table className={tableClass}>
        <thead className="sticky top-0 bg-[var(--muted-surface)]">
          <tr>{head.map((cell, index) => <th key={index} className={cn(cellClass, 'text-left font-semibold')}>{cell}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex} className="even:bg-[var(--row-zebra)]">
              {row.map((cell, index) => <td key={index} className={cellClass}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DocBlocks({ blocks }: { blocks: FmDocBlock[] }) {
  return (
    <article className="mx-auto max-h-[66vh] max-w-[760px] overflow-auto rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-6 py-5 text-[13.5px] leading-relaxed text-[var(--foreground)]">
      {blocks.map((block, index) => {
        if (block.type === 'table') {
          return (
            <div key={index} className="my-3 overflow-x-auto">
              <table className={tableClass}>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? 'bg-[var(--muted-surface)] font-semibold' : undefined}>
                      {row.map((cell, cellIndex) => <td key={cellIndex} className={cellClass}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        if (!block.text.trim()) return <div key={index} className="h-3" aria-hidden="true" />
        const level = block.level ?? (/title/i.test(block.style ?? '') ? 1 : null)
        if (level !== null && level <= 1) return <h3 key={index} className="mt-4 mb-2 text-[19px] font-bold tracking-[-0.01em] first:mt-0">{block.text}</h3>
        if (level === 2) return <h4 key={index} className="mt-4 mb-1.5 text-[16px] font-bold first:mt-0">{block.text}</h4>
        if (level !== null) return <h5 key={index} className="mt-3 mb-1 text-[14px] font-semibold first:mt-0">{block.text}</h5>
        if (/list/i.test(block.style ?? '')) {
          return (
            <p key={index} className="my-1 flex gap-2 pl-1 whitespace-pre-wrap">
              <span aria-hidden="true" className="text-[var(--muted)]">•</span>
              <span className="min-w-0">{block.text}</span>
            </p>
          )
        }
        return <p key={index} className="my-1.5 whitespace-pre-wrap">{block.text}</p>
      })}
    </article>
  )
}

function Sheets({ sheets }: { sheets: FmSheet[] }) {
  const { t } = useLocale()
  const [active, setActive] = useState(0)
  const sheet = sheets[Math.min(active, sheets.length - 1)]
  const width = sheet.rows.reduce((max, row) => Math.max(max, row.length), 0)

  return (
    <div className="flex flex-col gap-2">
      {sheets.length > 1 ? (
        <div role="tablist" className="flex gap-1 overflow-x-auto pb-0.5">
          {sheets.map((item, index) => (
            <button
              key={`${item.name}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              onClick={() => setActive(index)}
              className={cn(
                'h-8 shrink-0 rounded-[9px] px-3 text-[12.5px] font-semibold transition-colors',
                index === active ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'text-[var(--muted-strong)] hover:bg-[var(--input-surface)]',
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      {sheet.truncated || (sheet.totalRows !== null && sheet.totalRows > sheet.rows.length) ? (
        <p className="text-[12px] text-[var(--muted)]">
          {t('files.preview.rows_shown', 'Showing {{shown}} of {{total}} rows', { shown: sheet.rows.length, total: sheet.totalRows ?? '…' })}
        </p>
      ) : null}
      {sheet.rows.length === 0 ? (
        <Notice title={t('files.preview.sheet_empty', 'This sheet is empty')} />
      ) : (
        <div className="max-h-[62vh] overflow-auto rounded-[12px] border border-[var(--border)]">
          <table className={tableClass}>
            <thead className="sticky top-0 z-[1] bg-[var(--muted-surface)]">
              <tr>
                <th className={cn(cellClass, 'w-10 text-center text-[11px] font-semibold text-[var(--muted)]')} />
                {Array.from({ length: width }, (_, index) => (
                  <th key={index} className={cn(cellClass, 'min-w-[72px] text-center text-[11px] font-semibold text-[var(--muted)]')}>{columnName(index)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className={cn(cellClass, 'bg-[var(--muted-surface)] text-center text-[11px] font-semibold text-[var(--muted)] tabular-nums')}>{rowIndex + 1}</td>
                  {Array.from({ length: width }, (_, index) => (
                    <td key={index} className={cn(cellClass, /^-?[\d\s.,%]+$/.test(row[index] ?? '') && 'text-right tabular-nums')}>{row[index] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
