import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { telephonyService } from '../../../shared/api/services/telephony.service'

/** Call recording player — styled for the macOS Phone inspector (uses --mp-* tokens). */
export function RecordingPlayer({ callId }: { callId: number }) {
  const { t } = useLocale()
  const [url, setUrl] = useState<string | null>(null)
  const [extension, setExtension] = useState('webm')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void telephonyService.recording(callId).then((blob) => {
      if (active) {
        setExtension(blob.type.includes('mpeg') ? 'mp3' : blob.type.includes('wav') ? 'wav' : blob.type.includes('ogg') ? 'ogg' : 'webm')
        setUrl(URL.createObjectURL(blob))
      }
    }).catch((cause: unknown) => { if (active) setError(getApiErrorMessage(cause)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [callId])

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  if (loading) return <p className="text-[13px] text-[var(--mp-glass-secondary)]">{t('telephony.recording_loading', 'Loading recording…')}</p>
  if (error) return <p role="alert" className="text-[13px] text-[var(--mp-red)]">{error}</p>
  if (!url) return null

  return (
    <div className="flex items-center gap-2">
      <audio className="h-9 min-w-0 flex-1" src={url} controls preload="metadata" />
      <a
        href={url}
        download={`call-${callId}.${extension}`}
        title={t('telephony.recording_download', 'Download recording')}
        aria-label={t('telephony.recording_download', 'Download recording')}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--mp-glass-strong)] text-[var(--mp-glass-text)] transition-colors hover:text-[var(--mp-blue)]"
      >
        <Download size={15} aria-hidden="true" />
      </a>
    </div>
  )
}
