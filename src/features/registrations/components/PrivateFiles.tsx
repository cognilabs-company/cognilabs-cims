import { useEffect, useState } from 'react'
import { DownloadSimpleIcon, EyeIcon, FileIcon, FilePdfIcon, ImageIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { registrationsService, type RegistrationFile } from '../../../shared/api/services/registrations.service'
import { useToast } from '../../../shared/toast/useToast'
import { Dialog } from '../../../shared/ui/dialog'
import { errorStatus } from '../lib/errors'
import { formatBytes } from '../lib/values'

/*
 * Uploaded files are private: every byte is fetched with the bearer token (requestBlob) and shown
 * through object URLs — never a raw URL in <img src> / <a href>.
 * Only images (in an <img>) and PDFs are previewed; anything else is downloaded, so an uploaded
 * HTML / SVG file can never run inside the app's origin.
 */

const iconAction =
  'grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)] disabled:opacity-60'

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|avif|heic|svg)$/i

function isImage(file: RegistrationFile) {
  return (file.content_type ?? '').startsWith('image/') || IMAGE_EXT.test(file.name)
}

function isPdf(file: RegistrationFile) {
  return file.content_type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** An authenticated thumbnail. */
function PrivateImage({ file, onOpen }: { file: RegistrationFile; onOpen: (url: string) => void }) {
  const { t } = useLocale()
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false })

  useEffect(() => {
    const path = file.preview_path ?? file.download_path
    if (!path) return
    let alive = true
    let created: string | null = null
    registrationsService.fileBlob(path)
      .then((blob) => {
        if (!alive) return
        created = URL.createObjectURL(blob.type.startsWith('image/') ? blob : new Blob([blob], { type: file.content_type ?? 'image/jpeg' }))
        setState({ url: created, failed: false })
      })
      .catch(() => { if (alive) setState({ url: null, failed: true }) })
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [file.content_type, file.download_path, file.preview_path])

  const missing = !file.preview_path && !file.download_path
  return (
    <button
      type="button"
      onClick={() => state.url && onOpen(state.url)}
      disabled={!state.url}
      aria-label={t('registrations.files.preview_named', 'Preview {{name}}', { name: file.name })}
      className="group/img relative block aspect-square w-full overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--muted-surface)]"
    >
      {state.url ? (
        <img src={state.url} alt={file.name} className="h-full w-full object-cover transition-transform duration-300 group-hover/img:scale-[1.03]" />
      ) : state.failed || missing ? (
        <span className="grid h-full w-full place-items-center text-[var(--danger-text)]"><WarningCircleIcon size={22} /></span>
      ) : (
        <span className="skeleton block h-full w-full" />
      )}
    </button>
  )
}

export function PrivateFiles({ files }: { files: RegistrationFile[] }) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)
  const images = files.filter(isImage)
  const others = files.filter((file) => !isImage(file))

  function failed(error: unknown) {
    const status = errorStatus(error)
    showToast({
      title: status === 404 ? t('registrations.files.missing', 'The file was not found') : t('registrations.files.failed', 'Could not load the file'),
      tone: 'error',
    })
  }

  async function download(file: RegistrationFile) {
    const path = file.download_path ?? file.preview_path
    if (!path) return
    setBusy(`d:${file.uid}`)
    try {
      saveBlob(await registrationsService.fileBlob(path), file.name)
    } catch (error) {
      failed(error)
    } finally {
      setBusy(null)
    }
  }

  /** PDFs open in a new tab as an object URL typed application/pdf. */
  async function previewPdf(file: RegistrationFile) {
    const path = file.preview_path ?? file.download_path
    if (!path) return
    // Opened synchronously (inside the click) so the browser does not block it as a popup.
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    setBusy(`p:${file.uid}`)
    try {
      const blob = await registrationsService.fileBlob(path)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      if (tab) tab.location.href = url
      else window.open(url, '_blank', 'noopener')
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
    } catch (error) {
      tab?.close()
      failed(error)
    } finally {
      setBusy(null)
    }
  }

  if (!files.length) return <span className="text-[13px] text-[var(--caption)]">{t('registrations.applications.no_files', 'No files')}</span>

  return (
    <div className="flex flex-col gap-2">
      {images.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((file) => (
            <li key={file.uid} className="flex min-w-0 flex-col gap-1">
              <PrivateImage file={file} onOpen={(url) => setLightbox({ url, name: file.name })} />
              <span className="flex min-w-0 items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--muted)]" title={file.name} data-i18n-skip="true">{file.name}</span>
                <button
                  type="button"
                  onClick={() => void download(file)}
                  disabled={busy === `d:${file.uid}`}
                  aria-label={t('registrations.files.download_named', 'Download {{name}}', { name: file.name })}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)] disabled:opacity-40"
                >
                  <DownloadSimpleIcon size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {others.length ? (
        <ul className="flex flex-col gap-1.5">
          {others.map((file) => (
            <li key={file.uid} className="flex min-w-0 items-center gap-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--blue-dim)] text-[var(--primary)]">
                {isPdf(file) ? <FilePdfIcon size={18} weight="duotone" /> : <FileIcon size={18} weight="duotone" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[var(--foreground)]" title={file.name} data-i18n-skip="true">{file.name}</span>
                <span className="block text-[11.5px] text-[var(--muted)] tabular-nums">{file.size != null ? formatBytes(file.size) : file.content_type ?? ''}</span>
              </span>
              {isPdf(file) ? (
                <button
                  type="button"
                  onClick={() => void previewPdf(file)}
                  disabled={busy === `p:${file.uid}`}
                  title={t('registrations.files.preview', 'Preview')}
                  aria-label={t('registrations.files.preview_named', 'Preview {{name}}', { name: file.name })}
                  className={iconAction}
                >
                  {busy === `p:${file.uid}` ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <EyeIcon size={16} />}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void download(file)}
                disabled={busy === `d:${file.uid}`}
                title={t('registrations.files.download', 'Download')}
                aria-label={t('registrations.files.download_named', 'Download {{name}}', { name: file.name })}
                className={iconAction}
              >
                {busy === `d:${file.uid}` ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <DownloadSimpleIcon size={16} />}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog
        open={lightbox !== null}
        onClose={() => setLightbox(null)}
        title={lightbox?.name ?? ''}
        size="xl"
        headerIcon={<ImageIcon />}
      >
        {lightbox ? (
          <div className="grid place-items-center rounded-[12px] bg-[var(--muted-surface)] p-2">
            <img src={lightbox.url} alt={lightbox.name} className="max-h-[70vh] w-auto max-w-full rounded-[8px] object-contain" />
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}
