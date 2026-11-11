import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BellRing, Bot, CheckCheck, ChevronsLeftRight, Clock3, MessagesSquare, PauseCircle, Phone, RefreshCw, Search, Sparkles, UserCheck, X } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import {
  cognilabsaiService,
  type ConversationItem,
  type WsEvent,
} from '../../../shared/api/services/cognilabsai.service'

type ChannelTab = 'all' | 'instagram' | 'telegram'

type StageConfig = { key: string; label: string; tone: string }

/** One colour per funnel step: cool → warm → green (won) → red (lost). */
const STAGE_PALETTE: string[] = [
  '#94a3b8', '#60a5fa', '#3b82f6', '#818cf8', '#a78bfa', '#c084fc',
  '#f59e0b', '#a3e635', '#22c55e', '#fb923c', '#ef4444', '#2dd4bf', '#38bdf8', '#f43f5e', '#84cc16',
]

const FALLBACK_STAGES: StageConfig[] = [
  { key: 'service_interest',    label: 'Xizmatga qiziqdi',       tone: STAGE_PALETTE[0] },
  { key: 'business_field',      label: 'Sohasini yozdi',         tone: STAGE_PALETTE[1] },
  { key: 'experience_years',    label: 'Sohadagi yil etildi',    tone: STAGE_PALETTE[2] },
  { key: 'phone_discussion',    label: 'Telefon orqali muhokama',tone: STAGE_PALETTE[3] },
  { key: 'phone_collected',     label: 'Telefon olindi',         tone: STAGE_PALETTE[4] },
  { key: 'call_time_collected', label: 'Qulay vaqt olindi',      tone: STAGE_PALETTE[5] },
  { key: 'name_collected',      label: 'Ism olindi',             tone: STAGE_PALETTE[6] },
  { key: 'agreement_confirmed', label: 'Kelishuv tasdiqlandi',   tone: STAGE_PALETTE[7] },
  { key: 'lead_created',        label: 'Lead yaratildi',         tone: STAGE_PALETTE[8] },
  { key: 'lost',                label: "Yo'qotildi",             tone: STAGE_PALETTE[10] },
]

const FALLBACK_LABEL_MAP = new Map(FALLBACK_STAGES.map((s) => [s.key, s.label]))

function buildStageConfigs(apiStages: Array<{ value: string; label: string; order?: number | null }>): StageConfig[] {
  return apiStages.map((s, i) => ({
    key: s.value,
    label: FALLBACK_LABEL_MAP.get(s.value) ?? s.label,
    tone: STAGE_PALETTE[i % STAGE_PALETTE.length],
  }))
}


const CHANNEL_DOT: Record<string, { color: string; label: string }> = {
  instagram: { color: '#d946ef', label: 'Instagram' },
  telegram: { color: '#2b9cf2', label: 'Telegram' },
}

function channelLook(channel: string) {
  return CHANNEL_DOT[channel] ?? { color: '#22c55e', label: 'Website' }
}

function AvatarInitials({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false)
  const resolved = url ? cognilabsaiService.buildAvatarUrl(url) ?? resolveMediaUrl(url) : null
  if (resolved && !failed) {
    return <img src={resolved} alt="" onError={() => setFailed(true)} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const hue = 200 + (hash % 120)
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full text-[11px] font-bold text-white select-none"
      style={{ width: size, height: size, background: `linear-gradient(150deg, hsl(${hue} 80% 62%), hsl(${hue + 24} 70% 48%))` }}
    >
      {initials}
    </span>
  )
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 1) {
    const diffM = Math.floor(diffMs / 60000)
    return diffM < 1 ? 'hozir' : `${diffM} daq`
  }
  if (diffH < 24) return `${diffH} soat`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} kun`
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })
}

function getClientName(conv: ConversationItem): string {
  return conv.client_display_name || conv.client_full_name || conv.client_username || `#${conv.id}`
}

/** Compact card: who, from where, how fresh, and the few facts that matter (phone, CRM, unread, follow-up). */
function KanbanCard({ conv, onClick, highlighted, index }: { conv: ConversationItem; onClick: () => void; highlighted?: boolean; index: number }) {
  const name = getClientName(conv)
  const channel = channelLook(conv.channel)
  const followUpSent = !conv.crm_customer_id && !conv.lead_phone_number && conv.ai_follow_up_sent_at
  const followUpDue = !conv.crm_customer_id && !conv.lead_phone_number && conv.ai_follow_up_due_at && !followUpSent
  const subtitle = conv.ai_interest || conv.last_message_preview

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('kb-card kb-in group w-full rounded-[14px] p-2.5 text-left', highlighted && 'ring-2 ring-[#b8f15a]')}
      style={{ animationDelay: `${Math.min(index * 35, 420)}ms` }}
    >
      <div className="flex items-center gap-2.5">
        <span className="relative shrink-0">
          <AvatarInitials name={name} url={conv.client_avatar_url} />
          <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2 ring-[var(--kb-card)]" style={{ background: channel.color }} title={channel.label} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{name}</span>
            <span className="shrink-0 text-[10.5px] font-medium text-[var(--caption)] tabular-nums">{formatTime(conv.last_message_at)}</span>
          </span>
          {subtitle ? <span className="mt-0.5 block truncate text-[11.5px] text-[var(--muted)]">{subtitle}</span> : null}
        </span>
      </div>

      {conv.lead_phone_number || conv.crm_customer_id || conv.unread_count > 0 || followUpSent || followUpDue || conv.pause_reason ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {conv.unread_count > 0 ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[var(--primary)] px-1.5 text-[10.5px] font-bold text-white tabular-nums">
              <MessagesSquare size={10} />{conv.unread_count > 99 ? '99+' : conv.unread_count}
            </span>
          ) : null}
          {conv.lead_phone_number ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[var(--success-dim)] px-1.5 text-[10.5px] font-semibold text-[var(--success-text)] tabular-nums">
              <Phone size={10} />{conv.lead_phone_number}
            </span>
          ) : null}
          {conv.crm_customer_id ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[var(--blue-dim)] px-1.5 text-[10.5px] font-semibold text-[var(--blue-text)]"><UserCheck size={10} />CRM</span>
          ) : null}
          {followUpSent ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[var(--violet-dim)] px-1.5 text-[10.5px] font-semibold text-[var(--violet-text)]"><CheckCheck size={10} />Follow-up</span>
          ) : null}
          {followUpDue ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[var(--violet-dim)] px-1.5 text-[10.5px] font-semibold text-[var(--violet-text)]"><Clock3 size={10} />Follow-up</span>
          ) : null}
          {conv.pause_reason ? (
            <span className="inline-flex h-5 max-w-full items-center gap-1 truncate rounded-full bg-[var(--warning-dim)] px-1.5 text-[10.5px] font-semibold text-[var(--warning-text)]"><PauseCircle size={10} />{conv.pause_reason}</span>
          ) : null}
        </div>
      ) : null}
    </button>
  )
}

function KanbanColumn({
  stage, cards, total, onCardClick, highlightedConvId, collapsed, onToggle,
}: {
  stage: StageConfig
  cards: ConversationItem[]
  total: number
  onCardClick: (id: number) => void
  highlightedConvId?: number | null
  collapsed: boolean
  onToggle: () => void
}) {
  const share = total > 0 ? Math.round((cards.length / total) * 100) : 0

  if (collapsed) {
    // Empty / folded stage: a slim strip so the board stays compact.
    return (
      <button
        type="button"
        onClick={onToggle}
        title={stage.label}
        className="kb-col group flex h-full w-[46px] shrink-0 flex-col items-center gap-3 rounded-[16px] py-3 transition-[width] duration-300"
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stage.tone, boxShadow: `0 0 12px ${stage.tone}` }} />
        <span className="rounded-full bg-white/10 px-1.5 text-[11px] font-bold text-[var(--kb-muted)] tabular-nums">{cards.length}</span>
        <span className="truncate text-[12px] font-semibold text-[var(--kb-muted)] group-hover:text-white" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{stage.label}</span>
      </button>
    )
  }

  return (
    <section className="kb-col flex h-full w-[276px] shrink-0 flex-col overflow-hidden rounded-[18px]">
      <span className="h-[3px] w-full shrink-0" style={{ background: `linear-gradient(90deg, ${stage.tone}, transparent)` }} />
      <header className="flex shrink-0 items-center gap-2 px-3 pt-2.5 pb-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stage.tone, boxShadow: `0 0 10px ${stage.tone}` }} />
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{stage.label}</h3>
        <span className="text-[11px] font-semibold text-[var(--kb-faint)] tabular-nums">{share}%</span>
        <span className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11.5px] font-bold text-[#0d1426] tabular-nums" style={{ background: stage.tone }}>{cards.length}</span>
        <button type="button" onClick={onToggle} title="Yig'ish" aria-label="Yig'ish" className="grid h-6 w-6 place-items-center rounded-full text-[var(--kb-faint)] transition-colors hover:bg-white/10 hover:text-white">
          <ChevronsLeftRight size={13} />
        </button>
      </header>
      <div className="kb-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-2 pb-2">
        {cards.length === 0 ? (
          <p className="kb-ghost rounded-[14px] py-8 text-center text-[12px]">Bo'sh</p>
        ) : cards.map((conv, index) => (
          <KanbanCard key={conv.id} conv={conv} index={index} onClick={() => onCardClick(conv.id)} highlighted={highlightedConvId === conv.id} />
        ))}
      </div>
    </section>
  )
}

function KanbanBoardSkeleton() {
  return (
    <div className="flex h-full gap-3 p-4">
      {[0, 1, 2, 3, 4].map((column) => (
        <div key={column} className="kb-col flex w-[276px] shrink-0 flex-col gap-2 rounded-[18px] p-2.5">
          <span className="block h-6 w-2/3 rounded-full bg-white/10" />
          {[0, 1, 2].map((row) => <span key={row} className="block h-[68px] rounded-[14px] bg-white/[0.07]" />)}
        </div>
      ))}
    </div>
  )
}

const CHANNEL_TABS: Array<{ value: ChannelTab; label: string }> = [
  { value: 'all', label: 'Barchasi' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'telegram', label: 'Telegram' },
]

export function CognilabsAIKanbanPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [channelTab, setChannelTab] = useState<ChannelTab>('instagram')
  const [wsKey, setWsKey] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [stages, setStages] = useState<StageConfig[]>(FALLBACK_STAGES)
  const [query, setQuery] = useState('')
  // Columns the user folded / unfolded by hand (empty ones start folded).
  const [folded, setFolded] = useState<Record<string, boolean>>({})

  const highlightedConvId = useMemo(() => {
    const raw = searchParams.get('highlight')
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [searchParams])

  const conversationsRef = useRef<ConversationItem[]>([])
  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  const boardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0, didDrag: false })
  // The board element only exists once the first load is done — attach drag-to-scroll then.
  const boardReady = !(isLoading && conversations.length === 0)

  useEffect(() => {
    const el = boardRef.current
    if (!el) return

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      dragRef.current.isDown = true
      dragRef.current.startX = e.pageX - el.offsetLeft
      dragRef.current.scrollLeft = el.scrollLeft
      dragRef.current.didDrag = false
      el.style.userSelect = 'none'
      el.style.cursor = 'grabbing'
    }

    const onMouseUp = () => {
      dragRef.current.isDown = false
      el.style.userSelect = ''
      el.style.cursor = 'grab'
    }

    const onMouseLeave = () => {
      dragRef.current.isDown = false
      el.style.userSelect = ''
      el.style.cursor = 'grab'
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.isDown) return
      e.preventDefault()
      const x = e.pageX - el.offsetLeft
      const walk = (x - dragRef.current.startX) * 1.2
      if (Math.abs(walk) > 5) dragRef.current.didDrag = true
      el.scrollLeft = dragRef.current.scrollLeft - walk
    }

    el.style.cursor = 'grab'
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mouseup', onMouseUp)
    el.addEventListener('mouseleave', onMouseLeave)
    el.addEventListener('mousemove', onMouseMove)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('mouseleave', onMouseLeave)
      el.removeEventListener('mousemove', onMouseMove)
    }
  }, [boardReady])

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const all: ConversationItem[] = []
      let offset = 0
      const limit = 100
      while (true) {
        const page = await cognilabsaiService.listConversations(undefined, limit, offset)
        all.push(...page.items)
        if (all.length >= page.total || page.items.length < limit) break
        offset += limit
      }
      setConversations(all)
      setLastRefresh(new Date())
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const fallbackOrder = new Map(FALLBACK_STAGES.map((s, i) => [s.key, i]))
    cognilabsaiService.listAiStages()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const sorted = [...data].sort((a, b) => {
            const ai = fallbackOrder.get(a.value) ?? 9999
            const bi = fallbackOrder.get(b.value) ?? 9999
            return ai - bi
          })
          setStages(buildStageConfigs(sorted))
        }
      })
      .catch(() => {/* keep fallback */})
  }, [])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => void fetchAll(), 60_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  useAsyncData(
    () => cognilabsaiService.getIntegrations(),
    [],
    {
      onSuccess: (data) => {
        if (data.websocket_api_key) setWsKey(data.websocket_api_key)
      },
    },
  )

  // WebSocket for real-time updates
  useEffect(() => {
    if (!wsKey) return

    let socket: WebSocket | null = null
    let isMount = true
    let reconnect: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (!isMount) return
      const sock = cognilabsaiService.createWebSocket(wsKey!)
      socket = sock

      sock.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as WsEvent
          if (data.type === 'conversation.updated') {
            setConversations((prev) => {
              const exists = prev.some((c) => c.id === data.conversation_id)
              if (exists) return prev.map((c) => c.id === data.conversation_id ? data.conversation : c)
              return [data.conversation, ...prev]
            })
          } else if (data.type === 'message.created') {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === data.conversation_id
                  ? { ...c, last_message_at: data.message.created_at, last_message_preview: data.message.text, unread_count: c.unread_count + 1 }
                  : c,
              ),
            )
          }
        } catch {
          // ignore
        }
      }

      sock.onerror = () => {}
      sock.onclose = () => {
        if (isMount) reconnect = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      isMount = false
      if (reconnect) clearTimeout(reconnect)
      socket?.close()
    }
  }, [wsKey])

  const filtered = useMemo(() => {
    const byChannel = channelTab === 'all' ? conversations : conversations.filter((c) => c.channel === channelTab)
    const needle = query.trim().toLowerCase()
    if (!needle) return byChannel
    return byChannel.filter((c) => [getClientName(c), c.client_username, c.lead_phone_number, c.ai_interest, c.last_message_preview]
      .some((value) => value?.toLowerCase().includes(needle)))
  }, [conversations, channelTab, query])

  const byStage = useMemo(() => {
    const map = new Map<string, ConversationItem[]>()
    for (const conv of filtered) {
      const key = conv.ai_stage ?? 'new'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(conv)
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
        return tb - ta
      })
    }
    return map
  }, [filtered])

  // Ordered column list: API stages first (with their labels), then extra from conversations, then empty API stages
  const orderedStages = useMemo((): StageConfig[] => {
    const result: StageConfig[] = []
    const usedKeys = new Set<string>()

    // 1. API stages that have conversations
    for (const s of stages) {
      if (byStage.has(s.key)) {
        result.push(s)
        usedKeys.add(s.key)
      }
    }

    // 2. Conversation stages not in API list
    let extraIdx = 0
    for (const key of byStage.keys()) {
      if (!usedKeys.has(key)) {
        const tone = STAGE_PALETTE[(stages.length + extraIdx) % STAGE_PALETTE.length]
        result.push({ key, label: key.replaceAll('_', ' '), tone })
        usedKeys.add(key)
        extraIdx++
      }
    }

    // 3. API stages with no conversations (show empty columns last)
    for (const s of stages) {
      if (!usedKeys.has(s.key)) {
        result.push(s)
        usedKeys.add(s.key)
      }
    }

    return result
  }, [stages, byStage])

  const totalActive = filtered.filter((c) => c.ai_enabled).length
  const totalLeads = filtered.filter((c) => c.ai_stage === 'lead_created').length
  const totalUnread = filtered.reduce((sum, c) => sum + (c.unread_count > 0 ? 1 : 0), 0)
  const conversion = filtered.length > 0 ? Math.round((totalLeads / filtered.length) * 100) : 0

  function handleCardClick(conversationId: number) {
    navigate(`/cognilabsai/chat?conversation_id=${conversationId}&return_to=kanban`)
  }

  const isFolded = (stage: StageConfig) => folded[stage.key] ?? (byStage.get(stage.key)?.length ?? 0) === 0
  const kpis = [
    { key: 'all', label: 'Suhbatlar', value: filtered.length, icon: MessagesSquare, color: '#60a5fa' },
    { key: 'ai', label: 'AI javob bermoqda', value: totalActive, icon: Bot, color: '#a78bfa' },
    { key: 'lead', label: 'Lead yaratildi', value: totalLeads, hint: `${conversion}%`, icon: Sparkles, color: '#22c55e' },
    { key: 'unread', label: "O'qilmagan", value: totalUnread, icon: BellRing, color: '#f59e0b' },
  ]

  return (
    <div className="-mx-7 -mt-[26px] -mb-10 flex flex-col" style={{ height: 'var(--page-h-bleed)' }}>
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3 px-7 pt-[22px] pb-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--foreground)]">AI Kanban</h2>
          <p className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" /></span>
            Jonli{lastRefresh ? ` · yangilandi ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="relative flex h-10 w-[240px] items-center">
            <Search size={15} className="pointer-events-none absolute left-3 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ism, telefon yoki xabar"
              aria-label="Qidirish"
              className="h-10 w-full rounded-[12px] bg-[var(--surface)] pr-8 pl-9 text-[13px] text-[var(--foreground)] ring-1 ring-[var(--border)] placeholder:text-[var(--caption)] focus:ring-2 focus:ring-[var(--primary)] focus:outline-none"
            />
            {query ? <button type="button" onClick={() => setQuery('')} aria-label="Tozalash" className="absolute right-2 grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--input-surface)]"><X size={13} /></button> : null}
          </label>
          <div role="radiogroup" aria-label="Kanal" className="inline-flex h-10 rounded-[12px] bg-[var(--surface)] p-1 ring-1 ring-[var(--border)]">
            {CHANNEL_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="radio"
                aria-checked={channelTab === tab.value}
                onClick={() => setChannelTab(tab.value)}
                className={cn('rounded-[9px] px-3 text-[12.5px] font-semibold transition-colors', channelTab === tab.value ? 'bg-[#0d1426] text-white dark:bg-white dark:text-[#0d1426]' : 'text-[var(--muted-strong)] hover:text-[var(--foreground)]')}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void fetchAll()} disabled={isLoading} aria-label="Yangilash" title="Yangilash" className="grid h-10 w-10 place-items-center rounded-[12px] bg-[var(--surface)] text-[var(--muted-strong)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--primary)] disabled:opacity-50">
            <RefreshCw size={16} className={cn(isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Key numbers + funnel at a glance */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-7 pb-3">
        {kpis.map(({ key, label, value, hint, icon: Icon, color }) => (
          <span key={key} className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--surface)] pr-3.5 pl-1.5 ring-1 ring-[var(--border)]">
            <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}><Icon size={13} /></span>
            <span className="text-[12.5px] text-[var(--muted)]">{label}</span>
            <strong className="text-[13px] font-bold text-[var(--foreground)] tabular-nums">{value}</strong>
            {hint ? <span className="text-[11.5px] font-semibold text-[var(--success-text)]">{hint}</span> : null}
          </span>
        ))}
        {filtered.length > 0 ? (
          <div className="ml-auto flex h-2.5 min-w-[220px] flex-1 basis-[260px] overflow-hidden rounded-full bg-[var(--track)] sm:max-w-[420px]" title="Bosqichlar bo'yicha taqsimot">
            {orderedStages.map((stage) => {
              const count = byStage.get(stage.key)?.length ?? 0
              return count ? <span key={stage.key} title={`${stage.label}: ${count}`} className="h-full transition-[width] duration-500" style={{ width: `${(count / filtered.length) * 100}%`, background: stage.tone }} /> : null
            })}
          </div>
        ) : null}
      </div>

      {/* Board on its own canvas */}
      <div className="kb-surface mx-7 mb-[18px] min-h-0 flex-1 overflow-hidden rounded-[24px]">
        {isLoading && conversations.length === 0 ? (
          <KanbanBoardSkeleton />
        ) : (
          <div
            ref={boardRef}
            className="kb-scroll h-full overflow-x-auto overflow-y-hidden"
            onClickCapture={(e) => {
              if (dragRef.current.didDrag) {
                e.stopPropagation()
                dragRef.current.didDrag = false
              }
            }}
          >
            <div className="flex h-full gap-3 p-4" style={{ width: 'max-content' }}>
              {orderedStages.map((stage) => (
                <KanbanColumn
                  key={stage.key}
                  stage={stage}
                  cards={byStage.get(stage.key) ?? []}
                  total={filtered.length}
                  onCardClick={handleCardClick}
                  highlightedConvId={highlightedConvId}
                  collapsed={isFolded(stage)}
                  onToggle={() => setFolded((current) => ({ ...current, [stage.key]: !isFolded(stage) }))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
