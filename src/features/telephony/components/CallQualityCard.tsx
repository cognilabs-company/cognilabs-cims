import { useEffect, useState } from 'react'
import { AlertTriangle, BadgeCheck, ChevronDown, CircleCheck, CircleX, Lightbulb, Loader2, RotateCw, Sparkles, ThumbsUp } from 'lucide-react'
import { TranscriptView } from './CallTranscript'
import { useLocale } from '../../../app/hooks/useLocale'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { telephonyQualityService, type CallQuality, type QualityCriterion } from '../../../shared/api/services/telephonyQuality.service'
import { formatDayTime, scoreTone } from './telephonyFormat'

export function ScoreRing({ score, size = 64, stroke = 6 }: { score: number | null; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2
  const length = 2 * Math.PI * radius
  const value = Math.max(0, Math.min(100, score ?? 0))
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted-surface)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={scoreTone(score)} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length - (value / 100) * length} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="absolute text-center leading-none">
        <span className="block font-bold tracking-[-0.03em] text-[var(--foreground)] tabular-nums" style={{ fontSize: size * 0.3 }}>{score ?? '—'}</span>
      </span>
    </span>
  )
}

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] text-[var(--muted-strong)]">{label}</span>
        <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: scoreTone(score) }}>{score === null ? '—' : `${score}%`}</span>
      </div>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--muted-surface)]">
        <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${score ?? 0}%`, background: scoreTone(score) }} />
      </span>
    </div>
  )
}

function Bullets({ icon: Icon, title, items, tone }: { icon: typeof ThumbsUp; title: string; items: string[]; tone: string }) {
  if (!items.length) return null
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: tone }}><Icon size={13} />{title}</p>
      <ul className="space-y-1">
        {items.map((item) => <li key={item} className="relative pl-3.5 text-[12.5px] leading-[1.5] text-[var(--foreground)] before:absolute before:top-[0.6em] before:left-0.5 before:h-1 before:w-1 before:rounded-full before:bg-[var(--caption)]">{item}</li>)}
      </ul>
    </div>
  )
}

function CriteriaList({ criteria }: { criteria: QualityCriterion[] }) {
  const { t } = useLocale()
  const groups: Array<[QualityCriterion['group'], string]> = [
    ['call_script', t('quality.group.call_script', 'Call script')],
    ['analysis', t('quality.group.analysis', 'Analysis')],
    ['sales_script', t('quality.group.sales_script', 'Sales script')],
    ['other', t('quality.group.other', 'Other')],
  ]
  return (
    <div className="space-y-3">
      {groups.map(([group, label]) => {
        const items = criteria.filter((item) => item.group === group)
        if (!items.length) return null
        return (
          <div key={group}>
            <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">{label}</p>
            <ul className="divide-y divide-[var(--border)] rounded-[12px] border border-[var(--border)]">
              {items.map((item) => {
                const ok = item.passed ?? (item.score === null ? null : item.score >= 60)
                return (
                  <li key={item.id} className="flex items-start gap-2.5 px-3 py-2">
                    {ok === null ? <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-[var(--border-hover)]" /> : ok ? <CircleCheck size={16} className="mt-0.5 shrink-0 text-[var(--success)]" /> : <CircleX size={16} className="mt-0.5 shrink-0 text-[var(--danger)]" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-medium text-[var(--foreground)]">{item.title}</span>
                      {item.comment ? <span className="mt-0.5 block text-[12px] leading-[1.45] text-[var(--muted)]">{item.comment}</span> : null}
                    </span>
                    {item.score !== null && item.passed === null ? <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: scoreTone(item.score) }}>{item.score}%</span> : null}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/** The grade itself: total, the three parts, the checklist and the AI's notes.
    `showTranscript={false}` when the transcript already has its own card next to it. */
export function QualityReport({ quality, showTranscript = true }: { quality: CallQuality; showTranscript?: boolean }) {
  const { t } = useLocale()
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={quality.overall} size={72} stroke={7} />
        <div className="grid min-w-0 flex-1 gap-2">
          <ScoreBar label={t('quality.group.call_script', 'Call script')} score={quality.callScript} />
          <ScoreBar label={t('quality.group.analysis', 'Analysis')} score={quality.analysis} />
          <ScoreBar label={t('quality.group.sales_script', 'Sales script')} score={quality.salesScript} />
        </div>
      </div>

      {quality.summary ? <p className="rounded-[12px] bg-[color-mix(in_srgb,var(--violet-dim)_70%,transparent)] px-3 py-2.5 text-[12.5px] leading-[1.55] text-[var(--muted-strong)]"><Sparkles size={12} className="mr-1 inline text-[var(--violet-text)]" />{quality.summary}</p> : null}

      {quality.criteria.length ? <CriteriaList criteria={quality.criteria} /> : null}

      <div className="grid gap-3">
        <Bullets icon={ThumbsUp} title={t('quality.strengths', 'Done well')} items={quality.strengths} tone="var(--success-text)" />
        <Bullets icon={AlertTriangle} title={t('quality.mistakes', 'Mistakes')} items={quality.mistakes} tone="var(--danger-text)" />
        <Bullets icon={Lightbulb} title={t('quality.recommendations', 'What to improve')} items={quality.recommendations} tone="var(--blue-text)" />
      </div>

      {showTranscript && quality.transcript ? (
        <div>
          <button type="button" onClick={() => setTranscriptOpen((open) => !open)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--primary)]">
            {transcriptOpen ? t('quality.hide_transcript', 'Hide transcript') : t('quality.show_transcript', 'Show transcript')}
            <ChevronDown size={13} className={cn('transition-transform', transcriptOpen && 'rotate-180')} />
          </button>
          {transcriptOpen ? <div className="mt-3"><TranscriptView transcript={quality.transcript} segments={quality.segments} sellerName={quality.sellerName} customerName={quality.customerName} compact /></div> : null}
        </div>
      ) : null}

      {quality.analyzedAt ? <p className="text-[11.5px] text-[var(--muted)]">{t('quality.analyzed_at', 'Graded {{when}}', { when: formatDayTime(quality.analyzedAt) })}</p> : null}
    </div>
  )
}

/**
 * Call card section: the AI grade of this call against the call script and the sales script.
 * Asks for a grade when there is none yet and follows it until it is ready.
 */
export function CallQualityCard({ callId, hasRecording, canRegrade, onQuality }: {
  callId: number
  hasRecording: boolean
  canRegrade: boolean
  /** Every time the grade is (re)loaded: undefined while loading, null when there is none. */
  onQuality?: (quality: CallQuality | null | undefined) => void
}) {
  const { t } = useLocale()
  const [quality, setQuality] = useState<CallQuality | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const working = quality?.status === 'pending' || quality?.status === 'processing'

  useEffect(() => { onQuality?.(quality) }, [onQuality, quality])

  useEffect(() => {
    let alive = true
    setQuality(undefined)
    setError(null)
    telephonyQualityService.call(callId)
      .then((result) => { if (alive) setQuality(result) })
      .catch((cause: unknown) => { if (alive) { setQuality(null); setError(getApiErrorMessage(cause)) } })
    return () => { alive = false }
  }, [callId])

  // While the AI is still working, look again every few seconds.
  useEffect(() => {
    if (!working) return
    const timer = window.setTimeout(() => {
      void telephonyQualityService.call(callId).then((result) => setQuality(result)).catch(() => undefined)
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [callId, quality, working])

  async function analyze(force: boolean) {
    setBusy(true)
    setError(null)
    try {
      const result = await telephonyQualityService.analyze(callId, force)
      setQuality(result ?? { ...(quality ?? emptyQuality(callId)), status: 'pending' })
    } catch (cause) {
      setError(getApiErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const done = quality?.status === 'completed'

  return (
    <section className="rounded-[18px] bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--muted-strong)]">
        <span className="text-[var(--muted)]"><BadgeCheck size={15} /></span>
        {t('quality.card_title', 'Call grade')}
        {done && canRegrade ? (
          <button type="button" onClick={() => void analyze(true)} disabled={busy} className="ml-auto inline-flex items-center gap-1 rounded-[9px] px-2 py-1 text-[12px] font-semibold text-[var(--primary)] hover:bg-[var(--blue-dim)] disabled:opacity-50">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}{t('quality.regrade', 'Grade again')}
          </button>
        ) : null}
      </h3>

      {quality === undefined ? (
        <p className="flex items-center gap-2 text-[12.5px] text-[var(--muted)]"><Loader2 size={14} className="animate-spin" />{t('common.loading', 'Loading...')}</p>
      ) : done && quality ? (
        <QualityReport quality={quality} showTranscript={!onQuality} />
      ) : working ? (
        <div className="flex items-center gap-3 rounded-[12px] bg-[var(--blue-dim)] px-3 py-3">
          <Loader2 size={18} className="shrink-0 animate-spin text-[var(--primary)]" />
          <p className="text-[12.5px] leading-[1.5] text-[var(--blue-text)]">{t('quality.working', 'The AI is listening to the call and checking it against the scripts. This takes a minute or two.')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] leading-[1.5] text-[var(--muted)]">
            {quality?.status === 'failed'
              ? t('quality.failed', 'The grade could not be made{{reason}}.', { reason: quality.error ? `: ${quality.error}` : '' })
              : quality?.status === 'skipped'
                ? t('quality.skipped', 'This call was not graded (no recording or too short).')
                : hasRecording
                  ? t('quality.none', 'Not graded yet. The AI checks the call script, the analysis of the client and the sales script.')
                  : t('quality.no_recording', 'There is no recording, so this call cannot be graded.')}
          </p>
          {hasRecording ? (
            <button type="button" onClick={() => void analyze(quality?.status === 'failed')} disabled={busy} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-[11px] bg-[var(--primary)] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{t('quality.grade', 'Grade the call')}
            </button>
          ) : null}
        </div>
      )}

      {error ? <p role="alert" className="mt-3 rounded-[10px] bg-[var(--danger-dim)] px-3 py-2 text-[12.5px] text-[var(--danger-text)]">{error}</p> : null}
    </section>
  )
}

function emptyQuality(callId: number): CallQuality {
  return { callId, status: 'pending', overall: null, callScript: null, analysis: null, salesScript: null, summary: null, strengths: [], mistakes: [], recommendations: [], criteria: [], transcript: null, segments: null, speakerSeparation: null, sellerName: null, customerName: null, phone: null, callStartedAt: null, analyzedAt: null, error: null }
}
