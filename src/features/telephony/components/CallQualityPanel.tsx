import { useEffect, useState } from 'react'
import { BadgeCheck, ChevronDown, FileText, Loader2, RefreshCw, Save, UserRound } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { tashkentDayBound, telephonyQualityService, type CallQuality, type QualityStats, type SalesScript } from '../../../shared/api/services/telephonyQuality.service'
import { useToast } from '../../../shared/toast/useToast'
import { Switch } from '../../../shared/ui/switch'
import { QualityReport, ScoreRing } from './CallQualityCard'
import { formatDayTime, formatPhone, scoreTone } from './telephonyFormat'

type Filter = 'all' | 'completed' | 'pending' | 'processing' | 'failed'
type Period = 'all' | '30' | '7'

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

function ScriptField({ label, hint, value, onChange, placeholder }: { label: string; hint: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-[12.5px] font-semibold text-[var(--foreground)]">{label} <span className="font-normal text-[var(--muted)]">· {hint}</span></span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        placeholder={placeholder}
        className="control-field w-full rounded-[12px] px-3 py-2.5 font-mono text-[12.5px] leading-[1.6]"
      />
    </label>
  )
}

/** The script the AI grades against. The CEO edits it; everyone else can read it. */
function ScriptCard({ editable }: { editable: boolean }) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const [script, setScript] = useState<SalesScript | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [callScript, setCallScript] = useState('')
  const [salesScript, setSalesScript] = useState('')
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
      setCallScript(value.callScript)
      setSalesScript(value.salesScript)
    }).catch(() => { if (alive) setScript({ title: '', content: '', callScript: '', salesScript: '', updatedAt: null, updatedBy: null }) })
    if (editable) telephonyQualityService.settings().then((value) => { if (alive) setEnabled(value.enabled) }).catch(() => undefined)
    return () => { alive = false }
  }, [editable])

  const dirty = script !== null && (title !== script.title || content !== script.content || callScript !== script.callScript || salesScript !== script.salesScript)
  const hasText = Boolean(content.trim() || callScript.trim() || salesScript.trim())

  async function save() {
    setSaving(true)
    try {
      const input = { title: title.trim(), content: content.trim(), callScript: callScript.trim(), salesScript: salesScript.trim() }
      const saved = await telephonyQualityService.saveScript(input)
      const next = { ...saved, title: saved.title || input.title, content: saved.content || input.content, callScript: saved.callScript || input.callScript, salesScript: saved.salesScript || input.salesScript }
      setScript(next)
      setTitle(next.title)
      setContent(next.content)
      setCallScript(next.callScript)
      setSalesScript(next.salesScript)
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
            {script === null ? t('common.loading', 'Loading...') : script.content || script.callScript || script.salesScript
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
              <ScriptField
                label={t('quality.group.call_script', 'Call script')}
                hint={t('quality.call_script_hint', 'Greeting, introduction, closing')}
                value={callScript}
                onChange={setCallScript}
                placeholder={t('quality.call_script_placeholder', '1. Greeting: “Assalomu alaykum, Cognilabs, my name is …”\n2. Introduce yourself and the company\n3. Ask what the client needs\n4. Closing: agree on the next step')}
              />
              <ScriptField
                label={t('quality.group.sales_script', 'Sales script')}
                hint={t('quality.sales_script_hint', 'Offer, objections, next step')}
                value={salesScript}
                onChange={setSalesScript}
                placeholder={t('quality.sales_script_placeholder', '1. Offer: …\n2. Objections: “expensive” → …\n3. Next step: meeting / proposal / payment')}
              />
              <ScriptField
                label={t('quality.script_general', 'General rules')}
                hint={t('quality.script_general_hint', 'Anything else the AI should check in every call.')}
                value={content}
                onChange={setContent}
                placeholder={t('quality.script_placeholder', '1. Greeting: “Assalomu alaykum, Cognilabs, my name is …”\n2. Find out the need: what business, what problem…\n3. Offer: …\n4. Objections: “expensive” → …\n5. Next step: meeting / proposal / payment')}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11.5px] text-[var(--muted)]">
                  {script.updatedAt ? t('quality.script_updated', 'Updated {{when}}', { when: formatDayTime(script.updatedAt) }) : t('quality.script_tip', 'Write the steps in order; the AI checks each one.')}
                  {script.updatedBy ? ` · ${script.updatedBy}` : ''}
                </p>
                <button type="button" onClick={() => void save()} disabled={!dirty || saving || !hasText} className="inline-flex h-9 items-center gap-1.5 rounded-[11px] bg-[var(--primary)] px-3.5 text-[13px] font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-40">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{t('common.save', 'Save')}
                </button>
              </div>
            </div>
          ) : script.content || script.callScript || script.salesScript ? (
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {([
                [t('quality.group.call_script', 'Call script'), script.callScript],
                [t('quality.group.sales_script', 'Sales script'), script.salesScript],
                [t('quality.script_general', 'General rules'), script.content],
              ] as const).filter(([, text]) => text).map(([label, text]) => (
                <div key={label}>
                  <p className="mb-1 text-[11.5px] font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</p>
                  <p className="text-[12.5px] leading-[1.6] whitespace-pre-wrap text-[var(--muted-strong)]">{text}</p>
                </div>
              ))}
            </div>
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

/** Calls → "Grades" tab: average grades, the script, and every graded call. */
function periodRange(period: Period) {
  return period === 'all' ? {} : { dateFrom: tashkentDayBound(Number(period) - 1, 'start'), dateTo: tashkentDayBound(0, 'end') }
}

export function CallQualityPanel({ isCeo }: { isCeo: boolean }) {
  const { t } = useLocale()
  const [stats, setStats] = useState<QualityStats | null>(null)
  const [items, setItems] = useState<CallQuality[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<Filter>('all')
  const [version, setVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('all')

  useEffect(() => {
    let alive = true
    const range = periodRange(period)
    telephonyQualityService.stats(range)
      .then((value) => { if (alive) setStats(value) })
      .catch(() => undefined)
    return () => { alive = false }
  }, [version, period])

  useEffect(() => {
    let alive = true
    // The list follows the same period as the tiles (it used to show every call whatever the period).
    telephonyQualityService.calls({ status: filter === 'all' ? undefined : filter, page, pageSize: 20, ...periodRange(period) })
      .then((value) => {
        if (!alive) return
        setError(null)
        setItems((current) => (page === 1 || !current ? value.items : [...current, ...value.items.filter((entry) => !current.some((known) => known.callId === entry.callId))]))
        setTotal(value.total)
      })
      .catch((cause: unknown) => { if (alive) { setItems((current) => current ?? []); setError(getApiErrorMessage(cause)) } })
    return () => { alive = false }
  }, [filter, page, version, period])

  const filters: Array<[Filter, string]> = [
    ['all', t('quality.filter.all', 'All')],
    ['completed', t('quality.filter.completed', 'Graded')],
    ['pending', t('quality.filter.pending', 'In queue')],
    ['processing', t('quality.filter.processing', 'Grading')],
    ['failed', t('quality.filter.failed', 'Failed')],
  ]

  const periods: Array<[Period, string]> = [
    ['all', t('quality.period.all', 'All time')],
    ['30', t('quality.period.30', '30 days')],
    ['7', t('quality.period.7', '7 days')],
  ]

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label={t('quality.period.label', 'Period')} className="flex w-fit gap-1 rounded-[13px] bg-[var(--muted-surface)] p-1">
        {periods.map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={period === value} onClick={() => { setPeriod(value); setPage(1) }} className={cn('h-8 rounded-[10px] px-3 text-[12.5px] font-semibold transition-colors', period === value ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-[0_1px_3px_rgba(14,21,37,0.12)]' : 'text-[var(--muted-strong)] hover:text-[var(--foreground)]')}>{label}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={t('quality.avg_overall', 'Average grade')} score={stats?.average ?? null} hint={!stats ? undefined : stats.analyzed ? t('quality.graded_count', '{{count}} calls graded', { count: stats.analyzed }) : t('quality.no_analyses', 'No analyses yet')} />
        <Tile label={t('quality.group.call_script', 'Call script')} score={stats?.callScript ?? null} hint={t('quality.call_script_hint', 'Greeting, introduction, closing')} />
        <Tile label={t('quality.group.analysis', 'Analysis')} score={stats?.analysis ?? null} hint={t('quality.analysis_hint', 'Needs found, questions, listening')} />
        <Tile label={t('quality.group.sales_script', 'Sales script')} score={stats?.salesScript ?? null} hint={t('quality.sales_script_hint', 'Offer, objections, next step')} />
      </div>

      <ScriptCard editable={isCeo} />

      {stats ? (
        <section className="rounded-[18px] bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--muted-strong)]">{t('quality.by_seller', 'Grades by seller')}</h3>
          {!stats.bySeller.length ? (
            <p className="text-[12.5px] text-[var(--muted)]">{t('quality.no_analyses', 'No analyses yet')}</p>
          ) : (
          <ul className="space-y-2">
            {stats.bySeller.map((seller) => (
              <li key={seller.userId ?? seller.name} className="flex items-center gap-3">
                <span className="w-40 truncate text-[13px] font-medium text-[var(--foreground)]">{seller.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--muted-surface)]"><span className="block h-full rounded-full" style={{ width: `${seller.average ?? 0}%`, background: scoreTone(seller.average) }} /></span>
                <span className="w-10 text-right text-[12.5px] font-semibold tabular-nums" style={{ color: scoreTone(seller.average) }}>{seller.average ?? '—'}</span>
                <span className="w-16 text-right text-[11.5px] text-[var(--muted)] tabular-nums">{t('quality.calls_n', '{{count}} calls', { count: seller.count })}</span>
              </li>
            ))}
          </ul>
          )}
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
