import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowClockwiseIcon, BellSimpleIcon, ChatsCircleIcon, KanbanIcon, MagnifyingGlassIcon, RobotIcon, UserPlusIcon, XIcon, type Icon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import {
  cognilabsaiService,
  type ConversationItem,
  type WsEvent,
} from '../../../shared/api/services/cognilabsai.service'
import { HeaderActions } from '../../../widgets/navigation/HeaderActions'
import { ChannelGlyph } from '../components/kanban/ChannelGlyph'
import { KanbanColumn } from '../components/kanban/KanbanColumn'
import { KanbanBoardSkeleton, KanbanEmptyState } from '../components/kanban/KanbanStates'
import { CHANNEL_TONES, EXTRA_STAGE_TONES, getClientName, NEW_STAGE_TONE, STAGE_TONES, type StageConfig } from '../components/kanban/kanbanUtils'

type ChannelTab = 'all' | 'instagram' | 'telegram'

/** Known funnel steps (English fallbacks; shown through `aikanban.stage.<key>`), each with its own accent. */
const FALLBACK_STAGES: StageConfig[] = [
  { key: 'service_interest',    label: 'Interested in a service', tone: STAGE_TONES[0] },
  { key: 'business_field',      label: 'Shared business field',   tone: STAGE_TONES[1] },
  { key: 'experience_years',    label: 'Shared experience',       tone: STAGE_TONES[2] },
  { key: 'phone_discussion',    label: 'Phone discussion',        tone: STAGE_TONES[3] },
  { key: 'phone_collected',     label: 'Phone received',          tone: STAGE_TONES[4] },
  { key: 'call_time_collected', label: 'Call time agreed',        tone: STAGE_TONES[5] },
  { key: 'name_collected',      label: 'Name received',           tone: STAGE_TONES[6] },
  { key: 'agreement_confirmed', label: 'Agreement confirmed',     tone: STAGE_TONES[7] },
  { key: 'lead_created',        label: 'Lead created',            tone: STAGE_TONES[8] },
  { key: 'lost',                label: 'Lost',                    tone: STAGE_TONES[10] },
]

const FALLBACK_LABEL_MAP = new Map(FALLBACK_STAGES.map((s) => [s.key, s.label]))
const FALLBACK_TONE_MAP = new Map(FALLBACK_STAGES.map((s) => [s.key, s.tone]))

function buildStageConfigs(apiStages: Array<{ value: string; label: string; order?: number | null }>): StageConfig[] {
  return apiStages.map((s, i) => ({
    key: s.value,
    label: FALLBACK_LABEL_MAP.get(s.value) ?? s.label,
    tone: FALLBACK_TONE_MAP.get(s.value) ?? STAGE_TONES[i % STAGE_TONES.length],
  }))
}

const CHANNEL_TABS: ChannelTab[] = ['all', 'instagram', 'telegram']

/** Top-bar pill (HeaderActions). */
const PILL = 'inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--pill-shadow)]'

export function CognilabsAIKanbanPage() {
  const { t } = useLocale()
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

    // Known steps read in the user's language; other API stages keep the API label.
    const localized = stages.map((s) => (FALLBACK_LABEL_MAP.has(s.key) ? { ...s, label: t(`aikanban.stage.${s.key}`, s.label) } : s))

    // 1. API stages that have conversations
    for (const s of localized) {
      if (byStage.has(s.key)) {
        result.push(s)
        usedKeys.add(s.key)
      }
    }

    // 2. Conversation stages not in API list
    let extraIdx = 0
    for (const key of byStage.keys()) {
      if (!usedKeys.has(key)) {
        const isNew = key === 'new'
        const tone = isNew ? NEW_STAGE_TONE : EXTRA_STAGE_TONES[extraIdx % EXTRA_STAGE_TONES.length]
        const label = isNew ? t('aikanban.stage.new', 'New') : key.replaceAll('_', ' ')
        result.push({ key, label, tone })
        usedKeys.add(key)
        extraIdx++
      }
    }

    // 3. API stages with no conversations (show empty columns last)
    for (const s of localized) {
      if (!usedKeys.has(s.key)) {
        result.push(s)
        usedKeys.add(s.key)
      }
    }

    return result
  }, [stages, byStage, t])

  const totalActive = filtered.filter((c) => c.ai_enabled).length
  const totalLeads = filtered.filter((c) => c.ai_stage === 'lead_created').length
  const totalUnread = filtered.reduce((sum, c) => sum + (c.unread_count > 0 ? 1 : 0), 0)
  const conversion = filtered.length > 0 ? Math.round((totalLeads / filtered.length) * 100) : 0

  function handleCardClick(conversationId: number) {
    navigate(`/cognilabsai/chat?conversation_id=${conversationId}&return_to=kanban`)
  }

  const isFolded = (stage: StageConfig) => folded[stage.key] ?? (byStage.get(stage.key)?.length ?? 0) === 0
  const stats: Array<{ key: string; label: string; value: number; hint?: string; icon: Icon }> = [
    { key: 'all', label: t('aikanban.stat.conversations', 'Conversations'), value: filtered.length, icon: ChatsCircleIcon },
    { key: 'ai', label: t('aichat.ai_active', 'AI is answering'), value: totalActive, icon: RobotIcon },
    { key: 'lead', label: t('aikanban.stat.leads', 'Leads'), value: totalLeads, hint: `${conversion}%`, icon: UserPlusIcon },
    { key: 'unread', label: t('aikanban.stat.unread', 'Unread'), value: totalUnread, icon: BellSimpleIcon },
  ]
  const channelTabLabel = (tab: ChannelTab) => (tab === 'all' ? t('aikanban.channel.all', 'All') : tab === 'instagram' ? 'Instagram' : 'Telegram')
  const updatedAt = lastRefresh ? lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

  let emptyState = null
  if (filtered.length === 0) {
    emptyState = query.trim() ? (
      <KanbanEmptyState
        icon={<MagnifyingGlassIcon size={24} />}
        title={t('aichat.nothing_found', 'Nothing found')}
        text={t('aikanban.empty.search', 'No conversation matches “{{query}}”. Try a name, phone number or a word from the message.', { query: query.trim() })}
        action={(
          <button type="button" onClick={() => setQuery('')} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)]">
            <XIcon size={14} weight="bold" />
            {t('aikanban.clear_search', 'Clear search')}
          </button>
        )}
      />
    ) : channelTab !== 'all' && conversations.length > 0 ? (
      <KanbanEmptyState
        icon={<ChannelGlyph kind={channelTab} size={24} />}
        title={t('aikanban.empty.channel_title', 'No {{channel}} conversations', { channel: channelTabLabel(channelTab) })}
        text={t('aikanban.empty.channel_text', 'Chats from this channel will appear here as the AI talks to customers.')}
        action={(
          <button type="button" onClick={() => setChannelTab('all')} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)]">
            <ChatsCircleIcon size={15} />
            {t('aikanban.show_all_channels', 'Show all channels')}
          </button>
        )}
      />
    ) : (
      <KanbanEmptyState
        icon={<KanbanIcon size={24} />}
        title={t('aikanban.empty.title', 'No conversations yet')}
        text={t('aikanban.empty.text', 'New Instagram and Telegram chats land here and move across the stages as the AI talks to customers.')}
      />
    )
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" style={{ height: 'var(--page-h)', minHeight: 480 }}>
      <h1 className="sr-only">{t('nav./cognilabsai/kanban.label', 'AI Kanban')}</h1>

      {/* Toolbar: search, channel, key numbers */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <label className="relative flex h-11 min-w-0 flex-1 items-center md:h-10 md:w-[260px] md:flex-none">
          <MagnifyingGlassIcon size={16} className="pointer-events-none absolute left-3 text-[var(--caption)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('aikanban.search_placeholder', 'Name, phone or message')}
            aria-label={t('common.search', 'Search')}
            className="h-full w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] pr-9 pl-9 text-[13px] text-[var(--foreground)] transition-colors placeholder:text-[var(--caption)] hover:border-[var(--border-hover)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--selection)] focus:outline-none"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label={t('common.clear', 'Clear')} title={t('common.clear', 'Clear')} className="absolute right-1.5 grid h-7 w-7 place-items-center rounded-[8px] text-[var(--muted)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
              <XIcon size={14} />
            </button>
          ) : null}
        </label>

        <HeaderActions className="shrink-0">
          <span className={cn(PILL, 'hidden gap-2 px-4 text-[12.5px] font-medium text-[var(--muted-strong)] xl:inline-flex')} title={updatedAt ? t('aikanban.updated_at', 'Updated at {{time}}', { time: updatedAt }) : undefined}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-50 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
            </span>
            {t('aikanban.live', 'Live')}
            {updatedAt ? <span className="text-[var(--caption)] tabular-nums">{updatedAt}</span> : null}
          </span>
          <button
            type="button"
            onClick={() => void fetchAll()}
            disabled={isLoading}
            aria-label={t('common.refresh', 'Refresh')}
            title={updatedAt ? `${t('common.refresh', 'Refresh')} · ${t('aikanban.updated_at', 'Updated at {{time}}', { time: updatedAt })}` : t('common.refresh', 'Refresh')}
            className={cn(PILL, 'w-11 justify-center text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)] disabled:opacity-60')}
          >
            <ArrowClockwiseIcon size={17} className={cn(isLoading && 'animate-spin')} />
          </button>
        </HeaderActions>

        <div role="radiogroup" aria-label={t('aichat.channel', 'Channel')} className="flex h-10 w-full items-center gap-0.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-[3px] md:inline-flex md:w-auto">
          {CHANNEL_TABS.map((tab) => {
            const active = channelTab === tab
            return (
              <button
                key={tab}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setChannelTab(tab)}
                className={cn(
                  'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3 text-[12.5px] whitespace-nowrap transition-colors md:flex-none',
                  active ? 'bg-[var(--blue-dim)] font-semibold text-[var(--blue-text)]' : 'font-medium text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
                )}
              >
                {tab === 'all'
                  ? <ChatsCircleIcon size={15} weight={active ? 'fill' : 'regular'} />
                  : <span className="inline-flex" style={active ? { color: CHANNEL_TONES[tab] } : undefined}><ChannelGlyph kind={tab} size={15} weight={active ? 'fill' : 'regular'} /></span>}
                {channelTabLabel(tab)}
              </button>
            )
          })}
        </div>

        <dl className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 py-0.5 lg:ml-auto lg:w-auto lg:py-0">
          {stats.map(({ key, label, value, hint, icon: StatIcon }) => (
            <div key={key} className="flex shrink-0 items-center gap-1.5 text-[12.5px] whitespace-nowrap">
              <StatIcon size={15} className="text-[var(--caption)]" aria-hidden="true" />
              <dt className="text-[var(--muted)]">{label}</dt>
              <dd className="font-semibold text-[var(--foreground)] tabular-nums">{value}</dd>
              {hint ? <dd className="rounded-full bg-[var(--success-dim)] px-1.5 text-[11px] leading-[18px] font-semibold text-[var(--success-text)] tabular-nums">{hint}</dd> : null}
            </div>
          ))}
        </dl>
      </div>

      {/* Funnel at a glance: share of conversations per stage */}
      {filtered.length > 0 ? (
        <div className="flex h-1.5 shrink-0 gap-[3px] overflow-hidden rounded-full" role="img" aria-label={t('aikanban.funnel', 'Conversations by stage')} title={t('aikanban.funnel', 'Conversations by stage')}>
          {orderedStages.map((stage) => {
            const count = byStage.get(stage.key)?.length ?? 0
            return count ? <span key={stage.key} title={`${stage.label}: ${count}`} className="h-full min-w-[3px] rounded-full transition-[flex-grow] duration-500" style={{ flexGrow: count, flexBasis: 0, background: stage.tone }} /> : null
          })}
        </div>
      ) : null}

      {/* Board */}
      <div className="relative min-h-0 flex-1">
        {isLoading && conversations.length === 0 ? (
          <KanbanBoardSkeleton />
        ) : (
          <div
            ref={boardRef}
            className="h-full overflow-x-auto overflow-y-hidden pb-1.5"
            onClickCapture={(e) => {
              if (dragRef.current.didDrag) {
                e.stopPropagation()
                dragRef.current.didDrag = false
              }
            }}
          >
            {emptyState ?? (
              <div className="flex h-full gap-3" style={{ width: 'max-content' }}>
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
            )}
          </div>
        )}
      </div>
    </section>
  )
}
