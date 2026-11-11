import { useState, type DragEvent } from 'react'
import { CloudArrowUpIcon, FileIcon, FilePdfIcon, ImageIcon, PaperclipIcon, XIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { REGISTRATION_MAX_FILE_BYTES } from '../../../shared/api/services/registrations.service'
import { cn } from '../../../shared/lib/cn'
import { formatBytes, type PickedFile } from '../lib/values'

type FilePickerProps = {
  id: string
  kind: 'file' | 'image'
  accept: string[]
  files: PickedFile[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  /** Names of files kept from an earlier (rejected) application. */
  keptFiles?: string[]
  invalid?: boolean
  disabled?: boolean
  describedBy?: string
}

function acceptLabel(accept: string[], imagesLabel: string, anyLabel: string) {
  if (!accept.length) return anyLabel
  const parts = accept.map((token) => {
    if (token === 'image/*') return imagesLabel
    if (token.startsWith('.')) return token.slice(1).toUpperCase()
    return token
  })
  return [...new Set(parts)].join(', ')
}

function FileGlyph({ name, size = 18 }: { name: string; size?: number }) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return <FilePdfIcon size={size} weight="duotone" />
  if (/\.(png|jpe?g|webp|gif|heic|bmp|svg)$/.test(lower)) return <ImageIcon size={size} weight="duotone" />
  return <FileIcon size={size} weight="duotone" />
}

/** Drop zone + chosen files (thumbnails for images). Several files per field are allowed. */
export function FilePicker({ id, kind, accept, files, onAdd, onRemove, keptFiles = [], invalid, disabled, describedBy }: FilePickerProps) {
  const { t } = useLocale()
  const [dragging, setDragging] = useState(false)

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    const dropped = Array.from(event.dataTransfer.files ?? [])
    if (dropped.length) onAdd(dropped)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <label
        htmlFor={id}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'group/drop flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed px-4 py-5 text-center transition-colors',
          dragging ? 'border-[var(--primary)] bg-[var(--blue-dim)]' : 'border-[var(--border-hover)] bg-[var(--input-surface)] hover:border-[var(--primary)]',
          invalid && !dragging && 'border-[var(--danger)]',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[var(--surface)] text-[var(--primary)] shadow-[var(--elev-sm)] transition-transform group-hover/drop:-translate-y-0.5">
          {kind === 'image' ? <ImageIcon size={20} weight="duotone" /> : <CloudArrowUpIcon size={20} weight="duotone" />}
        </span>
        <span className="text-[13px] text-[var(--muted-strong)]">
          <span className="font-semibold text-[var(--primary)]">{kind === 'image' ? t('registrations.form.choose_images', 'Choose images') : t('registrations.form.choose_files', 'Choose files')}</span>{' '}
          {t('registrations.form.or_drag', 'or drag them here')}
        </span>
        <span className="text-[11.5px] text-[var(--muted)]">
          {acceptLabel(accept, t('registrations.form.accept_images', 'Images'), t('registrations.form.accept_any', 'Any file'))} · {t('registrations.form.max_each', 'up to {{size}} each', { size: formatBytes(REGISTRATION_MAX_FILE_BYTES) })}
        </span>
        <input
          id={id}
          type="file"
          multiple
          accept={accept.join(',') || undefined}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="sr-only"
          onChange={(event) => {
            const chosen = Array.from(event.target.files ?? [])
            if (chosen.length) onAdd(chosen)
            event.target.value = ''
          }}
        />
      </label>

      {kind === 'image' && files.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((item) => (
            <li key={item.id} className="group/thumb relative overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--muted-surface)]">
              {item.preview ? (
                <img src={item.preview} alt={item.file.name} className="aspect-square w-full object-cover" />
              ) : (
                <span className="grid aspect-square w-full place-items-center text-[var(--muted)]"><ImageIcon size={24} /></span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-[10.5px] font-medium text-white" data-i18n-skip="true">
                {formatBytes(item.file.size)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                disabled={disabled}
                aria-label={t('registrations.form.remove_file', 'Remove {{name}}', { name: item.file.name })}
                className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
              >
                <XIcon size={13} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {kind === 'file' && files.length ? (
        <ul className="flex flex-col gap-1.5">
          {files.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[var(--blue-dim)] text-[var(--primary)]"><FileGlyph name={item.file.name} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[var(--foreground)]" data-i18n-skip="true">{item.file.name}</span>
                <span className="block text-[11.5px] text-[var(--muted)] tabular-nums">{formatBytes(item.file.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                disabled={disabled}
                aria-label={t('registrations.form.remove_file', 'Remove {{name}}', { name: item.file.name })}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[var(--muted)] transition-colors hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]"
              >
                <XIcon size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {keptFiles.length && files.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--muted-surface)] px-3 py-2.5">
          <p className="text-[12px] font-semibold text-[var(--muted-strong)]">{t('registrations.form.kept_files', 'Already uploaded — choose new files only to replace them')}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {keptFiles.map((name, index) => (
              <li key={`${name}-${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[12px] text-[var(--foreground)] ring-1 ring-[var(--border)]">
                <PaperclipIcon size={12} className="shrink-0 text-[var(--muted)]" />
                <span className="truncate" data-i18n-skip="true">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
