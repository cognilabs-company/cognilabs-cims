import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Clapperboard, Download, ExternalLink, FileText, Film, Image as ImageIcon, Images, Mic, Pause, Play, Radio, type LucideIcon } from 'lucide-react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { cn } from '../../../../shared/lib/cn'
import type { MediaKind, MediaPiece } from './media'

/* Renders the media pieces found by ./media (photos, videos, voice, files, shared posts). */

/* ── pieces ───────────────────────────────────────────── */

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** Telegram-style voice message: round play button, waveform, time. */
function VoicePlayer({ url, seed, incoming }: { url: string; seed: string; incoming: boolean }) {
  const { t } = useLocale()
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [failed, setFailed] = useState(false)

  // A stable "waveform" per message (the real one is not sent by the backend).
  const bars = useMemo(() => {
    let state = 0
    for (const char of seed) state = (state * 31 + char.charCodeAt(0)) >>> 0
    const out: number[] = []
    for (let index = 0; index < 36; index += 1) {
      state = (state * 1103515245 + 12345) >>> 0
      const wave = Math.sin(index / 3) * 0.25 + 0.55
      out.push(Math.max(0.18, Math.min(1, wave + ((state % 100) / 100 - 0.5) * 0.7)))
    }
    return out
  }, [seed])

  useEffect(() => {
    const element = audio.current
    if (!element) return
    const onTime = () => setCurrent(element.currentTime)
    const onMeta = () => setDuration(Number.isFinite(element.duration) ? element.duration : 0)
    const onEnd = () => { setPlaying(false); setCurrent(0) }
    const onPause = () => setPlaying(false)
    const onPlay = () => setPlaying(true)
    const onError = () => setFailed(true)
    element.addEventListener('timeupdate', onTime)
    element.addEventListener('loadedmetadata', onMeta)
    element.addEventListener('durationchange', onMeta)
    element.addEventListener('ended', onEnd)
    element.addEventListener('pause', onPause)
    element.addEventListener('play', onPlay)
    element.addEventListener('error', onError)
    return () => {
      element.removeEventListener('timeupdate', onTime)
      element.removeEventListener('loadedmetadata', onMeta)
      element.removeEventListener('durationchange', onMeta)
      element.removeEventListener('ended', onEnd)
      element.removeEventListener('pause', onPause)
      element.removeEventListener('play', onPlay)
      element.removeEventListener('error', onError)
    }
  }, [])

  function toggle() {
    const element = audio.current
    if (!element) return
    if (element.paused) {
      // Only one voice message plays at a time.
      document.querySelectorAll('audio[data-tg-voice]').forEach((other) => { if (other !== element) (other as HTMLAudioElement).pause() })
      void element.play().catch(() => setFailed(true))
    } else element.pause()
  }

  function seek(event: MouseEvent<HTMLDivElement>) {
    const element = audio.current
    if (!element || !duration) return
    const rect = event.currentTarget.getBoundingClientRect()
    element.currentTime = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * duration
    setCurrent(element.currentTime)
  }

  const progress = duration ? current / duration : 0
  const accent = incoming ? 'var(--tg-primary)' : 'var(--blue-text)'

  return (
    <div className="flex w-[min(280px,62vw)] items-center gap-2.5 py-1">
      <audio ref={audio} src={url} preload="metadata" data-tg-voice="" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('chat.media.pause', 'Pause') : t('chat.media.play', 'Play voice message')}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-[0_6px_14px_-8px_rgba(43,89,255,0.9)] transition-transform active:scale-95"
        style={{ background: accent }}
      >
        {playing ? <Pause size={18} fill="currentColor" strokeWidth={0} /> : <Play size={18} fill="currentColor" strokeWidth={0} className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div role="slider" aria-label={t('chat.media.voice', 'Voice message')} aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(current)} tabIndex={-1} onClick={seek} className="flex h-7 cursor-pointer items-center gap-[2px]">
          {bars.map((height, index) => (
            <span key={index} className="w-[3px] shrink-0 rounded-full transition-colors" style={{ height: `${height * 100}%`, background: index / bars.length <= progress && progress > 0 ? accent : `color-mix(in srgb, ${accent} 32%, transparent)` }} />
          ))}
        </div>
        <p className={cn('mt-0.5 flex items-center gap-1.5 text-[12px] tabular-nums', incoming ? 'tg-meta-in' : 'tg-meta-out')}>
          {failed ? t('chat.media.voice_failed', 'Could not load the recording') : formatDuration(playing || current ? current : duration)}
          {!failed ? <Mic size={11} /> : null}
          {failed ? <a href={url} target="_blank" rel="noreferrer" className="underline">{t('chat.media.open', 'Open')}</a> : null}
        </p>
      </div>
    </div>
  )
}

function ImagePiece({ piece }: { piece: MediaPiece }) {
  const [failed, setFailed] = useState(false)
  const { t } = useLocale()
  // Instagram DM media comes without a mime type, so a "photo" may really be a video: try that before giving up.
  if (failed && piece.url && !piece.mime) return <VideoPiece piece={piece} />
  if (!piece.url || failed) return <MissingPiece kind="image" note={failed ? t('chat.media.load_failed', 'The file could not be loaded') : null} href={piece.url} />
  return (
    <a href={piece.url} target="_blank" rel="noreferrer" className="-mx-1.5 mb-1 block overflow-hidden rounded-[11px] bg-[var(--muted-surface)]">
      <img src={piece.url} alt={piece.title ?? ''} loading="lazy" onError={() => setFailed(true)} className="block max-h-[340px] w-full min-w-[160px] object-cover" draggable={false} />
    </a>
  )
}

function VideoPiece({ piece, round }: { piece: MediaPiece; round?: boolean }) {
  const { t } = useLocale()
  const [failed, setFailed] = useState(false)
  if (!piece.url || failed) return <MissingPiece kind="video" note={failed ? t('chat.media.load_failed', 'The file could not be loaded') : null} href={piece.url} />
  return (
    <div className={cn('mb-1 overflow-hidden bg-black', round ? 'mx-auto h-[220px] w-[220px] rounded-full' : '-mx-1.5 rounded-[11px]')}>
      <video src={piece.url} poster={piece.thumbnail ?? undefined} controls preload="metadata" playsInline onError={() => setFailed(true)} className={cn('block', round ? 'h-full w-full object-cover' : 'max-h-[360px] w-full min-w-[200px]')} />
    </div>
  )
}

function FilePiece({ piece }: { piece: MediaPiece }) {
  const { t } = useLocale()
  const name = piece.title || piece.url?.split('/').pop()?.split('?')[0] || t('chat.media.file', 'File')
  return (
    <a href={piece.url ?? undefined} target="_blank" rel="noreferrer" download className="mb-1 flex min-w-[220px] items-center gap-2.5 rounded-[12px] py-1 pr-1 transition-opacity hover:opacity-85">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--tg-primary)] text-white"><FileText size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{decodeURIComponent(name)}</span>
        <span className="block truncate text-[12px] opacity-70">{piece.mime ?? t('chat.media.download', 'Download')}</span>
      </span>
      <Download size={16} className="shrink-0 opacity-60" />
    </a>
  )
}

const shareLook: Record<'post' | 'reel' | 'story', { icon: LucideIcon; labelKey: string; fallback: string; color: string }> = {
  post: { icon: Images, labelKey: 'chat.media.post', fallback: 'Instagram post', color: '#E1306C' },
  reel: { icon: Clapperboard, labelKey: 'chat.media.reel', fallback: 'Instagram reel', color: '#8B5CF6' },
  story: { icon: Radio, labelKey: 'chat.media.story', fallback: 'Instagram story', color: '#F59E0B' },
}

/** A post / reel / story the client sent or replied to. */
function SharedPostCard({ piece }: { piece: MediaPiece }) {
  const { t } = useLocale()
  const look = shareLook[piece.kind as 'post' | 'reel' | 'story'] ?? shareLook.post
  const [thumbFailed, setThumbFailed] = useState(false)
  const body = (
    <>
      {piece.thumbnail && !thumbFailed ? (
        <span className="relative block aspect-[4/5] max-h-[260px] w-full overflow-hidden bg-[var(--muted-surface)]">
          <img src={piece.thumbnail} alt="" loading="lazy" onError={() => setThumbFailed(true)} className="h-full w-full object-cover" />
          {piece.kind === 'reel' ? <span className="absolute inset-0 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm"><Play size={20} fill="currentColor" strokeWidth={0} className="ml-0.5" /></span></span> : null}
        </span>
      ) : null}
      <span className="flex items-start gap-2.5 px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-white" style={{ background: look.color }}><look.icon size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-semibold tracking-[0.04em] uppercase" style={{ color: look.color }}>{t(look.labelKey, look.fallback)}</span>
          <span className="block truncate text-[13.5px] font-semibold text-[var(--tg-text)]">{piece.title || (piece.link ? piece.link.replace(/^https?:\/\/(www\.)?/, '') : t('chat.media.shared', 'Shared media'))}</span>
          {piece.note ? <span className="mt-0.5 line-clamp-2 block text-[12px] leading-[1.4] text-[var(--muted)]">{piece.note}</span> : null}
        </span>
        {piece.link ? <ExternalLink size={14} className="mt-1 shrink-0 text-[var(--muted)]" /> : null}
      </span>
    </>
  )
  const className = '-mx-1 mb-1.5 block min-w-[230px] overflow-hidden rounded-[12px] border border-[var(--tg-border)] bg-[var(--tg-bg)] transition-colors hover:border-[var(--border-hover)]'
  return piece.link
    ? <a href={piece.link} target="_blank" rel="noreferrer" className={className}>{body}</a>
    : <div className={className}>{body}</div>
}

const missingLook: Record<MediaKind, { icon: LucideIcon; key: string; fallback: string }> = {
  image: { icon: ImageIcon, key: 'chat.media.photo', fallback: 'Photo' },
  video: { icon: Film, key: 'chat.media.video', fallback: 'Video' },
  video_note: { icon: Film, key: 'chat.media.video_note', fallback: 'Video message' },
  voice: { icon: Mic, key: 'chat.media.voice', fallback: 'Voice message' },
  audio: { icon: Mic, key: 'chat.media.audio', fallback: 'Audio' },
  file: { icon: FileText, key: 'chat.media.file', fallback: 'File' },
  post: { icon: Images, key: 'chat.media.post', fallback: 'Instagram post' },
  reel: { icon: Clapperboard, key: 'chat.media.reel', fallback: 'Instagram reel' },
  story: { icon: Radio, key: 'chat.media.story', fallback: 'Instagram story' },
}

/** Media the backend could not give us a file for: still show what it was. */
export function MissingPiece({ kind, note, href }: { kind: MediaKind; note?: string | null; href?: string | null }) {
  const { t } = useLocale()
  const look = missingLook[kind]
  return (
    <span className="mb-1 flex items-center gap-2.5 rounded-[12px] bg-[color-mix(in_srgb,var(--tg-text)_6%,transparent)] px-2.5 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--tg-primary)] text-white"><look.icon size={16} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium">{t(look.key, look.fallback)}</span>
        <span className="block text-[12px] opacity-70">{note ?? t('chat.media.not_available', 'The file was not saved — open the chat in the app to see it')}</span>
      </span>
      {href ? <a href={href} target="_blank" rel="noreferrer" className="shrink-0 opacity-70 hover:opacity-100"><ExternalLink size={14} /></a> : null}
    </span>
  )
}

export function MediaPieceView({ piece, incoming, seed }: { piece: MediaPiece; incoming: boolean; seed: string }) {
  switch (piece.kind) {
    case 'image':
      return <ImagePiece piece={piece} />
    case 'video':
      return <VideoPiece piece={piece} />
    case 'video_note':
      return <VideoPiece piece={piece} round />
    case 'voice':
    case 'audio':
      return piece.url ? <VoicePlayer url={piece.url} seed={seed} incoming={incoming} /> : <MissingPiece kind={piece.kind} />
    case 'post':
    case 'reel':
    case 'story':
      return <SharedPostCard piece={piece} />
    default:
      return piece.url ? <FilePiece piece={piece} /> : <MissingPiece kind="file" />
  }
}

