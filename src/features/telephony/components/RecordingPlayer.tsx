import { Download } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { useRecordingUrl } from '../lib/useRecordingUrl'
import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerDurationDisplay,
  AudioPlayerElement,
  AudioPlayerPlayButton,
  AudioPlayerTimeDisplay,
  AudioPlayerTimeRange,
} from '../../../components/ai-elements/audio-player'

const looks = {
  // The macOS Phone inspector (--mp-* tokens live under .mac-phone).
  phone: {
    loading: 'text-[13px] text-[var(--mp-glass-secondary)]',
    error: 'text-[13px] text-[var(--mp-red)]',
    download: 'bg-[var(--mp-glass-strong)] text-[var(--mp-glass-text)] hover:text-[var(--mp-blue)]',
  },
  // Anywhere else in the app (site tokens, light and dark).
  app: {
    loading: 'text-[12.5px] text-[var(--muted)]',
    error: 'text-[12.5px] text-[var(--danger-text)]',
    download: 'bg-[var(--muted-surface)] text-[var(--muted-strong)] hover:text-[var(--primary)]',
  },
}

/** Call recording player: the audio comes as an authorised blob, so it plays and downloads from memory. */
export function RecordingPlayer({ callId, variant = 'phone' }: { callId: number; variant?: keyof typeof looks }) {
  const { t } = useLocale()
  const look = looks[variant]
  const { url, extension, loading, error } = useRecordingUrl(callId)

  if (loading) {
    return variant === 'app'
      ? <span role="status" aria-label={t('telephony.recording_loading', 'Loading recording…')} className="skeleton block h-9 rounded-full" />
      : <p className={look.loading}>{t('telephony.recording_loading', 'Loading recording…')}</p>
  }
  if (error) return <p role="alert" className={look.error}>{error}</p>
  if (!url) return null

  const download = (
    <a
      href={url}
      download={`call-${callId}.${extension}`}
      title={t('telephony.recording_download', 'Download recording')}
      aria-label={t('telephony.recording_download', 'Download recording')}
      className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors', look.download)}
    >
      <Download size={15} aria-hidden="true" />
    </a>
  )

  // In-app look: the site's own player (play, time, scrubber) instead of the browser's grey <audio> bar.
  if (variant === 'app') {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-[var(--surface)] py-0.5 pr-1 pl-0.5 ring-1 ring-[var(--border)]">
        <AudioPlayer className="min-w-0 flex-1">
          <AudioPlayerElement src={url} preload="metadata" />
          <AudioPlayerControlBar className="w-full">
            <AudioPlayerPlayButton />
            <AudioPlayerTimeDisplay className="text-[11.5px] text-[var(--muted)]" />
            <AudioPlayerTimeRange />
            <AudioPlayerDurationDisplay className="text-[11.5px] text-[var(--muted)]" />
          </AudioPlayerControlBar>
        </AudioPlayer>
        {download}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <audio className="h-9 min-w-0 flex-1" src={url} controls preload="metadata" />
      {download}
    </div>
  )
}
