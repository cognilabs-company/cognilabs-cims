import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, Check, Copy, Crosshair, Download, Loader2, Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import type { TelephonyCall } from '../../../shared/api/services/telephony.service'
import type { TranscriptSegment } from '../../../shared/api/services/telephonyQuality.service'
import { parseTranscript, speakerNumbers } from '../lib/transcriptParse'
import { useRecordingUrl } from '../lib/useRecordingUrl'
import { CallBadge } from './CallParts'
import { callKindLabel, formatDayTime, formatPhone } from './telephonyFormat'
import { SIDE_TEXT, stamp } from '../lib/transcriptStyle'
import { positionAt, timeSegments, timeTurns, type TimedTurn } from '../lib/transcriptTiming'

/* The big "listen and read" view of a call: it takes the left side of the Calls page, plays the
   recording and keeps the line being said in focus, word by word. Click any line to jump there. */

export type StageTranscript = { callId: number; transcript: string; segments?: TranscriptSegment[] | null; sellerName: string | null; customerName: string | null }

const SPEEDS = [1, 1.25, 1.5, 2]
/* The highlight runs this much ahead of the audio clock: the sound reaches the ear a little after
   currentTime moves, and a word lit a moment early reads as "in sync", a moment late as lagging. */
const LEAD = 0.15
const OFFSET_STEP = 0.25
const clock = (seconds: number) => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`
}

type Phase = 'past' | 'active' | 'future' | 'idle'

/* One line of the talk: who and when on the left, what was said in a bubble on the right.
   The line being said is lit up, and inside it the words already said are marked like with a
   highlighter, the word being said right now the strongest. Lines already played go grey. */
const TurnLine = memo(function TurnLine({ turn, phase, word, speaking, label, onSeek, lineRef }: {
  turn: TimedTurn
  phase: Phase
  word: number
  speaking: boolean
  label: string | null
  onSeek: (seconds: number) => void
  lineRef?: (node: HTMLLIElement | null) => void
}) {
  const active = phase === 'active'
  const last = turn.words.length - 1
  return (
    <li ref={lineRef}>
      <button
        type="button"
        onClick={() => onSeek(turn.start)}
        className={cn(
          'group grid w-full grid-cols-[124px_minmax(0,1fr)] items-start gap-4 rounded-[16px] px-4 py-3 text-left',
          active
            ? 'bg-[color-mix(in_srgb,var(--primary)_11%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--primary)_34%,transparent)]'
            : 'hover:bg-[var(--row-hover)]',
        )}
      >
        <span className="min-w-0 pt-1.5">
          {label ? <span className={cn('block truncate text-[11px] font-bold tracking-[0.14em] uppercase', SIDE_TEXT[turn.side])}>{label}</span> : null}
          <span className={cn('mt-1 block text-[12.5px] font-medium tabular-nums', active ? 'text-[var(--foreground)]' : 'text-[var(--muted)] group-hover:text-[var(--primary)]')} data-i18n-skip="true">{stamp(turn.start)}</span>
        </span>
        <span className="min-w-0">
          <span
            className={cn(
              'inline-block max-w-full rounded-[12px] border px-4 py-2.5 text-[16px] leading-[1.65] whitespace-pre-wrap',
              active
                ? 'border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] bg-[var(--surface)] shadow-[0_10px_28px_-18px_var(--primary)]'
                : 'border-[var(--border)] bg-[var(--muted-surface)]',
              phase === 'past' ? 'text-[var(--muted)]' : 'text-[var(--foreground)]',
            )}
            data-i18n-skip="true"
          >
            {active
              ? turn.words.map((item, index) => {
                const now = index === word && speaking
                const said = index < word || (index === word && !now)
                const space = index < last ? ' ' : ''
                if (now) return <span key={index}><span className="rounded-[5px] bg-[var(--primary)] px-[3px] -mx-[3px] text-white shadow-[0_4px_14px_-6px_var(--primary)]">{item.text}</span>{space}</span>
                return <span key={index} className={cn('box-decoration-clone', said ? 'bg-[color-mix(in_srgb,var(--primary)_22%,transparent)] text-[var(--foreground)]' : 'text-[var(--muted)]')}>{item.text}{space}</span>
              })
              : turn.text}
          </span>
        </span>
      </button>
    </li>
  )
})

export function TranscriptStage({ call, data, onClose }: { call: TelephonyCall; data: StageTranscript; onClose: () => void }) {
  const { t } = useLocale()
  const { url, extension, loading, error } = useRecordingUrl(call.id)
  const audioRef = useRef<HTMLAudioElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLLIElement | null>(null)
  const [time, setTime] = useState(0)
  const [mediaDuration, setMediaDuration] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const [follow, setFollow] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [copied, setCopied] = useState(false)

  const [offset, setOffset] = useState(0)

  const parsed = useMemo(() => parseTranscript(data.transcript, data.sellerName, data.customerName), [data])
  const segments = data.segments?.length ? data.segments : null
  const duration = mediaDuration ?? (call.talk_seconds > 0 ? call.talk_seconds : Math.max(10, segments?.[segments.length - 1]?.end ?? data.transcript.length * 0.065))
  // Exact: the backend gave every line its own start and end. Otherwise the times are worked out from the text.
  const { turns, timed, exact } = useMemo(() => {
    if (segments) return { turns: timeSegments(segments, data.sellerName, data.customerName, duration), timed: true, exact: true }
    return { ...timeTurns(parsed, duration, call.talk_seconds), exact: false }
  }, [segments, parsed, data.sellerName, data.customerName, duration, call.talk_seconds])
  const position = useMemo(() => positionAt(turns, time + LEAD + offset), [turns, time, offset])

  const sellerLabel = t('transcript.seller', 'Seller')
  const clientLabel = t('transcript.client', 'Client')
  const numbers = useMemo(() => speakerNumbers(turns.map((turn) => turn.speaker)), [turns])
  const labelOf = useCallback((turn: TimedTurn) => {
    const number = turn.speaker ? numbers.get(turn.speaker) : undefined
    if (number !== undefined) return t('transcript.speaker_n', '{{n}}-speaker', { n: number })
    return turn.speaker ?? (turn.side === 'seller' ? sellerLabel : turn.side === 'client' ? clientLabel : null)
  }, [numbers, t, sellerLabel, clientLabel])

  // Who talked how much, by the people in the transcript (works for "1-speaker / 2-speaker" too).
  const share = useMemo(() => {
    const byPerson = new Map<string, { side: TimedTurn['side']; words: number }>()
    for (const turn of turns) {
      const label = labelOf(turn)
      if (!label) continue
      const entry = byPerson.get(label) ?? { side: turn.side, words: 0 }
      entry.words += turn.words.length
      byPerson.set(label, entry)
    }
    if (byPerson.size !== 2) return null
    const [first, second] = [...byPerson].sort((a, b) => (a[1].side === 'seller' ? -1 : b[1].side === 'seller' ? 1 : 0))
    const total = first[1].words + second[1].words
    if (!total) return null
    const percent = Math.round((first[1].words / total) * 100)
    return { first: { label: first[0], side: first[1].side, percent }, second: { label: second[0], side: second[1].side, percent: 100 - percent } }
  }, [turns, labelOf])

  // Smooth clock while playing (timeupdate only fires ~4 times a second).
  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      const audio = audioRef.current
      if (audio) setTime(audio.currentTime)
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [playing])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    const target = Math.max(0, Math.min(seconds, duration))
    setTime(target)
    setEngaged(true)
    setFollow(true)
    if (!audio) return
    audio.currentTime = target
    if (audio.paused) void audio.play().catch(() => {})
  }, [duration])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setEngaged(true)
    if (audio.paused) void audio.play().catch(() => {})
    else audio.pause()
  }, [])

  const nudge = useCallback((delta: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + delta, duration))
    setTime(audio.currentTime)
    setEngaged(true)
    setFollow(true)
  }, [duration])

  // Space: play/pause, ← →: 5 seconds (not while typing somewhere).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]') || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === ' ' && !target?.closest('button, a')) { event.preventDefault(); toggle() }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); nudge(-5) }
      else if (event.key === 'ArrowRight') { event.preventDefault(); nudge(5) }
      else if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, nudge, onClose])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed, url])

  // Keep the line being said a third of the way down the view.
  useEffect(() => {
    const box = scrollRef.current
    const line = activeRef.current
    if (!follow || !engaged || !box || !line) return
    box.scrollTo({ top: Math.max(0, line.offsetTop - box.clientHeight * 0.35), behavior: 'smooth' })
  }, [position.turn, follow, engaged])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  function scrub(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const audio = audioRef.current
    const target = ratio * duration
    setTime(target)
    setEngaged(true)
    setFollow(true)
    if (audio) audio.currentTime = target
  }

  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0
  const name = call.customer_name || data.customerName || ''

  return (
    <section aria-label={t('transcript.title', 'Transcript')} className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] bg-[var(--surface)] ring-1 ring-[color-mix(in_srgb,var(--primary)_22%,var(--border))]">
      {/* header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <button type="button" onClick={onClose} title={t('transcript.back', 'Back to the list')} className="inline-flex h-9 items-center gap-1.5 rounded-[11px] pr-3 pl-2 text-[13px] font-medium text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
          <ArrowLeft size={16} /> {t('transcript.back', 'Back to the list')}
        </button>
        <span className="h-6 w-px bg-[var(--border)]" aria-hidden="true" />
        <CallBadge call={call} size={36} className="rounded-[11px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">{name || formatPhone(call.phone_number)}</p>
          <p className="truncate text-[12.5px] text-[var(--muted)]">{callKindLabel(call)} · {formatDayTime(call.started_at)}{call.user_name ? ` · ${call.user_name}` : ''}</p>
        </div>
        {share ? (
          <div className="hidden w-[210px] shrink-0 xl:block" title={t('transcript.talk_share', 'Talk share')}>
            <div className="mb-1 flex justify-between gap-2 text-[11px] font-semibold">
              <span className={cn('truncate', SIDE_TEXT[share.first.side])}>{share.first.label} {share.first.percent}%</span>
              <span className={cn('truncate', SIDE_TEXT[share.second.side])}>{share.second.label} {share.second.percent}%</span>
            </div>
            <span className="flex h-1.5 overflow-hidden rounded-full bg-[var(--muted-surface)]">
              <span className="h-full bg-current" style={{ width: `${share.first.percent}%`, color: share.first.side === 'seller' ? 'var(--primary)' : share.first.side === 'client' ? 'var(--success)' : 'var(--violet-text)' }} />
              <span className="h-full flex-1 bg-current opacity-70" style={{ color: share.second.side === 'seller' ? 'var(--primary)' : share.second.side === 'client' ? 'var(--success)' : 'var(--violet-text)' }} />
            </span>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(data.transcript).then(() => setCopied(true)).catch(() => {})}
          title={t('transcript.copy', 'Copy text')}
          aria-label={t('transcript.copy', 'Copy text')}
          className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-[11px] transition-colors', copied ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'bg-[var(--input-surface)] text-[var(--muted-strong)] hover:bg-[var(--input-surface-hover)]')}
        >
          {copied ? <Check size={16} /> : <Copy size={15} />}
        </button>
      </header>

      {/* the conversation */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onWheel={() => setFollow(false)}
          onTouchMove={() => setFollow(false)}
          className="calls-scroll relative h-full overflow-y-auto px-4 pt-4 pb-[40vh] xl:px-8"
        >
          <p className="mb-3 px-4 text-[12.5px] text-[var(--muted)]">{t('transcript.click_hint', 'Click any line and the recording plays from there.')}</p>
          <ol className="mx-auto max-w-[900px] space-y-1.5">
            {turns.map((turn, index) => {
              const phase: Phase = !engaged ? 'idle' : index === position.turn ? 'active' : index < position.turn ? 'past' : 'future'
              return (
                <TurnLine
                  key={turn.id}
                  turn={turn}
                  phase={phase}
                  word={phase === 'active' ? position.word : -1}
                  speaking={phase === 'active' && position.speaking}
                  label={labelOf(turn)}
                  onSeek={seek}
                  lineRef={phase === 'active' ? (node) => { activeRef.current = node } : undefined}
                />
              )
            })}
          </ol>
        </div>
        {engaged && !follow ? (
          <button type="button" onClick={() => setFollow(true)} className="absolute bottom-4 left-1/2 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-[13px] font-semibold text-white shadow-[0_12px_26px_-12px_var(--primary)] hover:bg-[var(--primary-hover)]">
            <Crosshair size={14} /> {t('transcript.follow', 'Follow the audio')}
          </button>
        ) : null}
      </div>

      {/* player */}
      <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--muted-surface)] px-4 pt-3 pb-3.5">
        {url ? (
          <audio
            ref={audioRef}
            src={url}
            preload="auto"
            onLoadedMetadata={(event) => { const value = event.currentTarget.duration; if (Number.isFinite(value) && value > 0) setMediaDuration(value) }}
            onDurationChange={(event) => { const value = event.currentTarget.duration; if (Number.isFinite(value) && value > 0) setMediaDuration(value) }}
            onPlay={() => setPlaying(true)}
            onPause={(event) => { setPlaying(false); setTime(event.currentTarget.currentTime) }}
            onEnded={() => setPlaying(false)}
            onSeeked={(event) => setTime(event.currentTarget.currentTime)}
            className="hidden"
          />
        ) : null}

        {/* who speaks when, with the progress on top; click or drag to jump */}
        <div
          role="slider"
          tabIndex={0}
          aria-label={t('transcript.position', 'Position')}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          onPointerDown={(event) => { if (!url) return; event.currentTarget.setPointerCapture(event.pointerId); scrub(event) }}
          onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) scrub(event) }}
          className={cn('group relative mb-3 h-7 touch-none', url ? 'cursor-pointer' : 'cursor-default opacity-60')}
        >
          <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--input-surface)]">
            {turns.map((turn) => (
              <span
                key={turn.id}
                className={cn('absolute inset-y-0', turn.side === 'seller' ? 'bg-[color-mix(in_srgb,var(--primary)_35%,transparent)]' : turn.side === 'client' ? 'bg-[color-mix(in_srgb,var(--muted-strong)_28%,transparent)]' : 'bg-[color-mix(in_srgb,var(--violet-text)_28%,transparent)]')}
                style={{ left: `${(turn.start / duration) * 100}%`, width: `${Math.max(0.4, ((Math.min(turn.words[turn.words.length - 1]?.end ?? turn.end, turn.end) - turn.start) / duration) * 100)}%` }}
              />
            ))}
            <span className="absolute inset-y-0 left-0 bg-[var(--primary)] opacity-80" style={{ width: `${progress}%` }} />
          </span>
          <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.3)] ring-2 ring-[var(--primary)] transition-transform group-hover:scale-110" style={{ left: `${progress}%` }} />
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => nudge(-5)} disabled={!url} title={t('transcript.back5', '5 seconds back')} aria-label={t('transcript.back5', '5 seconds back')} className="grid h-10 w-10 place-items-center rounded-full text-[var(--muted-strong)] hover:bg-[var(--input-surface)] disabled:opacity-40">
            <RotateCcw size={18} />
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={!url}
            aria-label={playing ? t('transcript.pause', 'Pause') : t('transcript.play', 'Play')}
            className="grid h-12 w-12 place-items-center rounded-full bg-[var(--primary)] text-white shadow-[0_12px_26px_-12px_var(--primary)] transition hover:bg-[var(--primary-hover)] active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : playing ? <Pause size={20} fill="currentColor" strokeWidth={0} /> : <Play size={20} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />}
          </button>
          <button type="button" onClick={() => nudge(5)} disabled={!url} title={t('transcript.fwd5', '5 seconds forward')} aria-label={t('transcript.fwd5', '5 seconds forward')} className="grid h-10 w-10 place-items-center rounded-full text-[var(--muted-strong)] hover:bg-[var(--input-surface)] disabled:opacity-40">
            <RotateCw size={18} />
          </button>
          <span className="ml-1 text-[13px] font-semibold tabular-nums text-[var(--foreground)]" data-i18n-skip="true">
            {clock(time)} <span className="font-medium text-[var(--muted)]">/ {clock(duration)}</span>
          </span>

          {error ? <span role="alert" className="ml-2 truncate text-[12.5px] text-[var(--danger-text)]">{error}</span> : (
            <span className="ml-2 hidden truncate text-[11.5px] text-[var(--caption)] 2xl:inline" data-i18n-skip="true">
              {t('transcript.keys', 'Space — play/pause · ← → — 5 seconds')}
            </span>
          )}

          <span className="ml-auto flex items-center gap-1.5">
            {!timed ? (
              <span className="hidden rounded-full bg-[var(--input-surface)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--muted-strong)] 2xl:inline" title={t('transcript.estimated_hint', 'The transcript has no timestamps, so the highlighting follows the audio approximately. Click a line to put it back in place.')}>
                ≈ {t('transcript.estimated', 'Approximate sync')}
              </span>
            ) : null}
            {!exact ? (
              // Word times are worked out from the text, so let the listener nudge the highlight onto the voice.
              <span className="flex h-9 items-center rounded-full bg-[var(--surface)] ring-1 ring-[var(--border)]" title={t('transcript.sync_hint', 'Text behind the voice? Press +. Ahead of it? Press −.')}>
                <button type="button" onClick={() => setOffset((value) => Math.max(-3, +(value - OFFSET_STEP).toFixed(2)))} aria-label={t('transcript.sync_earlier', 'Text later')} className="grid h-9 w-8 place-items-center rounded-l-full text-[15px] font-bold text-[var(--muted-strong)] hover:text-[var(--primary)]">−</button>
                <button type="button" onClick={() => setOffset(0)} className="min-w-[64px] text-center text-[11.5px] font-semibold tabular-nums text-[var(--muted-strong)]" data-i18n-skip="true">
                  {t('transcript.sync', 'Sync')} {offset > 0 ? '+' : ''}{offset ? `${offset}s` : '0'}
                </button>
                <button type="button" onClick={() => setOffset((value) => Math.min(3, +(value + OFFSET_STEP).toFixed(2)))} aria-label={t('transcript.sync_later', 'Text earlier')} className="grid h-9 w-8 place-items-center rounded-r-full text-[15px] font-bold text-[var(--muted-strong)] hover:text-[var(--primary)]">+</button>
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setSpeed((value) => SPEEDS[(SPEEDS.indexOf(value) + 1) % SPEEDS.length])}
              title={t('transcript.speed', 'Speed')}
              className="h-9 min-w-[52px] rounded-full bg-[var(--surface)] px-3 text-[13px] font-bold tabular-nums text-[var(--foreground)] ring-1 ring-[var(--border)] hover:ring-[var(--primary)]"
              data-i18n-skip="true"
            >
              {speed}×
            </button>
            {url ? (
              <a href={url} download={`call-${call.id}.${extension}`} title={t('telephony.recording_download', 'Download recording')} aria-label={t('telephony.recording_download', 'Download recording')} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface)] text-[var(--muted-strong)] ring-1 ring-[var(--border)] hover:text-[var(--primary)]">
                <Download size={15} />
              </a>
            ) : null}
          </span>
        </div>
      </footer>
    </section>
  )
}
