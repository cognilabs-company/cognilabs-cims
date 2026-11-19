import { useEffect, useState } from 'react'
import { Activity, BadgeCheck, ChevronDown, FileText, Loader2, RefreshCw, Save, UserRound } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { telephonyQualityService, type CallQuality, type QualityStats, type SalesScript } from '../../../shared/api/services/telephonyQuality.service'
import { useToast } from '../../../shared/toast/useToast'
import { Switch } from '../../../shared/ui/switch'
import { QualityReport, ScoreRing } from './CallQualityCard'
import { formatDayTime, formatPhone, scoreTone } from './telephonyFormat'

type Filter = 'all' | 'completed' | 'pending' | 'processing' | 'failed'

function Tile({ label, score, hint }: { label: string; score: number | null; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
      <ScoreRing score={score} size={52} stroke={5} />
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-medium text-[var(--muted-strong)]">{label}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted)]">{hint ?? '—'}</p>
      </div>
    </div>
  )
}

function MiniScore({ label, score }: { label: string; score: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[7px] bg-[var(--muted-surface)] px-1.5 py-0.5 text-[11px] text-[var(--muted-strong)]" title={label}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: scoreTone(score) }} />
      <span className="max-w-[86px] truncate">{label}</span>
      <span className="font-semibold tabular-nums text-[var(--foreground)]">{score ?? '—'}</span>
    </span>
  )
}

/** The script the AI grades against. The CEO edits it; everyone else can read it. */
function ScriptCard({ editable }: { editable: boolean }) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const [script, setScript] = useState<SalesScript | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [open, setOpen] = useState(editable)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    telephonyQualityService.script().then((value) => {
      if (!alive) return
      setScript(value)
      setTitle(value.title)
      setContent(value.content)
    }).catch(() => { if (alive) setScript({ title: '', content: '', updatedAt: null, updatedBy: null }) })
    if (editable) telephonyQualityService.settings().then((value) => { if (alive) setEnabled(value.enabled) }).catch(() => undefined)
    return () => { alive = false }
  }, [editable])

  const dirty = script !== null && (title !== script.title || content !== script.content)

  async function save() {
    setSaving(true)
    try {
      const saved = await telephonyQualityService.saveScript(title.trim(), content.trim())
      const next = { ...saved, title: saved.title || title.trim(), content: saved.content || content.trim() }
      setScript(next)
      setTitle(next.title)
      setContent(next.content)
      showToast({ title: t('quality.script_saved', 'Script saved'), description: t('quality.script_saved_text', 'New grades use this version.'), tone: 'success' })
    } catch (cause) {
      showToast({ title: t('quality.script_failed', 'Could not save the script'), description: getApiErrorMessage(cause), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function toggle(next: boolean) {
    setEnabled(next)
    try {
      await telephonyQualityService.setEnabled(next)
    } catch (cause) {
      setEnabled(!next)
      showToast({ title: t('quality.settings_failed', 'Could not change the setting'), description: getApiErrorMessage(cause), tone: 'error' })
    }
  }

  return (
    <section className="rounded-[18px] bg-[var(--surface)] ring-1 ring-[var(--border)]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--violet-dim)] text-[var(--violet-text)]"><FileText size={17} /></span>
        <button type="button" onClick={() => setOpen((value) => !value)} className="min-w-0 flex-1 text-left">
          <span className="block text-[14px] font-semibold text-[var(--foreground)]">{t('quality.script_title', 'Call & sales script')}</span>
          <span className="block truncate text-[12px] text-[var(--muted)]">
            {script === null ? t('common.loading', 'Loading...') : script.content
              ? (script.title || t('quality.script_hint', 'Calls are graded against this script'))
              : t('quality.script_empty', 'No script yet — grades use general sales rules.')}
          </span>
        </button>
        {editable && enabled !== null ? (
          <label className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--muted-strong)]">
            {t('quality.auto', 'Grade calls automatically')}
            <Switch checked={enabled} onChange={(next) => void toggle(next)} label={t('quality.auto', 'Grade calls automatically')} />
          </label>
        ) : null}
        <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? t('common.show_less', 'Show less') : t('common.show_more', 'Show more')} className="grid h-8 w-8 place-items-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--muted-surface)]">
          <ChevronDown size={16} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open && script !== null ? (
        <div className="border-t border-[var(--border)] px-4 py-3.5">
          {editable ? (
            <div className="space-y-2.5">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('quality.script_name', 'Script name, e.g. “Inbound call — website order”')} aria-label={t('quality.script_name', 'Script name')} className="control-field h-10 w-full rounded-[10px] px-3 text-[13.5px]" />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={10}
                placeholder={t('quality.script_placeholder', '1. Greeting: “Assalomu alaykum, Cognilabs, my name is …”\n2. Find out the need: what business, what problem…\n3. Offer: …\n4. Objections: “expensive” → …\n5. Next step: meeting / proposal / payment')}
                aria-label={t('quality.script_title', 'Call & sales script')}
                className="control-field w-full rounded-[12px] px-3 py-2.5 font-mono text-[12.5px] leading-[1.6]"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11.5px] text-[var(--muted)]">
                  {script.updatedAt ? t('quality.script_updated', 'Updated {{when}}', { when: formatDayTime(script.updatedAt) }) : t('quality.script_tip', 'Write the steps in order; the AI checks each one.')}
                  {script.updatedBy ? ` · ${script.updatedBy}` : ''}
                </p>
                <button type="button" onClick={() => void save()} disabled={!dirty || saving || !content.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-[11px] bg-[var(--primary)] px-3.5 text-[13px] font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-40">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{t('common.save', 'Save')}
                </button>
              </div>
            </div>
          ) : script.content ? (
            <p className="max-h-80 overflow-y-auto text-[12.5px] leading-[1.6] whitespace-pre-wrap text-[var(--muted-strong)]">{script.content}</p>
          ) : (
            <p className="text-[12.5px] text-[var(--muted)]">{t('quality.script_empty', 'No script yet — grades use general sales rules.')}</p>
          )}
        </div>
      ) : null}
    </section>
  )
}

function GradedCall({ item }: { item: CallQuality }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [full, setFull] = useState<CallQuality | null>(null)

  useEffect(() => {
    if (!open || full) return
    let alive = true
    telephonyQualityService.call(item.callId).then((value) => { if (alive) setFull(value ?? item) }).catch(() => { if (alive) setFull(item) })
    return () => { alive = false }
  }, [full, item, open])

  const working = item.status === 'pending' || item.status === 'processing'
  const who = item.customerName || (item.phone ? formatPhone(item.phone) : t('quality.call_n', 'Call #{{id}}', { id: item.callId }))

  return (
    <li className="rounded-[16px] bg-[var(--surface)] ring-1 ring-[var(--border)]">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
        {working ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--blue-dim)]"><Loader2 size={18} className="animate-spin text-[var(--primary)]" /></span> : <ScoreRing score={item.overall} size={44} stroke={4} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-[var(--foreground)]">{who}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-[var(--muted)]">
            {item.sellerName ? <span className="inline-flex items-center gap-1"><UserRound size={11} />{item.sellerName}</span> : null}
            {item.callStartedAt ? <span className="tabular-nums">{formatDayTime(item.callStartedAt)}</span> : null}
            {working ? <span className="font-semibold text-[var(--blue-text)]">{t('quality.status.working', 'Grading…')}</span> : null}
            {item.status === 'failed' ? <span className="font-semibold text-[var(--danger-text)]">{t('quality.status.failed', 'Failed')}</span> : null}
          </span>
        </span>
        <span className="hidden flex-wrap justify-end gap-1 sm:flex">
          <MiniScore label={t('quality.group.call_script', 'Call script')} score={item.callScript} />
          <MiniScore label={t('quality.group.analysis', 'Analysis')} score={item.analysis} />
          <MiniScore label={t('quality.group.sales_script', 'Sales script')} score={item.salesScript} />
        </span>
        <ChevronDown size={16} className={cn('shrink-0 text-[var(--caption)] transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="border-t border-[var(--border)] px-3.5 py-3.5">
          {full ? (full.status === 'completed' ? <QualityReport quality={full} /> : <p className="text-[12.5px] text-[var(--muted)]">{full.error ?? t('quality.working', 'The AI is listening to the call and checking it against the scripts. This takes a minute or two.')}</p>) : <p className="flex items-center gap-2 text-[12.5px] text-[var(--muted)]"><Loader2 size={14} className="animate-spin" />{t('common.loading', 'Loading...')}</p>}
        </div>
      ) : null}
    </li>
  )
}

type Loose = Record<string, unknown>

function diagValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? '✓' : '✗'
  if (typeof value === 'number') return value.toLocaleString('ru-RU')
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return String(value.length)
  return ''
}

/** Labels for the fields GET /telephony-quality/diagnostics returns today; anything new shows under its raw key. */
const DIAG_LABELS: Record<string, [string, string]> = {
  'summary.total_calls': ['quality.diag.total_calls', 'Calls'],
  'summary.answered_calls': ['quality.diag.answered_calls', 'Answered'],
  'summary.recorded_calls': ['quality.diag.recorded_calls', 'Recorded'],
  'summary.short_answered_calls': ['quality.diag.short_answered_calls', 'Answered but very short'],
  'summary.average_talk_seconds': ['quality.diag.average_talk_seconds', 'Average talk time, sec'],
}

/**
 * Rows of a diagnostics answer ({hours, summary:{…}, hangup_causes:[{cause, count}]}): known fields get a label,
 * lists of {name, count} become one row each, other scalars and one nested level show under their key.
 */
function diagRows(raw: Loose, t: (key: string, fallback: string) => string) {
  const rows: Array<[string, string]> = []
  const label = (path: string) => (DIAG_LABELS[path] ? t(...DIAG_LABELS[path]) : path.replace('.', ' · '))
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'hours') continue
    if (Array.isArray(value)) {
      const prefix = key === 'hangup_causes' ? t('quality.diag.hangup_cause', 'Hang-up') : key
      for (const entry of value) {
        if (!entry || typeof entry !== 'object') continue
        const item = entry as Loose
        const name = item.cause ?? item.name ?? item.status ?? item.key
        if (name !== undefined) rows.push([`${prefix} · ${String(name)}`, diagValue(item.count ?? item.total ?? item.value)])
      }
    } else if (value && typeof value === 'object') {
      for (const [inner, innerValue] of Object.entries(value as Loose)) {
        const text = diagValue(innerValue)
        if (text) rows.push([label(`${key}.${inner}`), text])
      }
    } else {
      rows.push([label(key), diagValue(value)])
    }
  }
  return rows
}

/** CEO only: what the grading pipeline did in the last 24 hours (GET /telephony-quality/diagnostics). */
function DiagnosticsCard() {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Loose | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    const next = !open
    setOpen(next)
    if (!next || data) return
    setError(null)
    telephonyQualityService.diagnostics(24).then(setData).catch((cause: unknown) => setError(getApiErrorMessage(cause)))
  }

  const rows = data ? diagRows(data, t) : []
  return (
    <section className="rounded-[18px] bg-[var(--surface)] ring-1 ring-[var(--border)]">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <Activity size={15} className="text-[var(--primary)]" />
        <span className="text-[13px] font-semibold text-[var(--muted-strong)]">{t('quality.diag.title', 'Diagnostics, last 24 hours')}</span>
        <ChevronDown size={15} className={cn('ml-auto text-[var(--muted)] transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="border-t border-[var(--border)] px-4 py-3">
          {error ? <p role="alert" className="text-[12.5px] text-[var(--danger-text)]">{error}</p>
            : !data ? <p className="flex items-center gap-2 text-[12.5px] text-[var(--muted)]"><Loader2 size={14} className="animate-spin" />{t('common.loading', 'Loading…')}</p>
            : !rows.length ? <p className="text-[12.5px] text-[var(--muted)]">{t('quality.diag.empty', 'Nothing to report.')}</p>
            : (
              <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                    <dt className="truncate text-[var(--muted)]">{label}</dt>
                    <dd className="truncate font-semibold text-[var(--foreground)] tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
        </div>
      ) : null}
    </section>
  )
}

/** Calls → "Grades" tab: average grades, the script, and every graded call. */
export function CallQualityPanel({ isCeo }: { isCeo: boolean }) {
  const { t } = useLocale()
  const [stats, setStats] = useState<QualityStats | null>(null)
  const [items, setItems] = useState<CallQuality[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<Filter>('all')
  const [version, setVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    telephonyQualityService.stats().then((value) => { if (alive) setStats(value) }).catch(() => undefined)
    return () => { alive = false }
  }, [version])

  useEffect(() => {
    let alive = true
    telephonyQualityService.calls({ status: filter === 'all' ? undefined : filter, page, pageSize: 20 })
      .then((value) => {
        if (!alive) return
        setError(null)
        setItems((current) => (page === 1 || !current ? value.items : [...current, ...value.items.filter((entry) => !current.some((known) => known.callId === entry.callId))]))
        setTotal(value.total)
      })
      .catch((cause: unknown) => { if (alive) { setItems((current) => current ?? []); setError(getApiErrorMessage(cause)) } })
    return () => { alive = false }
  }, [filter, page, version])

  const filters: Array<[Filter, string]> = [
    ['all', t('quality.filter.all', 'All')],
    ['completed', t('quality.filter.completed', 'Graded')],
    ['pending', t('quality.filter.pending', 'In queue')],
    ['processing', t('quality.filter.processing', 'Grading')],
    ['failed', t('quality.filter.failed', 'Failed')],
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={t('quality.avg_overall', 'Average grade')} score={stats?.average ?? null} hint={stats ? t('quality.graded_count', '{{count}} calls graded', { count: stats.analyzed }) : undefined} />
        <Tile label={t('quality.group.call_script', 'Call script')} score={stats?.callScript ?? null} hint={t('quality.call_script_hint', 'Greeting, introduction, closing')} />
        <Tile label={t('quality.group.analysis', 'Analysis')} score={stats?.analysis ?? null} hint={t('quality.analysis_hint', 'Needs found, questions, listening')} />
        <Tile label={t('quality.group.sales_script', 'Sales script')} score={stats?.salesScript ?? null} hint={t('quality.sales_script_hint', 'Offer, objections, next step')} />
      </div>

      <ScriptCard editable={isCeo} />

      {isCeo ? <DiagnosticsCard /> : null}

      {stats?.bySeller.length ? (
        <section className="rounded-[18px] bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--muted-strong)]">{t('quality.by_seller', 'Grades by seller')}</h3>
          <ul className="space-y-2">
            {[...stats.bySeller].sort((a, b) => (b.average ?? -1) - (a.average ?? -1)).map((seller) => (
              <li key={seller.name} className="flex items-center gap-3">
                <span className="w-40 truncate text-[13px] font-medium text-[var(--foreground)]">{seller.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--muted-surface)]"><span className="block h-full rounded-full" style={{ width: `${seller.average ?? 0}%`, background: scoreTone(seller.average) }} /></span>
                <span className="w-10 text-right text-[12.5px] font-semibold tabular-nums" style={{ color: scoreTone(seller.average) }}>{seller.average ?? '—'}</span>
                <span className="w-16 text-right text-[11.5px] text-[var(--muted)] tabular-nums">{t('quality.calls_n', '{{count}} calls', { count: seller.count })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto flex items-center gap-1.5 text-[14px] font-semibold text-[var(--foreground)]"><BadgeCheck size={16} className="text-[var(--primary)]" />{t('quality.list_title', 'Graded calls')}<span className="text-[12px] font-medium text-[var(--muted)] tabular-nums">{total || ''}</span></h3>
          <div role="radiogroup" className="flex gap-1 rounded-[13px] bg-[var(--muted-surface)] p-1">
            {filters.map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={filter === value} onClick={() => { setFilter(value); setPage(1) }} className={cn('h-8 rounded-[10px] px-3 text-[12.5px] font-semibold transition-colors', filter === value ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-[0_1px_3px_rgba(14,21,37,0.12)]' : 'text-[var(--muted-strong)] hover:text-[var(--foreground)]')}>{label}</button>
            ))}
          </div>
          <button type="button" onClick={() => { setPage(1); setVersion((value) => value + 1) }} aria-label={t('common.refresh', 'Refresh')} title={t('common.refresh', 'Refresh')} className="grid h-10 w-10 place-items-center rounded-[12px] bg-[var(--surface)] text-[var(--muted-strong)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]"><RefreshCw size={15} /></button>
        </div>

        {error ? <p role="alert" className="mb-2 rounded-[12px] bg-[var(--danger-dim)] px-3 py-2 text-[12.5px] text-[var(--danger-text)]">{error}</p> : null}
        {items === null ? (
          <ul className="space-y-2">{Array.from({ length: 4 }, (_, index) => <li key={index} className="h-[70px] animate-pulse rounded-[16px] bg-[var(--muted-surface)]" />)}</ul>
        ) : !items.length ? (
          <p className="rounded-[16px] border border-dashed border-[var(--border-hover)] px-4 py-10 text-center text-[13px] text-[var(--muted)]">{t('quality.empty', 'No graded calls yet. Open an answered call and press “Grade the call”, or turn on automatic grading.')}</p>
        ) : (
          <>
            <ul className="space-y-2">{items.map((item) => <GradedCall key={item.callId} item={item} />)}</ul>
            {items.length < total ? (
              <button type="button" onClick={() => setPage((value) => value + 1)} className="mx-auto mt-3 block h-9 rounded-[11px] bg-[var(--surface)] px-4 text-[13px] font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--input-surface)]">{t('quality.more', 'Show more')}</button>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
