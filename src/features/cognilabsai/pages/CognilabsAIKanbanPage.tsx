import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '../../../shared/lib/cn'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import {
  cognilabsaiService,
  type ConversationItem,
  type WsEvent,
} from '../../../shared/api/services/cognilabsai.service'

type ChannelTab = 'all' | 'instagram' | 'telegram'

type StageConfig = { key: string; label: string; color: string; bg: string; border: string; dot: string }

const STAGE_PALETTE: Array<{ color: string; bg: string; border: string; dot: string }> = [
  { color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20',   dot: 'bg-slate-400' },
  { color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     dot: 'bg-sky-400' },
  { color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-400' },
  { color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  dot: 'bg-violet-400' },
  { color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  dot: 'bg-indigo-400' },
  { color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  dot: 'bg-purple-400' },
  { color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20', dot: 'bg-fuchsia-400' },
  { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-400' },
  { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  { color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  dot: 'bg-orange-400' },
  { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-400' },
  { color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    dot: 'bg-teal-400' },
  { color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    dot: 'bg-cyan-400' },
  { color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    dot: 'bg-rose-400' },
  { color: 'text-lime-400',    bg: 'bg-lime-500/10',    border: 'border-lime-500/20',    dot: 'bg-lime-400' },
]

const FALLBACK_STAGES: StageConfig[] = [
  { key: 'service_interest',    label: 'Xizmatga qiziqdi',       ...STAGE_PALETTE[0] },
  { key: 'business_field',      label: 'Sohasini yozdi',         ...STAGE_PALETTE[1] },
  { key: 'experience_years',    label: 'Sohadagi yil etildi',    ...STAGE_PALETTE[2] },
  { key: 'phone_discussion',    label: 'Telefon orqali muhokama',...STAGE_PALETTE[3] },
  { key: 'phone_collected',     label: 'Telefon olindi',         ...STAGE_PALETTE[4] },
  { key: 'call_time_collected', label: 'Qulay vaqt olindi',      ...STAGE_PALETTE[5] },
  { key: 'name_collected',      label: 'Ism olindi',             ...STAGE_PALETTE[6] },
  { key: 'agreement_confirmed', label: 'Kelishuv tasdiqlandi',   ...STAGE_PALETTE[7] },
  { key: 'lead_created',        label: 'Lead yaratildi',         ...STAGE_PALETTE[8] },
  { key: 'lost',                label: "Yo'qotildi",             ...STAGE_PALETTE[10] },
]

const FALLBACK_LABEL_MAP = new Map(FALLBACK_STAGES.map((s) => [s.key, s.label]))

function buildStageConfigs(apiStages: Array<{ value: string; label: string; order?: number | null }>): StageConfig[] {
  return apiStages.map((s, i) => ({
    key: s.value,
    label: FALLBACK_LABEL_MAP.get(s.value) ?? s.label,
    ...STAGE_PALETTE[i % STAGE_PALETTE.length],
  }))
}


function getChannelBadgeStyle(channel: string) {
  if (channel === 'instagram') return { bg: 'bg-pink-500', label: 'IG' }
  if (channel === 'telegram') return { bg: 'bg-[#2AABEE]', label: 'TG' }
  return { bg: 'bg-emerald-500', label: 'WS' }
}

function AvatarInitials({ name, url, size = 'sm' }: { name: string; url?: string | null; size?: 'sm' | 'xs' }) {
  const [failed, setFailed] = useState(false)
  const resolved = url ? cognilabsaiService.buildAvatarUrl(url) ?? resolveMediaUrl(url) : null
  const sizeClass = size === 'xs' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-[12px]'

  if (resolved && !failed) {
    return (
      <img
        src={resolved}
        alt={name}
        onError={() => setFailed(true)}
        className={cn(sizeClass, 'rounded-full object-cover ring-1 ring-[var(--border)] shrink-0')}
      />
    )
  }

  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <div className={cn(
      sizeClass,
      'rounded-full bg-[var(--blue-dim)] text-[var(--blue-text)] font-semibold flex items-center justify-center select-none ring-1 ring-[var(--border)] shrink-0',
    )}>
      {initials}
    </div>
  )
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 1) {
    const diffM = Math.floor(diffMs / 60000)
    return diffM < 1 ? 'hozir' : `${diffM}d`
  }
  if (diffH < 24) return `${diffH}s`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}k`
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })
}

function getClientName(conv: ConversationItem): string {
  return conv.client_display_name || conv.client_full_name || conv.client_username || `#${conv.id}`
}

function KanbanCard({ conv, onClick, highlighted }: { conv: ConversationItem; onClick: () => void; highlighted?: boolean }) {
  const name = getClientName(conv)
  const ch = getChannelBadgeStyle(conv.channel)
  const hasFollowUpScheduled = !conv.crm_customer_id && !conv.lead_phone_number && conv.ai_follow_up_due_at
  const hasFollowUpSent = !conv.crm_customer_id && !conv.lead_phone_number && conv.ai_follow_up_sent_at

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full text-left rounded-xl border p-3 transition-all duration-150 hover:shadow-md active:scale-[0.98]',
        highlighted
          ? 'border-blue-500/60 bg-blue-500/8 shadow-[0_0_0_2px_rgba(59,130,246,0.25)] hover:border-blue-500/80 hover:bg-blue-500/12'
          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-elevated)]',
      )}
    >
      <div className="flex items-start gap-2.5 mb-2">
        <div className="relative shrink-0 mt-0.5">
          <AvatarInitials name={name} url={conv.client_avatar_url} size="sm" />
          <div className={cn(
            'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface)] text-[7px] font-bold text-white flex items-center justify-center',
            ch.bg,
          )}>
            {ch.label[0]}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--foreground)] truncate leading-snug">{name}</p>
          {conv.ai_interest && (
            <p className="text-[11px] text-[var(--muted)] mt-0.5 truncate">{conv.ai_interest}</p>
          )}
        </div>

        <span className="shrink-0 text-[10px] text-[var(--caption)] font-medium">{formatTime(conv.last_message_at)}</span>
      </div>

      {conv.last_message_preview && (
        <p className="text-[11.5px] text-[var(--caption)] leading-relaxed line-clamp-2 mb-2">
          {conv.last_message_preview}
        </p>
      )}

      {/* Tags row */}
      <div className="flex flex-wrap gap-1">
        {conv.lead_phone_number && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            {conv.lead_phone_number}
          </span>
        )}
        {conv.crm_customer_id && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
            CRM
          </span>
        )}
        {conv.unread_count > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-blue-600 px-1.5 h-4 min-w-4 text-[9px] font-bold text-white">
            {conv.unread_count > 99 ? '99+' : conv.unread_count}
          </span>
        )}
        {hasFollowUpSent && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
            AI Follow-up ✓
          </span>
        )}
        {hasFollowUpScheduled && !hasFollowUpSent && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-purple-400">
            ⏱ AI Follow-up
          </span>
        )}
        {conv.pause_reason && (
          <span className="inline-flex items-center rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
            {conv.pause_reason}
          </span>
        )}
      </div>
    </button>
  )
}

function KanbanColumn({
  stage,
  cards,
  onCardClick,
  highlightedConvId,
}: {
  stage: StageConfig
  cards: ConversationItem[]
  onCardClick: (id: number) => void
  highlightedConvId?: number | null
}) {
  return (
    <div className="flex flex-col w-[280px] shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden h-full">
      {/* Column header */}
      <div className={cn('flex items-center justify-between gap-2 px-3.5 py-3 border-b border-[var(--border)]', stage.bg)}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('h-2 w-2 rounded-full shrink-0', stage.dot)} />
          <h3 className={cn('text-[12px] font-bold uppercase tracking-wider truncate', stage.color)}>
            {stage.label}
          </h3>
        </div>
        <span className={cn(
          'shrink-0 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
          stage.bg, stage.color, 'border', stage.border,
        )}>
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar-visible min-h-0">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className={cn('text-2xl opacity-20', stage.dot.replace('bg-', 'text-'))}>—</span>
            <p className="text-[11px] text-[var(--caption)] mt-1">Bo'sh</p>
          </div>
        ) : (
          cards.map((conv) => (
            <KanbanCard key={conv.id} conv={conv} onClick={() => onCardClick(conv.id)} highlighted={highlightedConvId === conv.id} />
          ))
        )}
      </div>
    </div>
  )
}

const CHANNEL_TABS: { key: ChannelTab; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'telegram', label: 'Telegram' },
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
  }, [])

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
    if (channelTab === 'all') return conversations
    return conversations.filter((c) => c.channel === channelTab)
  }, [conversations, channelTab])

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
        const palette = STAGE_PALETTE[(stages.length + extraIdx) % STAGE_PALETTE.length]
        result.push({ key, label: key.replaceAll('_', ' '), ...palette })
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

  function handleCardClick(conversationId: number) {
    navigate(`/cognilabsai/chat?conversation_id=${conversationId}&return_to=kanban`)
  }

  return (
    <div className="flex flex-col h-full -mx-4 -mt-4 -mb-6 sm:-mx-6 lg:-mx-8" style={{ height: 'calc(100vh - 74px)' }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-b border-[var(--border)] bg-[var(--surface)] flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--foreground)] tracking-tight">AI Kanban</h2>
            {lastRefresh && (
              <p className="text-[10px] text-[var(--caption)]">
                Yangilandi: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[12px] text-[var(--muted)]">AI faol: <strong className="text-[var(--foreground)]">{totalActive}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-[12px] text-[var(--muted)]">Leadlar: <strong className="text-emerald-400">{totalLeads}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-[12px] text-[var(--muted)]">Jami: <strong className="text-[var(--foreground)]">{filtered.length}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Channel filter */}
          <div className="flex items-center gap-1 rounded-xl bg-[var(--background)] border border-[var(--border)] p-1">
            {CHANNEL_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setChannelTab(tab.key)}
                className={cn(
                  'px-3 py-1 rounded-lg text-[12px] font-semibold transition-all',
                  channelTab === tab.key
                    ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void fetchAll()}
            disabled={isLoading}
            className="h-8 w-8 flex items-center justify-center rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors disabled:opacity-50"
            title="Yangilash"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn('h-4 w-4', isLoading && 'animate-spin')}>
              <path d="M1 4v6h6M23 20v-6h-6"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Kanban board */}
      {isLoading && conversations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-[13px] text-[var(--muted)]">Yuklanmoqda...</p>
          </div>
        </div>
      ) : (
        <div
          ref={boardRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
          onClickCapture={(e) => {
            if (dragRef.current.didDrag) {
              e.stopPropagation()
              dragRef.current.didDrag = false
            }
          }}
        >
          <div className="flex gap-4 p-4 h-full" style={{ width: 'max-content' }}>
            {orderedStages.map((stage) => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                cards={byStage.get(stage.key) ?? []}
                onCardClick={handleCardClick}
                highlightedConvId={highlightedConvId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
