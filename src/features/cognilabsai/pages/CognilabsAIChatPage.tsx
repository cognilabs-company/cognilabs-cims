import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, Bot, BotOff, Contact, KanbanSquare, Loader2, PanelRight } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useToast } from '../../../shared/toast/useToast'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAuth } from '../../auth/hooks/useAuth'
import { crmService } from '../../../shared/api/services/crm.service'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import {
  cognilabsaiService,
  type ConversationItem,
  type MessageItem,
  type WsEvent,
} from '../../../shared/api/services/cognilabsai.service'
import {
  createFollowUpDraft,
  dayKey,
  formatDayPill,
  formatMessageTime,
  getChannelLabel,
  getClientName,
  getConversationIdFromChatUrl,
  getConversationTab,
  isOnline,
  presenceOf,
  sortConversationsByActivity,
  upsertConversation,
  type ChannelTab,
  type FollowUpDraft,
} from '../components/chat/chatUtils'
import { DateDivider, MessageRow, ServicePill, TgAvatar, UnreadDivider } from '../components/chat/TgParts'
import { TgSidebar } from '../components/chat/TgSidebar'
import { TgComposer } from '../components/chat/TgComposer'
import { TgInfoPanel } from '../components/chat/TgInfoPanel'
import { TelegramSearchDialog } from '../components/chat/TelegramSearchDialog'

const PAGE_SIZE = 50
const INFO_KEY = 'cims-aichat-info'

function subscribeNarrow(callback: () => void) {
  const query = window.matchMedia('(max-width: 767px)')
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
const isNarrow = () => window.matchMedia('(max-width: 767px)').matches

function HeaderIcon({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn('grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--tg-hover)]', active ? 'text-[var(--tg-primary)]' : 'text-[var(--tg-secondary)]')}
    >
      {children}
    </button>
  )
}

/** Cognilabs AI chats — a Telegram-style messenger (chat list · conversation · profile panel). */
export function CognilabsAIChatPage() {
  const { t, locale } = useLocale()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { user, can } = useAuth()
  const canCreate = can('ai_chat', 'create')
  const canEdit = can('ai_chat', 'edit')
  const canDelete = can('ai_chat', 'delete')
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false)

  const [activeTab, setActiveTab] = useState<ChannelTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(() => {
    const id = searchParams.get('conversation_id')
    return id ? Number(id) : null
  })
  const returnCustomerId = useMemo(() => {
    const parsed = Number(searchParams.get('return_customer_id'))
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [searchParams])
  const returnToKanban = searchParams.get('return_to') === 'kanban'

  const [messages, setMessages] = useState<MessageItem[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isTogglingAi, setIsTogglingAi] = useState(false)
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false)
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [conversationsTotal, setConversationsTotal] = useState(0)
  const [conversationsPage, setConversationsPage] = useState(0)
  const [selectedConversationDetail, setSelectedConversationDetail] = useState<ConversationItem | null>(null)
  const [showNewTelegramModal, setShowNewTelegramModal] = useState(false)
  const [newTelegramInitialQuery, setNewTelegramInitialQuery] = useState('')
  const [wsKey, setWsKey] = useState<string | null>(null)
  const [showPauseUntil, setShowPauseUntil] = useState(false)
  const [pauseUntilDate, setPauseUntilDate] = useState('')
  const [followUpDraft, setFollowUpDraft] = useState<FollowUpDraft>(() => createFollowUpDraft(null))
  const [infoOpen, setInfoOpen] = useState(() => { try { return localStorage.getItem(INFO_KEY) === '1' } catch { return false } })
  const [atBottom, setAtBottom] = useState(true)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const conversationsQuery = useAsyncData(
    () => cognilabsaiService.listConversations(undefined, PAGE_SIZE, conversationsPage * PAGE_SIZE),
    [conversationsPage],
    {
      onSuccess: (data) => {
        setConversations(sortConversationsByActivity(data.items))
        setConversationsTotal(data.total)
      },
    },
  )
  const crmDashboardQuery = useAsyncData(() => crmService.dashboardWithAllCustomers(), [])

  // ?telegram_search=… opens the new-chat dialog (coming from CRM)
  useEffect(() => {
    const telegramSearchQuery = (searchParams.get('telegram_search') ?? '').trim()
    if (!telegramSearchQuery) return
    setNewTelegramInitialQuery(telegramSearchQuery)
    setShowNewTelegramModal(true)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('telegram_search')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  const refetchConversationsRef = useRef(conversationsQuery.refetch)
  useEffect(() => { refetchConversationsRef.current = conversationsQuery.refetch }, [conversationsQuery.refetch])
  const conversationsRef = useRef<ConversationItem[]>([])
  useEffect(() => { conversationsRef.current = conversations }, [conversations])

  useAsyncData(() => cognilabsaiService.getIntegrations(), [], {
    onSuccess: (data) => { if (data.websocket_api_key) setWsKey(data.websocket_api_key) },
  })

  const selectedConversation = useMemo(
    () => selectedConversationDetail ?? conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationDetail, selectedConversationId],
  )
  const crmCustomerIdByConversationId = useMemo(() => {
    const map = new Map<number, number>()
    for (const customer of crmDashboardQuery.data?.customers ?? []) {
      const conversationId = getConversationIdFromChatUrl(customer.chat_url)
      if (conversationId) map.set(conversationId, customer.id)
    }
    return map
  }, [crmDashboardQuery.data?.customers])

  const filteredConversations = useMemo(() => {
    let list = conversations
    if (activeTab !== 'all') list = list.filter((c) => getConversationTab(c.channel) === activeTab)
    const q = searchQuery.trim().toLowerCase()
    if (q) list = list.filter((c) => getClientName(c).toLowerCase().includes(q) || c.client_username?.toLowerCase().includes(q) || c.last_message_preview?.toLowerCase().includes(q))
    return list
  }, [conversations, activeTab, searchQuery])

  // messages of the open chat
  useEffect(() => {
    if (!selectedConversationId) return
    setIsLoadingMessages(true)
    cognilabsaiService.listMessages(selectedConversationId)
      .then((nextMessages) => {
        setMessages(nextMessages)
        setConversations((prev) => prev.map((conversation) => (conversation.id === selectedConversationId ? { ...conversation, unread_count: 0 } : conversation)))
      })
      .catch(() => setMessages([]))
      .finally(() => setIsLoadingMessages(false))
  }, [selectedConversationId])

  // full conversation detail (follow-up settings etc.)
  useEffect(() => {
    if (!selectedConversationId) return
    let cancelled = false
    cognilabsaiService.getConversation(selectedConversationId)
      .then((detail) => {
        if (cancelled) return
        setSelectedConversationDetail(detail)
        setFollowUpDraft(createFollowUpDraft(detail))
      })
      .catch(() => {
        if (!cancelled) setFollowUpDraft(createFollowUpDraft(conversationsRef.current.find((c) => c.id === selectedConversationId) ?? null))
      })
    return () => { cancelled = true }
  }, [selectedConversationId])

  useEffect(() => {
    if (!selectedConversationId) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('conversation_id', String(selectedConversationId))
      return next
    }, { replace: true })
  }, [selectedConversationId, setSearchParams])

  // stick to the newest message
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [messages])

  const selectedConversationIdRef = useRef(selectedConversationId)
  useEffect(() => { selectedConversationIdRef.current = selectedConversationId }, [selectedConversationId])

  // live updates
  useEffect(() => {
    if (!wsKey) return
    let socket: WebSocket | null = null
    let mounted = true
    let reconnect: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (!mounted) return
      const sock = cognilabsaiService.createWebSocket(wsKey!)
      socket = sock
      sock.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as WsEvent
          if (data.type === 'message.created') {
            if (data.conversation_id === selectedConversationIdRef.current) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.message.id)) return prev
                const optimisticIdx = prev.findIndex((m) => m.id > 1_000_000_000_000 && m.text === data.message.text && m.sender_type === data.message.sender_type)
                if (optimisticIdx !== -1) {
                  const next = [...prev]
                  next[optimisticIdx] = data.message
                  return next
                }
                return [...prev, data.message]
              })
            }
            const convId = data.conversation_id
            if (conversationsRef.current.some((c) => c.id === convId)) {
              setConversations((prev) => sortConversationsByActivity(prev.map((c) => (c.id === convId
                ? {
                    ...c,
                    last_message_at: data.message.created_at,
                    last_message_preview: data.message.text,
                    unread_count: data.message.sender_type === 'client' && convId !== selectedConversationIdRef.current ? (c.unread_count ?? 0) + 1 : c.unread_count,
                  }
                : c))))
            } else {
              void cognilabsaiService.getConversation(convId)
                .then((conversation) => { if (mounted) setConversations((prev) => upsertConversation(prev, conversation)) })
                .catch(() => { if (mounted) void refetchConversationsRef.current() })
            }
          } else if (data.type === 'conversation.updated') {
            setConversations((prev) => upsertConversation(prev, data.conversation))
            if (data.conversation_id === selectedConversationIdRef.current) {
              setSelectedConversationDetail(data.conversation)
              setFollowUpDraft(createFollowUpDraft(data.conversation))
            }
          }
        } catch {
          // ignore malformed events
        }
      }
      sock.onerror = () => {}
      sock.onclose = () => { if (mounted) reconnect = setTimeout(connect, 5000) }
    }

    connect()
    return () => {
      mounted = false
      if (reconnect) clearTimeout(reconnect)
      socket?.close()
    }
  }, [wsKey])

  const handleSelectConversation = useCallback((id: number) => {
    const next = conversations.find((c) => c.id === id) ?? null
    setSelectedConversationId(id)
    setMessageText('')
    setShowPauseUntil(false)
    setPauseUntilDate('')
    setSelectedConversationDetail(next)
    setFollowUpDraft(createFollowUpDraft(next))
  }, [conversations])

  const toastError = (error: unknown) => showToast({ title: t('common.error', 'Error'), description: getApiErrorMessage(error), tone: 'error' })

  async function handleDeleteConversation(conv: ConversationItem) {
    const approved = await confirm({
      title: t('aichat.delete_title', 'Delete this chat?'),
      description: t('aichat.delete_description', 'The chat with {{name}} will be deleted for good.', { name: getClientName(conv) }),
      tone: 'danger',
      confirmLabel: t('aichat.delete_chat', 'Delete chat'),
    })
    if (!approved) return
    try {
      await cognilabsaiService.deleteConversation(conv.id)
      setConversations((prev) => prev.filter((c) => c.id !== conv.id))
      if (selectedConversationId === conv.id) {
        setSelectedConversationId(null)
        setMessages([])
        setSelectedConversationDetail(null)
      }
      showToast({ title: t('aichat.deleted', 'Chat deleted'), tone: 'success' })
    } catch (error) {
      toastError(error)
    }
  }

  const resolveCrmCustomerId = (conv: ConversationItem) => crmCustomerIdByConversationId.get(conv.id) ?? null
  const handleOpenCrm = (customerId: number) => navigate(`/crm?customer_id=${customerId}`)

  async function handleSend() {
    if (!selectedConversationId || !messageText.trim() || isSending) return
    const text = messageText.trim()
    setMessageText('')
    setIsSending(true)
    const optimistic: MessageItem = {
      id: Date.now(),
      conversation_id: selectedConversationId,
      channel: selectedConversation?.channel ?? '',
      sender_type: 'operator',
      operator_user_id: user?.id ?? null,
      operator_name_snapshot: user ? `${user.name} ${user.surname}` : 'Operator',
      client_external_id: null,
      instagram_message_id: null,
      telegram_message_id: null,
      text,
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    try {
      await cognilabsaiService.sendMessage(selectedConversationId, text)
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setMessageText(text)
      toastError(error)
    } finally {
      setIsSending(false)
    }
  }

  async function handleToggleAi(action: 'pause' | 'resume') {
    if (!selectedConversationId || isTogglingAi) return
    setIsTogglingAi(true)
    try {
      const updated = action === 'pause' ? await cognilabsaiService.pause(selectedConversationId) : await cognilabsaiService.resume(selectedConversationId)
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSelectedConversationDetail(updated)
      showToast({ title: action === 'pause' ? t('aichat.ai_paused_toast', 'AI paused') : t('aichat.ai_resumed_toast', 'AI is answering again'), tone: 'success' })
    } catch (error) {
      toastError(error)
    } finally {
      setIsTogglingAi(false)
    }
  }

  async function handleRetryAi() {
    if (!selectedConversationId || isTogglingAi) return
    setIsTogglingAi(true)
    try {
      await cognilabsaiService.retryAi(selectedConversationId)
      showToast({ title: t('aichat.ai_retried', 'AI is replying again'), tone: 'success' })
    } catch (error) {
      toastError(error)
    } finally {
      setIsTogglingAi(false)
    }
  }

  async function handlePauseUntil() {
    if (!selectedConversationId || !pauseUntilDate || isTogglingAi) return
    setIsTogglingAi(true)
    try {
      const updated = await cognilabsaiService.pauseUntil(selectedConversationId, new Date(pauseUntilDate).toISOString())
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSelectedConversationDetail(updated)
      setShowPauseUntil(false)
      setPauseUntilDate('')
      showToast({ title: t('aichat.ai_paused_until', 'AI paused for a while'), tone: 'success' })
    } catch (error) {
      toastError(error)
    } finally {
      setIsTogglingAi(false)
    }
  }

  async function handleSaveFollowUp() {
    if (!selectedConversationId || isSavingFollowUp) return
    if (followUpDraft.enabled && followUpDraft.mode === 'custom') {
      const delay = Number(followUpDraft.delay_minutes)
      if (!Number.isFinite(delay) || delay <= 0) {
        showToast({ title: t('common.error', 'Error'), description: t('aichat.follow_up_delay_error', 'Delay must be more than 0 minutes.'), tone: 'error' })
        return
      }
      if (!followUpDraft.message.trim()) {
        showToast({ title: t('common.error', 'Error'), description: t('aichat.follow_up_message_error', 'Write the reminder text.'), tone: 'error' })
        return
      }
    }
    setIsSavingFollowUp(true)
    try {
      const updated = await cognilabsaiService.updateConversationFollowUp(
        selectedConversationId,
        followUpDraft.enabled
          ? followUpDraft.mode === 'custom'
            ? { enabled: true, mode: 'custom', delay_minutes: Number(followUpDraft.delay_minutes), message: followUpDraft.message.trim() }
            : { enabled: true, mode: 'global' }
          : { enabled: false },
      )
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSelectedConversationDetail(updated)
      setFollowUpDraft(createFollowUpDraft(updated))
      showToast({ title: t('aichat.follow_up_saved', 'Follow-up saved'), tone: 'success' })
    } catch (error) {
      toastError(error)
    } finally {
      setIsSavingFollowUp(false)
    }
  }

  function handleReturnToCrm() {
    const returnTo = searchParams.get('return_to')
    const allowed = ['/crm', '/crm/customers', '/outbound-crm', '/outbound-crm/customers']
    navigate(returnTo && allowed.includes(returnTo) ? returnTo : '/crm/customers')
  }

  function toggleInfo() {
    setInfoOpen((open) => {
      try { localStorage.setItem(INFO_KEY, open ? '0' : '1') } catch { /* private mode */ }
      return !open
    })
  }

  /* ── derived view data ─────────────────────────────── */
  const showChat = selectedConversationId !== null
  const supportsAi = selectedConversation?.supports_ai ?? false
  const aiPaused = selectedConversation?.chat_mode !== 'instagram_ai' || Boolean(selectedConversation?.pause_reason)
  const crmCustomerId = selectedConversation ? (selectedConversation.crm_customer_id ?? resolveCrmCustomerId(selectedConversation)) : null

  const presenceText = useCallback((presence: ReturnType<typeof presenceOf>) => {
    switch (presence.kind) {
      case 'online': return t('aichat.presence.online', 'online')
      case 'recently': return t('aichat.presence.recently', 'last seen recently')
      case 'week': return t('aichat.presence.week', 'last seen within a week')
      case 'month': return t('aichat.presence.month', 'last seen within a month')
      case 'seen': {
        const at = presence.at!
        const day = formatDayPill(at, locale, { today: t('aichat.today', 'today'), yesterday: t('aichat.yesterday', 'yesterday') })
        return t('aichat.presence.seen', 'last seen {{when}}', { when: `${day.charAt(0).toLowerCase()}${day.slice(1)} ${formatMessageTime(at)}` })
      }
      case 'offline': return t('aichat.presence.offline', 'last seen a long time ago')
      default: return ''
    }
  }, [locale, t])

  const headerStatus = useMemo(() => {
    if (!selectedConversation) return ''
    const presence = selectedConversation.channel === 'telegram'
      ? presenceText(presenceOf(selectedConversation.telegram_presence_status, selectedConversation.telegram_is_online, selectedConversation.telegram_last_seen_at))
      : ''
    const ai = supportsAi ? (aiPaused ? t('aichat.ai_paused', 'AI paused') : t('aichat.ai_active', 'AI is answering')) : ''
    return presence || [getChannelLabel(selectedConversation.channel), ai].filter(Boolean).join(' · ')
  }, [aiPaused, presenceText, selectedConversation, supportsAi, t])
  const headerOnline = Boolean(selectedConversation && selectedConversation.channel === 'telegram' && isOnline(selectedConversation))

  const followUpStatus = selectedConversation?.follow_up_enabled
    ? `${selectedConversation.follow_up_mode === 'custom' ? t('aichat.follow_up_custom', 'Custom for this chat') : t('aichat.follow_up_global', 'Global settings')}${selectedConversation.follow_up_sent_at ? ` · ${t('aichat.follow_up_sent', 'sent')}` : selectedConversation.follow_up_due_at ? ` · ${t('aichat.follow_up_pending', 'scheduled')}` : ''}`
    : t('aichat.follow_up_off', 'Off')

  const firstUnreadId = messages.find((m) => m.sender_type === 'client' && m.is_read === false)?.id ?? null
  const messageLabels = { ai: 'AI', operator: t('aichat.operator_label', 'Operator'), autoFollowUp: t('aichat.auto_follow_up', 'Auto follow-up') }
  const dayLabels = { today: t('aichat.today_pill', 'Today'), yesterday: t('aichat.yesterday_pill', 'Yesterday') }

  const rows: ReactNode[] = []
  messages.forEach((msg, index) => {
    const prev = messages[index - 1]
    const next = messages[index + 1]
    const sameDayAsPrev = prev ? dayKey(prev.created_at) === dayKey(msg.created_at) : false
    if (!sameDayAsPrev) rows.push(<DateDivider key={`day-${msg.id}`} label={formatDayPill(msg.created_at, locale, dayLabels)} />)
    if (msg.id === firstUnreadId) rows.push(<UnreadDivider key="unread" label={t('aichat.unread_messages', 'Unread messages')} />)
    const first = !prev || !sameDayAsPrev || prev.sender_type !== msg.sender_type || prev.sender_type === 'system' || msg.id === firstUnreadId
    const last = !next || dayKey(next.created_at) !== dayKey(msg.created_at) || next.sender_type !== msg.sender_type || next.sender_type === 'system' || next.id === firstUnreadId
    rows.push(<MessageRow key={msg.id} msg={msg} first={first} last={last} labels={messageLabels} />)
  })

  const pageCount = Math.max(1, Math.ceil(conversationsTotal / PAGE_SIZE))

  return (
    <div className="tg relative flex overflow-hidden rounded-[20px] border border-[var(--tg-border)] bg-[var(--tg-bg)] shadow-[var(--elev-sm)]" style={{ height: 'var(--page-h)', minHeight: 480 }}>
      <TgSidebar
        className={cn('w-full shrink-0 border-r border-[var(--tg-border)] md:w-[340px] lg:w-[380px] xl:w-[400px]', showChat && narrow && 'hidden')}
        conversations={filteredConversations}
        allConversations={conversations}
        loading={conversationsQuery.isLoading}
        selectedId={selectedConversationId}
        tab={activeTab}
        onTabChange={setActiveTab}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        onSelect={handleSelectConversation}
        onNewChat={canCreate ? () => { setNewTelegramInitialQuery(''); setShowNewTelegramModal(true) } : undefined}
        crmCustomerIdFor={resolveCrmCustomerId}
        onOpenCrm={handleOpenCrm}
        onDelete={canDelete ? (conv) => void handleDeleteConversation(conv) : undefined}
        page={conversationsPage}
        pageCount={pageCount}
        onPageChange={setConversationsPage}
      />

      <main className={cn('tg-wallpaper relative flex min-w-0 flex-1 flex-col', !showChat && narrow && 'hidden')}>
        {!selectedConversation ? (
          <div className="grid flex-1 place-items-center p-6">
            <ServicePill className="px-3 py-1">{t('aichat.select_chat', 'Select a chat to start messaging')}</ServicePill>
          </div>
        ) : (
          <>
            {/* header */}
            <header className="tg-header relative z-10 flex h-[56px] shrink-0 items-center gap-1 pr-2 pl-2 md:pl-4">
              {narrow ? (
                <HeaderIcon label={t('aichat.back', 'Back')} onClick={() => setSelectedConversationId(null)}><ArrowLeft size={22} /></HeaderIcon>
              ) : null}
              {returnCustomerId ? (
                <button type="button" onClick={handleReturnToCrm} className="mr-1 inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-[var(--tg-hover)] px-3 text-[13px] font-semibold text-[var(--tg-primary)] hover:brightness-95">
                  <ArrowLeft size={15} /> CRM
                </button>
              ) : null}
              <button type="button" onClick={toggleInfo} className="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] py-1 text-left">
                <TgAvatar url={selectedConversation.client_avatar_url} name={getClientName(selectedConversation)} size={42} />
                <span className="min-w-0">
                  <span className="block truncate text-[16px] leading-[21px] font-semibold text-[var(--tg-text)]">{getClientName(selectedConversation)}</span>
                  <span data-i18n-skip="true" className={cn('block truncate text-[14px] leading-[18px]', headerOnline ? 'text-[var(--tg-primary)]' : 'text-[var(--tg-secondary)]')}>{headerStatus}</span>
                </span>
              </button>
              {returnToKanban ? (
                <HeaderIcon label={t('aichat.back_to_kanban', 'Back to kanban')} onClick={() => navigate(`/cognilabsai/kanban?highlight=${selectedConversation.id}`)}><KanbanSquare size={21} /></HeaderIcon>
              ) : null}
              {crmCustomerId ? (
                <HeaderIcon label={t('aichat.open_crm', 'Open in CRM')} onClick={() => handleOpenCrm(crmCustomerId)}><Contact size={21} /></HeaderIcon>
              ) : null}
              {supportsAi && canEdit ? (
                <HeaderIcon label={aiPaused ? t('aichat.ai_resume', 'Turn AI on') : t('aichat.ai_pause', 'Pause AI')} onClick={() => void handleToggleAi(aiPaused ? 'resume' : 'pause')} active={!aiPaused}>
                  {isTogglingAi ? <Loader2 size={20} className="animate-spin" /> : aiPaused ? <BotOff size={21} /> : <Bot size={21} />}
                </HeaderIcon>
              ) : null}
              <HeaderIcon label={t('aichat.info', 'Info')} onClick={toggleInfo} active={infoOpen}><PanelRight size={21} /></HeaderIcon>
            </header>

            {/* messages */}
            <div
              ref={messagesContainerRef}
              onScroll={(event) => {
                const el = event.currentTarget
                setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120)
              }}
              className="tg-scroll relative min-h-0 flex-1 overflow-y-auto"
            >
              <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col justify-end px-3 pt-2 pb-2 md:px-5">
                {messages.length === 0 && !isLoadingMessages ? (
                  <div className="flex flex-1 items-center justify-center py-10">
                    <ServicePill>{t('aichat.no_messages_yet', 'No messages here yet')}</ServicePill>
                  </div>
                ) : rows}
              </div>
              {isLoadingMessages ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="tg-service grid h-12 w-12 place-items-center rounded-full"><Loader2 size={24} className="animate-spin text-white" /></span>
                </div>
              ) : null}
            </div>

            {!atBottom ? (
              <button
                type="button"
                onClick={() => { const el = messagesContainerRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) }}
                aria-label={t('aichat.scroll_down', 'Scroll to the latest message')}
                className={cn('tg-send absolute right-5 z-10 grid h-[48px] w-[48px] place-items-center rounded-full text-[var(--tg-secondary)] transition-transform hover:scale-105', canCreate ? 'bottom-[92px]' : 'bottom-5')}
              >
                <ArrowDown size={22} />
              </button>
            ) : null}

            {/* composer (sending a message needs `create`) */}
            {canCreate ? (
              <div className="relative z-10 mx-auto w-full max-w-[760px] shrink-0 px-3 pt-1 pb-4 md:px-5">
                <TgComposer value={messageText} onChange={setMessageText} onSend={() => void handleSend()} sending={isSending} />
              </div>
            ) : null}
          </>
        )}
      </main>

      {selectedConversation && infoOpen ? (
        <TgInfoPanel
          className="absolute inset-y-0 right-0 z-20 w-full shadow-[-8px_0_24px_rgba(0,0,0,0.12)] sm:w-[360px] xl:static xl:z-auto xl:shrink-0 xl:border-l xl:border-[var(--tg-border)] xl:shadow-none"
          conversation={selectedConversation}
          presence={headerStatus}
          online={headerOnline}
          onClose={toggleInfo}
          supportsAi={supportsAi}
          aiPaused={aiPaused}
          aiBusy={isTogglingAi}
          onToggleAi={() => void handleToggleAi(aiPaused ? 'resume' : 'pause')}
          onRetryAi={() => void handleRetryAi()}
          pauseUntilOpen={showPauseUntil}
          onPauseUntilOpen={setShowPauseUntil}
          pauseUntil={pauseUntilDate}
          onPauseUntilChange={setPauseUntilDate}
          onPauseUntilConfirm={() => void handlePauseUntil()}
          followUp={followUpDraft}
          onFollowUpChange={setFollowUpDraft}
          followUpSaving={isSavingFollowUp}
          followUpStatus={followUpStatus}
          onFollowUpSave={() => void handleSaveFollowUp()}
          crmCustomerId={crmCustomerId}
          onOpenCrm={() => crmCustomerId && handleOpenCrm(crmCustomerId)}
          canEdit={canEdit}
          onDelete={canDelete ? () => void handleDeleteConversation(selectedConversation) : undefined}
        />
      ) : null}

      {showNewTelegramModal && canCreate ? (
        <TelegramSearchDialog
          initialQuery={newTelegramInitialQuery}
          presenceText={presenceText}
          onBackToCrm={returnCustomerId ? () => { setShowNewTelegramModal(false); setNewTelegramInitialQuery(''); handleReturnToCrm() } : undefined}
          onClose={() => { setShowNewTelegramModal(false); setNewTelegramInitialQuery('') }}
          onStartChat={(id) => { handleSelectConversation(id); setShowNewTelegramModal(false); setNewTelegramInitialQuery('') }}
          onNewChatStarted={() => void conversationsQuery.refetch()}
        />
      ) : null}
    </div>
  )
}
