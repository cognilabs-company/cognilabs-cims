import { useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Copy, Search, X } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { parseTranscript, speakerNumbers, type Turn } from '../lib/transcriptParse'
import { SIDE_TEXT } from '../lib/transcriptStyle'

/* The call transcript as rows: who and when on the left, what was said in a bubble.
   The backend sends it as plain text, usually one "Speaker: words" line per turn, sometimes with a
   [00:12] time in front. Lines without a speaker belong to the turn above. */

function highlight(text: string, query: string): ReactNode {
  if (!query) return text
  const lower = text.toLowerCase()
  const needle = query.toLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  let at = lower.indexOf(needle)
  while (at !== -1) {
    if (at > from) parts.push(text.slice(from, at))
    parts.push(<mark key={at} className="rounded-[3px] bg-[color-mix(in_srgb,#FFC233_55%,transparent)] px-0.5 text-inherit">{text.slice(at, at + needle.length)}</mark>)
    from = at + needle.length
    at = lower.indexOf(needle, from)
  }
  if (from < text.length) parts.push(text.slice(from))
  return parts
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length

/** Transcript card body: talk share, search, copy, and the dialogue itself. */
export function TranscriptView({ transcript, sellerName, customerName, compact }: { transcript: string; sellerName: string | null; customerName: string | null; compact?: boolean }) {
  const { t } = useLocale()
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const turns = useMemo(() => parseTranscript(transcript, sellerName, customerName), [transcript, sellerName, customerName])
  const dialogue = turns.some((turn) => turn.speaker)

  const share = useMemo(() => {
    const seller = turns.filter((turn) => turn.side === 'seller').reduce((sum, turn) => sum + words(turn.text), 0)
    const client = turns.filter((turn) => turn.side === 'client').reduce((sum, turn) => sum + words(turn.text), 0)
    const total = seller + client
    return total > 0 ? { seller: Math.round((seller / total) * 100), client: 100 - Math.round((seller / total) * 100) } : null
  }, [turns])

  const needle = query.trim()
  const visible = needle ? turns.filter((turn) => turn.text.toLowerCase().includes(needle.toLowerCase()) || (turn.speaker ?? '').toLowerCase().includes(needle.toLowerCase())) : turns
  const hits = needle ? turns.reduce((sum, turn) => sum + (turn.text.toLowerCase().split(needle.toLowerCase()).length - 1), 0) : 0

  function copy() {
    void navigator.clipboard?.writeText(transcript).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    }).catch(() => {})
  }

  const sellerLabel = t('transcript.seller', 'Seller')
  const clientLabel = t('transcript.client', 'Client')
  const numbers = useMemo(() => speakerNumbers(turns.map((turn) => turn.speaker)), [turns])
  const labelOf = (turn: Turn) => {
    const number = turn.speaker ? numbers.get(turn.speaker) : undefined
    if (number !== undefined) return t('transcript.speaker_n', '{{n}}-speaker', { n: number })
    return turn.speaker ?? (turn.side === 'seller' ? sellerLabel : turn.side === 'client' ? clientLabel : null)
  }

  return (
    <div className="space-y-3">
      {share ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-semibold">
            <span className="flex items-center gap-1.5 text-[var(--muted-strong)]"><span className="h-2 w-2 rounded-full bg-[var(--muted-strong)] opacity-60" />{clientLabel} {share.client}%</span>
            <span className="text-[10.5px] font-medium tracking-[0.06em] text-[var(--muted)] uppercase">{t('transcript.talk_share', 'Talk share')}</span>
            <span className="flex items-center gap-1.5 text-[var(--blue-text)]">{sellerLabel} {share.seller}%<span className="h-2 w-2 rounded-full bg-[var(--primary)]" /></span>
          </div>
          <span className="flex h-1.5 overflow-hidden rounded-full bg-[var(--muted-surface)]">
            <span className="h-full bg-[var(--muted-strong)] opacity-40" style={{ width: `${share.client}%` }} />
            <span className="h-full bg-[var(--primary)]" style={{ width: `${share.seller}%` }} />
          </span>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <label className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('transcript.search', 'Search the conversation…')}
            aria-label={t('transcript.search', 'Search the conversation…')}
            className="control-field h-8 w-full rounded-[10px] pr-14 pl-8 text-[12.5px]"
          />
          {needle ? (
            <span className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
              <span className="text-[11px] tabular-nums text-[var(--muted)]">{hits}</span>
              <button type="button" onClick={() => setQuery('')} aria-label={t('telephony.close', 'Close')} className="grid h-5 w-5 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--input-surface-hover)]"><X size={12} /></button>
            </span>
          ) : null}
        </label>
        <button type="button" onClick={copy} title={t('transcript.copy', 'Copy text')} aria-label={t('transcript.copy', 'Copy text')} className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-[10px] transition-colors', copied ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'bg-[var(--input-surface)] text-[var(--muted-strong)] hover:bg-[var(--input-surface-hover)]')}>
          {copied ? <Check size={14} /> : <Copy size={13} />}
        </button>
      </div>

      <div className={cn('calls-scroll relative -mx-1 overflow-y-auto px-1', !expanded && (compact ? 'max-h-72' : 'max-h-[420px]'))}>
        {visible.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-[var(--muted)]">{t('transcript.no_match', 'Nothing found')}</p>
        ) : dialogue ? (
          <ol className="space-y-1 py-1">
            {visible.map((turn) => {
              const label = labelOf(turn)
              return (
                <li key={turn.id} className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-3 rounded-[12px] px-1.5 py-1.5">
                  <span className="min-w-0 pt-1">
                    {label ? <span className={cn('block truncate text-[10px] font-bold tracking-[0.12em] uppercase', SIDE_TEXT[turn.side])}>{label}</span> : null}
                    {turn.time ? <span className="mt-0.5 block text-[11px] font-medium tabular-nums text-[var(--muted)]" data-i18n-skip="true">{turn.time}</span> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="inline-block max-w-full rounded-[10px] border border-[var(--border)] bg-[var(--muted-surface)] px-3 py-2 text-[12.5px] leading-[1.55] whitespace-pre-wrap text-[var(--foreground)]" data-i18n-skip="true">
                      {highlight(turn.text, needle)}
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="space-y-2 rounded-[12px] bg-[var(--muted-surface)] px-3 py-2.5" data-i18n-skip="true">
            {visible.map((turn) => (
              <p key={turn.id} className="text-[12.5px] leading-[1.6] whitespace-pre-wrap text-[var(--foreground)]">
                {turn.time ? <span className="mr-1.5 text-[11px] font-semibold tabular-nums text-[var(--caption)]">{turn.time}</span> : null}
                {highlight(turn.text, needle)}
              </p>
            ))}
          </div>
        )}
      </div>

      {turns.length > 6 && !needle ? (
        <button type="button" onClick={() => setExpanded((open) => !open)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--primary)]">
          {expanded ? t('transcript.collapse', 'Collapse') : t('transcript.expand', 'Show all')}
          <ChevronDown size={13} className={cn('transition-transform', expanded && 'rotate-180')} />
        </button>
      ) : null}
    </div>
  )
}

