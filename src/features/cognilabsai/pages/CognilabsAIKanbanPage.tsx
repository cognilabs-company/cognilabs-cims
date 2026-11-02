import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Phone, RefreshCw } from 'lucide-react'
import { cn } from '../../../shared/lib/cn'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import { Badge } from '../../../shared/ui/badge'
import { IconButton } from '../../../shared/ui/icon-button'
import { Skeleton } from '../../../shared/ui/skeleton'
import { Tabs, type TabItem } from '../../../shared/ui/tabs'
import { toneDot, toneSurface, toneText, type Tone } from '../../../shared/ui/tone'
import {
  cognilabsaiService,
  type ConversationItem,
  type WsEvent,
} from '../../../shared/api/services/cognilabsai.service'

type ChannelTab = 'all' | 'instagram' | 'telegram'

type StageConfig = { key: string; label: string; tone: Tone }

const STAGE_PALETTE: Tone[] = [
  'neutral',
  'blue',
  'blue',
  'violet',
  'violet',
  'violet',
  'warning',
  'lime',
  'success',
  'warning',
  'danger',
  'success',
  'blue',
  'danger',
  'lime',
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


function getChannelBadgeStyle(channel: string) {
  if (channel === 'instagram') return { bg: 'bg-[var(--violet-text)]', label: 'IG' }
  if (channel === 'telegram') return { bg: 'bg-[var(--primary)]', label: 'TG' }
  return { bg: 'bg-[var(--success-text)]', label: 'WS' }
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
        className={cn(sizeClass, 'rounded-full object-cover shrink-0')}
      />
    )
  }

  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <div className={cn(
      sizeClass,
      'rounded-full bg-[var(--blue-dim)] text-[var(--blue-text)] font-semibold flex items-center justify-center select-none shrink-0',
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
        'group w-full text-left rounded-[18px] p-3.5 transition-colors duration-150 active:scale-[0.99]',
        highlighted
          ? 'bg-[var(--blue-dim)] ring-2 ring-[var(--primary)]'
          : 'bg-[var(--accent-soft)] hover:bg-[var(--input-surface-hover)]',
      )}
    >
      <div className="flex items-start gap-2.5 mb-2">
        <div className="relative shrink-0 mt-0.5">
          <AvatarInitials name={name} url={conv.client_avatar_url} size="sm" />
          <div className={cn(
            'absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full ring-2 ring-[var(--accent-soft)] text-[8px] font-bold text-white flex items-center justify-center',
            ch.bg,
          )}>
            {ch.label[0]}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-[var(--foreground)] truncate leading-snug tracking-[-0.01em]">{name}</p>
          {conv.ai_interest && (
            <p className="text-[11.5px] text-[var(--muted)] mt-0.5 truncate">{conv.ai_interest}</p>
          )}
        </div>

        <span className="shrink-0 text-[11px] font-medium text-[var(--caption)]">{formatTime(conv.last_message_at)}</span>
      </div>

      {conv.last_message_preview && (
        <p className="text-[12px] text-[var(--muted)] leading-relaxed line-clamp-2 mb-2.5">
          {conv.last_message_preview}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {conv.lead_phone_number && (
          <Badge variant="success" size="sm">
            <Phone strokeWidth={1.8} className="h-2.5 w-2.5" />
            {conv.lead_phone_number}
          </Badge>
        )}
        {conv.crm_customer_id && (
          <Badge variant="blue" size="sm">
            CRM
          </Badge>
        )}
        {conv.unread_count > 0 && (
          <span
            data-ui-number="true"
            className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-1.5 h-5 min-w-5 text-[10.5px] font-bold text-white"
          >
            {conv.unread_count > 99 ? '99+' : conv.unread_count}
          </span>
        )}
        {hasFollowUpSent && (
          <Badge variant="blue" size="sm">
            AI Follow-up ✓
          </Badge>
        )}
        {hasFollowUpScheduled && !hasFollowUpSent && (
          <Badge variant="violet" size="sm">
            ⏱ AI Follow-up
          </Badge>
        )}
        {conv.pause_reason && (
          <Badge variant="warning" size="sm">
            {conv.pause_reason}
          </Badge>
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
    <div className="flex flex-col w-[292px] shrink-0 rounded-[24px] bg-[var(--card)] p-3 overflow-hidden h-full">
      <div className={cn('flex shrink-0 items-center justify-between gap-2 h-10 rounded-[14px] px-3', toneSurface[stage.tone])}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('h-2 w-2 rounded-full shrink-0', toneDot[stage.tone])} />
          <h3 className={cn('text-[12.5px] font-semibold tracking-[-0.01em] truncate', toneText[stage.tone])}>
            {stage.label}
          </h3>
        </div>
        <span
          data-ui-number="true"
          className={cn(
            'shrink-0 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[var(--surface)] px-1.5 text-[11.5px] font-bold',
            toneText[stage.tone],
          )}
        >
          {cards.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto mt-3 space-y-2.5 custom-scrollbar-visible min-h-0">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[18px] bg-[var(--muted-surface)] py-10 text-center">
            <span className="text-2xl text-[var(--border-hover)]">—</span>
            <p className="text-[11.5px] text-[var(--caption)] mt-1">Bo'sh</p>
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

function KanbanBoardSkeleton() {
  return (
    <div className="flex-1 overflow-hidden pb-[18px]">
      <div className="flex gap-[18px] px-7 h-full">
        {[0, 1, 2, 3, 4].map((column) => (
          <div key={column} className="flex flex-col w-[292px] shrink-0 rounded-[24px] bg-[var(--card)] p-3">
            <Skeleton rounded="lg" className="h-10 w-full" />
            <div className="mt-3 space-y-2.5">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} rounded="xl" className="h-[112px] w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const CHANNEL_TABS: TabItem<ChannelTab>[] = [
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

  function handleCardClick(conversationId: number) {
    navigate(`/cognilabsai/chat?conversation_id=${conversationId}&return_to=kanban`)
  }

  return (
    <div className="flex flex-col h-full -mx-7 -mt-[26px] -mb-10" style={{ height: 'var(--page-h-bleed)' }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-7 pt-[26px] pb-[18px] flex-wrap">
        <div className="flex items-center gap-5 flex-wrap">
          <div>
            <h2 className="text-[22px] font-bold text-[var(--foreground)] tracking-[-0.03em]">AI Kanban</h2>
            {lastRefresh && (
              <p className="text-[11.5px] text-[var(--caption)]">
                Yangilandi: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 h-9 rounded-full bg-[var(--card)] px-3.5">
              <span className="h-2 w-2 rounded-full bg-[var(--success-text)]" />
              <span className="text-[12.5px] text-[var(--muted)]">AI faol: <strong className="text-[var(--foreground)]">{totalActive}</strong></span>
            </div>
            <div className="inline-flex items-center gap-2 h-9 rounded-full bg-[var(--card)] px-3.5">
              <span className="h-2 w-2 rounded-full bg-[var(--success-text)]" />
              <span className="text-[12.5px] text-[var(--muted)]">Leadlar: <strong className="text-[var(--success-text)]">{totalLeads}</strong></span>
            </div>
            <div className="inline-flex items-center gap-2 h-9 rounded-full bg-[var(--card)] px-3.5">
              <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
              <span className="text-[12.5px] text-[var(--muted)]">Jami: <strong className="text-[var(--foreground)]">{filtered.length}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Channel filter */}
          <Tabs items={CHANNEL_TABS} value={channelTab} onChange={setChannelTab} className="bg-[var(--card)]" />

          <IconButton
            label="Yangilash"
            onClick={() => void fetchAll()}
            disabled={isLoading}
            className="bg-[var(--card)] hover:bg-[var(--input-surface-hover)]"
          >
            <RefreshCw strokeWidth={1.8} className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </IconButton>
        </div>
      </div>

      {/* Kanban board */}
      {isLoading && conversations.length === 0 ? (
        <KanbanBoardSkeleton />
      ) : (
        <div
          ref={boardRef}
          className="flex-1 overflow-x-auto overflow-y-hidden pb-[18px]"
          onClickCapture={(e) => {
            if (dragRef.current.didDrag) {
              e.stopPropagation()
              dragRef.current.didDrag = false
            }
          }}
        >
          <div className="flex gap-[18px] px-7 h-full" style={{ width: 'max-content' }}>
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
