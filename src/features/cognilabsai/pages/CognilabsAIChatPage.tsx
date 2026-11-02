import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  IdCard,
  LayoutGrid,
  MessageCircle,
  MessageSquare,
  Pause,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from 'lucide-react'
import { cn } from '../../../shared/lib/cn'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useToast } from '../../../shared/toast/useToast'
import { useAuth } from '../../auth/hooks/useAuth'
import { crmService } from '../../../shared/api/services/crm.service'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { IconButton } from '../../../shared/ui/icon-button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Skeleton } from '../../../shared/ui/skeleton'
import { Tabs, type TabItem } from '../../../shared/ui/tabs'
import { Textarea } from '../../../shared/ui/textarea'
import { toneDot, toneText, type Tone } from '../../../shared/ui/tone'
import { SelectField } from '../../../shared/ui/select-field'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import { Switch } from '../../../shared/ui/switch'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import Lottie from 'lottie-react'
import {
  cognilabsaiService,
  type ConversationItem,
  type MessageItem,
  type TelegramSearchResult,
  type WsEvent,
} from '../../../shared/api/services/cognilabsai.service'

type ChannelTab = 'all' | 'instagram' | 'telegram' | 'website'

type FollowUpMode = 'global' | 'custom'

type FollowUpDraft = {
  enabled: boolean
  mode: FollowUpMode
  delay_minutes: string
  message: string
}

function createFollowUpDraft(conv: ConversationItem | null): FollowUpDraft {
  return {
    enabled: Boolean(conv?.follow_up_enabled),
    mode: conv?.follow_up_mode === 'custom' ? 'custom' : 'global',
    delay_minutes: conv?.follow_up_delay_minutes != null ? String(conv.follow_up_delay_minutes) : '',
    message: conv?.follow_up_message ?? '',
  }
}

function getFollowUpModeLabel(mode: FollowUpMode | null | undefined) {
  if (mode === 'custom') return 'Custom'
  if (mode === 'global') return 'Global'
  return '—'
}

function getClientName(conv: ConversationItem): string {
  return conv.client_display_name || conv.client_full_name || conv.client_username || `#${conv.id}`
}

function getConversationIdFromChatUrl(value?: string | null) {
  const match = value?.match(/conversation_id=(\d+)/)
  return match ? Number(match[1]) : null
}

function getConversationTab(channel: string): Exclude<ChannelTab, 'all'> | null {
  if (channel === 'instagram') return 'instagram'
  if (channel === 'telegram') return 'telegram'
  if (channel === 'website_ai' || channel === 'website') return 'website'
  return null
}

function getConversationActivityTime(conv: ConversationItem): number {
  const value = conv.last_message_at ?? conv.updated_at ?? conv.created_at
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function sortConversationsByActivity(conversations: ConversationItem[]): ConversationItem[] {
  return [...conversations].sort((a, b) => getConversationActivityTime(b) - getConversationActivityTime(a))
}

function upsertConversation(conversations: ConversationItem[], nextConversation: ConversationItem): ConversationItem[] {
  const exists = conversations.some((conversation) => conversation.id === nextConversation.id)
  const next = exists
    ? conversations.map((conversation) => (conversation.id === nextConversation.id ? nextConversation : conversation))
    : [nextConversation, ...conversations]

  return sortConversationsByActivity(next)
}

function getChannelLabel(channel: string) {
  if (channel === 'instagram') return 'Instagram'
  if (channel === 'telegram') return 'Telegram'
  if (channel === 'website_ai' || channel === 'website') return 'Website'
  return channel
}

function getChannelBadgeClass(channel: string) {
  if (channel === 'instagram') return 'bg-[var(--violet-text)]'
  if (channel === 'telegram') return 'bg-[var(--primary)]'
  if (channel === 'website_ai' || channel === 'website') return 'bg-[var(--success-text)]'
  return 'bg-[var(--muted)]'
}

function getPresenceTone(status: string | null | undefined): Tone {
  if (status === 'online') return 'success'
  if (status === 'recently') return 'warning'
  return 'neutral'
}

function formatPresenceLabel(
  status: string | null | undefined,
  isOnline: boolean | null | undefined,
  lastSeenAt: string | null | undefined,
): string | null {
  if (isOnline === true || status === 'online') return 'Online'
  if (!status) return null
  if (status === 'recently') return 'Recently active'
  if (status === 'last_week') return 'Active this week'
  if (status === 'last_month') return 'Active this month'
  if (status === 'offline') {
    if (!lastSeenAt) return 'Offline'
    const date = new Date(lastSeenAt)
    if (Number.isNaN(date.getTime())) return 'Offline'
    return `Last seen ${date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
  }
  return status
}

function formatConvTime(isoString: string | null): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function isStickerMediaType(value?: string | null) {
  return value === 'sticker' || value === 'animated_sticker' || value === 'video_sticker'
}

function shouldShowStickerCaption(text?: string | null) {
  const normalized = (text ?? '').trim()
  if (!normalized) {
    return false
  }

  return !/^\[(?:Animated Sticker|Sticker|Video Sticker).*]$/i.test(normalized)
}

function AvatarOrInitials({
  avatarUrl,
  name,
  size = 'md',
}: {
  avatarUrl?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const [failed, setFailed] = useState(false)
  const resolved = avatarUrl ? cognilabsaiService.buildAvatarUrl(avatarUrl) ?? resolveMediaUrl(avatarUrl) : null

  const sizeClass = size === 'sm' ? 'h-9 w-9 text-[13px]' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-11 w-11 text-[15px]'

  if (resolved && !failed) {
    return (
      <img
        src={resolved}
        alt={name}
        onError={() => setFailed(true)}
        className={cn(sizeClass, 'shrink-0 rounded-full bg-[var(--muted-surface)] object-cover')}
      />
    )
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  return (
    <div
      className={cn(
        sizeClass,
        'flex shrink-0 items-center justify-center rounded-full bg-[var(--blue-dim)] font-semibold tracking-[-0.01em] text-[var(--blue-text)] select-none',
      )}
    >
      {initials}
    </div>
  )
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === 'all') {
    return <LayoutGrid strokeWidth={1.8} className="h-3 w-3 shrink-0" aria-hidden="true" />
  }

  if (channel === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    )
  }
  if (channel === 'telegram') {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z"/>
      </svg>
    )
  }
  if (channel === 'website' || channel === 'website_ai') {
    return <Globe strokeWidth={1.8} className="h-3 w-3 shrink-0" aria-hidden="true" />
  }
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z"/>
    </svg>
  )
}

function ChannelFilterIcon({ channel, label }: { channel: ChannelTab; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex h-5 w-5 items-center justify-center"
    >
      <ChannelIcon channel={channel} />
    </span>
  )
}

function PauseReasonBadge({ reason }: { reason: string | null }) {
  if (!reason) return null
  return (
    <Badge variant="warning" size="sm">
      {reason}
    </Badge>
  )
}

function AiFollowUpBadge({ dueAt, sentAt }: { dueAt: string | null; sentAt: string | null }) {
  if (sentAt) {
    return (
      <Badge variant="blue" size="sm">
        <Check strokeWidth={1.8} className="h-2.5 w-2.5" />
        AI Follow-up ✓
      </Badge>
    )
  }
  if (dueAt) {
    return (
      <Badge variant="violet" size="sm">
        <Clock strokeWidth={1.8} className="h-2.5 w-2.5" />
        AI Follow-up
      </Badge>
    )
  }
  return null
}

const STAGE_LABEL_MAP: Record<string, string> = {
  'instagram_media_inquiry': "Instagram so'rovi",
  'returned_client': "Qaytgan mijoz",
  'phone provided': "Telefon berildi",
  'phone_provided': "Telefon berildi",
  'greeted': "Salomlashildi",
  'Greeted': "Salomlashildi",
  'new': "Yangi",
  'service_interest': "Xizmatga qiziqdi",
  'business_field': "Sohasini yozdi",
  'experience_years': "Sohadagi yil etildi",
  'phone_discussion': "Telefon orqali muhokama",
  'phone_collected': "Telefon olindi",
  'call_time_collected': "Qulay vaqt olindi",
  'name_collected': "Ism olindi",
  'agreement_confirmed': "Kelishuv tasdiqlandi",
  'lead_created': "Lead yaratildi",
  'lost': "Yo'qotildi",
  'interested_ai': "AI qiziqdi",
  'interested_crm': "CRM qiziqdi",
  'interested_website': "Website qiziqdi",
  'interested_automation': "Avtomatika qiziqdi",
  'interested_other': "Boshqa qiziqish",
  'phone_received': "Telefon olindi",
  'not_fit': "Mos emas",
}

function translateStageLabel(stage: string | null, label: string | null): string {
  const raw = label || stage || ''
  return STAGE_LABEL_MAP[raw] ?? STAGE_LABEL_MAP[raw.toLowerCase()] ?? raw.replaceAll('_', ' ')
}

function AiStageBadge({ stage, label }: { stage: string | null; label: string | null }) {
  if (!stage) return null
  return (
    <Badge variant="violet" size="sm" className="capitalize">
      {translateStageLabel(stage, label)}
    </Badge>
  )
}

function PresenceBadge({
  status,
  isOnline,
  lastSeenAt,
}: {
  status: string | null | undefined
  isOnline: boolean | null | undefined
  lastSeenAt: string | null | undefined
}) {
  const label = formatPresenceLabel(status, isOnline, lastSeenAt)

  if (!label) return null

  const tone = getPresenceTone(isOnline === true ? 'online' : status)

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11.5px] font-medium', toneText[tone])}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', toneDot[tone])} />
      <span className="truncate">{label}</span>
    </span>
  )
}

function ConversationListItem({
  conv,
  isActive,
  onSelect,
  crmCustomerId,
  onOpenCrm,
  onDelete,
}: {
  conv: ConversationItem
  isActive: boolean
  onSelect: () => void
  crmCustomerId: number | null
  onOpenCrm: () => void
  onDelete: () => void
}) {
  const name = getClientName(conv)
  const timeLabel = formatConvTime(conv.last_message_at)
  const presenceLabel = conv.channel === 'telegram'
    ? formatPresenceLabel(conv.telegram_presence_status, conv.telegram_is_online, conv.telegram_last_seen_at)
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'group relative flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none',
        isActive
          ? 'bg-[var(--blue-dim)]'
          : 'hover:bg-[var(--accent-soft)]',
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-r-full bg-[var(--primary)]" />
      )}

      <div className="relative ml-1 shrink-0">
        <AvatarOrInitials avatarUrl={conv.client_avatar_url} name={name} size="md" />
        <div className={cn(
          'absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--surface)] text-white',
          getChannelBadgeClass(conv.channel)
        )}>
          <ChannelIcon channel={conv.channel} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm leading-snug font-semibold tracking-[-0.01em] text-[var(--foreground)]">
              {name}
            </p>
            {conv.unread_count > 0 ? (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[11px] font-bold tabular-nums text-white">
                {conv.unread_count > 99 ? '99+' : conv.unread_count}
              </span>
            ) : null}
          </div>
          {timeLabel && (
            <span className={cn(
              'shrink-0 text-[11.5px] font-medium tabular-nums group-hover:hidden',
              isActive ? 'text-[var(--muted-strong)]' : 'text-[var(--caption)]'
            )}>
              {timeLabel}
            </span>
          )}
          <div className="hidden group-hover:flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {crmCustomerId ? (
              <button
                type="button"
                onClick={onOpenCrm}
                className="inline-flex h-[30px] items-center gap-1.5 rounded-[9px] bg-[var(--success-dim)] px-2.5 text-[11.5px] font-semibold text-[var(--success-text)] transition-colors hover:bg-[var(--success-strong)]"
                title="CRM"
              >
                <IdCard strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true" />
                CRM
              </button>
            ) : null}
            <ActionsMenu
              label={`Actions for ${getClientName(conv)}`}
              items={[
                { label: "O'chirish", onSelect: onDelete, tone: 'danger' },
              ]}
            />
          </div>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={cn(
              'truncate text-[12.5px] leading-snug',
              isActive ? 'text-[var(--muted-strong)]' : 'text-[var(--muted)]'
            )}>
              {conv.last_message_preview || <span className="italic text-[var(--caption)]">Xabar yo'q</span>}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 empty:hidden">
              {presenceLabel ? (
                <PresenceBadge
                  status={conv.telegram_presence_status}
                  isOnline={conv.telegram_is_online}
                  lastSeenAt={conv.telegram_last_seen_at}
                />
              ) : null}
              {conv.ai_stage && !isActive ? (
                <AiStageBadge stage={conv.ai_stage} label={conv.ai_stage_label} />
              ) : null}
              {!conv.crm_customer_id && !conv.lead_phone_number && (conv.ai_follow_up_due_at || conv.ai_follow_up_sent_at) ? (
                <AiFollowUpBadge dueAt={conv.ai_follow_up_due_at} sentAt={conv.ai_follow_up_sent_at} />
              ) : null}
            </div>
          </div>
          {conv.pause_reason && !isActive ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--warning-text)]" />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ msg, isNextSameSender }: { msg: MessageItem; isNextSameSender: boolean }) {
  const isClient = msg.sender_type === 'client'
  const isAi = msg.sender_type === 'ai'
  const isSystem = msg.sender_type === 'system'
  const isSticker = isStickerMediaType(msg.media_type)
  const isAnimatedSticker = msg.media_type === 'animated_sticker'
  const isStaticSticker = msg.media_type === 'sticker' || msg.media_type === 'video_sticker'
  const mediaUrl = isSticker ? resolveMediaUrl(msg.media_url) : null
  const [animationData, setAnimationData] = useState<unknown | null>(null)

  useEffect(() => {
    if (!isAnimatedSticker || !mediaUrl) {
      return
    }

    const controller = new AbortController()

    void fetch(mediaUrl, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setAnimationData(data)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAnimationData(null)
        }
      })

    return () => {
      controller.abort()
    }
  }, [isAnimatedSticker, mediaUrl])

  if (isSystem) {
    return (
      <div className="my-3 flex justify-center">
        <div className="max-w-[78%] rounded-[18px] bg-[var(--surface)] px-[18px] py-3 text-center">
          <div className="mb-1.5 flex items-center justify-center">
            <Badge variant="secondary" size="sm">Auto follow-up</Badge>
          </div>
          <p className="whitespace-pre-wrap wrap-break-word text-[12.5px] text-[var(--muted-strong)]">{msg.text}</p>
        </div>
      </div>
    )
  }

  const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const isUnreadClientMessage = isClient && msg.is_read === false
  const showStickerCaption = Boolean(mediaUrl && shouldShowStickerCaption(msg.text))

  return (
    <div className={cn(
      'flex w-full group relative',
      isClient ? 'justify-start' : 'justify-end',
      isNextSameSender ? 'mb-0.5' : 'mb-3'
    )}>
      <div
        className={cn(
          'relative max-w-[75%] px-3.5 py-2.5 text-[13.5px] leading-relaxed sm:max-w-[62%]',
          isClient
            ? 'rounded-[18px] rounded-bl-[7px] bg-[var(--surface)] text-[var(--foreground)]'
            : 'rounded-[18px] rounded-br-[7px] bg-[var(--primary)] text-white',
        )}
      >
        {(isAi || msg.sender_type === 'operator') && (
          <p className={cn('mb-0.5 text-[11px] font-bold tracking-wide uppercase', isClient ? 'text-[var(--muted)]' : 'text-white/70')}>
            {isAi ? 'AI' : msg.operator_name_snapshot || 'Operator'}
          </p>
        )}
        {isUnreadClientMessage ? (
          <p className="mb-1 text-[11px] font-bold tracking-[0.18em] uppercase text-[var(--primary)]">
            New
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          {isAnimatedSticker && mediaUrl && animationData ? (
            <div className="overflow-hidden rounded-[14px] bg-[var(--muted-surface)] p-1">
              <div className="h-[180px] w-[180px] sm:h-[220px] sm:w-[220px]">
                <Lottie animationData={animationData as object} loop autoplay />
              </div>
            </div>
          ) : isStaticSticker && mediaUrl ? (
            <div className="overflow-hidden rounded-[14px] bg-[var(--muted-surface)]">
              <img
                src={mediaUrl}
                alt={msg.text?.trim() || 'Sticker'}
                className="block max-h-[180px] max-w-[180px] object-contain sm:max-h-[220px] sm:max-w-[220px]"
                loading="lazy"
                draggable={false}
              />
            </div>
          ) : null}

          {!isSticker || !mediaUrl || showStickerCaption || (isAnimatedSticker && !animationData) ? (
            <p className="whitespace-pre-wrap wrap-break-word">{msg.text}</p>
          ) : null}
        </div>

        <div className={cn(
          'mt-1 flex items-center gap-1',
          isClient ? 'justify-start' : 'justify-end'
        )}>
          <span className={cn('text-[11px] font-medium tabular-nums', isClient ? 'text-[var(--caption)]' : 'text-white/70')}>{timeStr}</span>
          {!isClient && (
            <Check strokeWidth={1.8} className="h-2.5 w-2.5 text-white/70" />
          )}
        </div>
      </div>
    </div>
  )
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="sticky top-2 z-20 my-4 flex justify-center">
      <span className="rounded-full bg-[var(--surface)] px-4 py-1.5 text-[11.5px] font-semibold text-[var(--muted)]">
        {date}
      </span>
    </div>
  )
}

function TelegramSearchModal({
  onClose,
  onStartChat,
  onNewChatStarted,
  initialQuery = '',
  onBackToCrm,
}: {
  onClose: () => void
  onStartChat: (conversationId: number) => void
  onNewChatStarted?: () => void
  initialQuery?: string
  onBackToCrm?: () => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<TelegramSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPeer, setSelectedPeer] = useState<TelegramSearchResult | null>(null)
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const { showToast } = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await cognilabsaiService.telegramSearchList(query.trim(), 10)
        setResults(res.items)
      } catch {
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)
  }, [query])

  async function handleStart() {
    if (!selectedPeer || !messageText.trim()) return
    setIsSending(true)
    try {
      if (selectedPeer.existing_conversation_id) {
        onStartChat(selectedPeer.existing_conversation_id)
        return
      }
      await cognilabsaiService.telegramStart(selectedPeer.peer, messageText.trim(), selectedPeer.full_name ?? undefined)
      showToast({ title: 'Chat boshlandi', tone: 'success' })
      onNewChatStarted?.()
      onClose()
    } catch (err) {
      showToast({ title: 'Xatolik', description: getApiErrorMessage(err), tone: 'error' })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Yangi Telegram Chat"
      description="Username, @handle yoki link qidiring"
      className="max-w-[460px]"
      headerIcon={
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--blue-dim)] text-[var(--primary)]">
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z"/>
          </svg>
        </span>
      }
      footer={
        <>
          {onBackToCrm ? (
            <Button
              variant="ghost"
              onClick={onBackToCrm}
              disabled={isSending}
              leftIcon={
                <ArrowLeft strokeWidth={1.8} className="h-4 w-4" />
              }
            >
              CRM ga qaytish
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose} disabled={isSending}>
            Bekor qilish
          </Button>
          {selectedPeer ? (
            <Button
              onClick={() => {
                if (selectedPeer.existing_conversation_id) {
                  onStartChat(selectedPeer.existing_conversation_id)
                } else {
                  void handleStart()
                }
              }}
              disabled={isSending || (!selectedPeer.existing_conversation_id && !messageText.trim())}
            >
              {selectedPeer.existing_conversation_id
                ? 'Chatni ochish'
                : isSending
                  ? 'Yuborilmoqda...'
                  : 'Boshlash'}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-[18px]">
        {/* Search */}
        <div className="relative">
          <Search strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            placeholder="dev949, @username, t.me/link..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedPeer(null)
            }}
            className="pl-10"
            autoFocus
          />
        </div>

        {/* Results */}
        <div>
          {isSearching ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-[14px] px-3 py-2.5">
                  <Skeleton rounded="full" className="h-11 w-11 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton rounded="full" className="h-3 w-2/5" />
                    <Skeleton rounded="full" className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-center text-[12.5px] text-[var(--muted)]">Qidirilmoqda...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="custom-scrollbar-visible max-h-[260px] space-y-1 overflow-y-auto">
              {results.map((item) => (
                <button
                  key={item.peer}
                  type="button"
                  onClick={() => setSelectedPeer(item)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors',
                    selectedPeer?.peer === item.peer
                      ? 'bg-[var(--blue-dim)]'
                      : 'hover:bg-[var(--accent-soft)]',
                  )}
                >
                  <AvatarOrInitials avatarUrl={item.avatar_url} name={item.full_name || item.username || item.peer} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-[-0.01em] text-[var(--foreground)]">{item.full_name || item.username || item.peer}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {item.username && (
                        <p className="truncate text-[12.5px] text-[var(--muted)]">@{item.username}</p>
                      )}
                      {item.presence_status || item.is_online === true ? (
                        <PresenceBadge
                          status={item.presence_status}
                          isOnline={item.is_online}
                          lastSeenAt={item.last_seen_at}
                        />
                      ) : null}
                      {item.existing_conversation_id && (
                        <Badge variant="success" size="sm">
                          Mavjud chat
                        </Badge>
                      )}
                    </div>
                  </div>
                  {selectedPeer?.peer === item.peer && (
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]">
                      <Check strokeWidth={1.8} className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : query.trim() && !isSearching ? (
            <div className="flex flex-col items-center justify-center rounded-[18px] bg-[var(--muted-surface)] px-6 py-8 text-center">
              <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--surface)]">
                <Search strokeWidth={1.8} className="h-5 w-5 text-[var(--muted)]" />
              </div>
              <p className="text-[13px] font-semibold text-[var(--foreground)]">Natija topilmadi</p>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">Boshqa username yoki link kiriting</p>
            </div>
          ) : !query.trim() ? (
            <div className="flex flex-col items-center justify-center rounded-[18px] bg-[var(--muted-surface)] px-6 py-6 text-center">
              <p className="text-[12.5px] text-[var(--muted)]">Username yoki Telegram link kiriting</p>
            </div>
          ) : null}
        </div>

        {/* Message input (new chat) */}
        {selectedPeer && !selectedPeer.existing_conversation_id ? (
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={3}
            placeholder="Birinchi xabarni yozing..."
          />
        ) : null}
      </div>
    </Dialog>
  )
}

export function CognilabsAIChatPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<ChannelTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(
    () => {
      const id = searchParams.get('conversation_id')
      return id ? Number(id) : null
    },
  )
  const returnCustomerId = useMemo(() => {
    const raw = searchParams.get('return_customer_id')
    if (!raw) return null

    const parsed = Number(raw)
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
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const conversationsQuery = useAsyncData(
    () => cognilabsaiService.listConversations(undefined, 50, conversationsPage * 50),
    [conversationsPage],
    {
      onSuccess: (data) => {
        setConversations(sortConversationsByActivity(data.items))
        setConversationsTotal(data.total)
      },
    },
  )
  const crmDashboardQuery = useAsyncData(() => crmService.dashboardWithAllCustomers(), [])

  useEffect(() => {
    const telegramSearchQuery = (searchParams.get('telegram_search') ?? '').trim()

    if (!telegramSearchQuery) {
      return
    }

    setNewTelegramInitialQuery(telegramSearchQuery)
    setShowNewTelegramModal(true)

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('telegram_search')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  const refetchConversationsRef = useRef(conversationsQuery.refetch)
  useEffect(() => {
    refetchConversationsRef.current = conversationsQuery.refetch
  }, [conversationsQuery.refetch])

  const conversationsRef = useRef<ConversationItem[]>([])
  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  useAsyncData(
    () => cognilabsaiService.getIntegrations(),
    [],
    {
      onSuccess: (data) => {
        if (data.websocket_api_key) setWsKey(data.websocket_api_key)
      },
    },
  )

  const selectedConversation = useMemo(
    () => selectedConversationDetail ?? conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationDetail, selectedConversationId],
  )
  const crmCustomerIdByConversationId = useMemo(() => {
    const map = new Map<number, number>()

    for (const customer of crmDashboardQuery.data?.customers ?? []) {
      const conversationId = getConversationIdFromChatUrl(customer.chat_url)
      if (conversationId) {
        map.set(conversationId, customer.id)
      }
    }

    return map
  }, [crmDashboardQuery.data?.customers])

  const filteredConversations = useMemo(() => {
    let list = conversations
    if (activeTab !== 'all') list = list.filter((c) => getConversationTab(c.channel) === activeTab)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          getClientName(c).toLowerCase().includes(q) ||
          c.client_username?.toLowerCase().includes(q) ||
          c.last_message_preview?.toLowerCase().includes(q),
      )
    }
    return list
  }, [conversations, activeTab, searchQuery])

  useEffect(() => {
    if (!selectedConversationId) return
    setIsLoadingMessages(true)
    cognilabsaiService
      .listMessages(selectedConversationId)
      .then((nextMessages) => {
        setMessages(nextMessages)
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === selectedConversationId
              ? { ...conversation, unread_count: 0 }
              : conversation,
          ),
        )
      })
      .catch(() => setMessages([]))
      .finally(() => setIsLoadingMessages(false))
  }, [selectedConversationId])

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
        if (!cancelled) {
          const fallbackConversation = conversationsRef.current.find((conversation) => conversation.id === selectedConversationId) ?? null
          setFollowUpDraft(createFollowUpDraft(fallbackConversation))
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedConversationId])

  useEffect(() => {
    if (!selectedConversationId) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('conversation_id', String(selectedConversationId))
      return next
    }, { replace: true })
  }, [selectedConversationId, setSearchParams])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [messages])

  const selectedConversationIdRef = useRef(selectedConversationId)
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId
  }, [selectedConversationId])

  useEffect(() => {
    if (!wsKey) return

    let socket: WebSocket | null = null
    let isComponentMounted = true
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (!isComponentMounted) return

      const sock = cognilabsaiService.createWebSocket(wsKey!)
      socket = sock
      wsRef.current = sock

      sock.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as WsEvent
          if (data.type === 'message.created') {
            if (data.conversation_id === selectedConversationIdRef.current) {
              setMessages((prev) => {
                // Avoid duplicates by checking ID
                if (prev.some((m) => m.id === data.message.id)) {
                  return prev
                }

                // Check for optimistic message match (same text and sender, and has a temporary ID)
                // We use a large ID (> 1e12) as a heuristic for Date.now() temporary IDs
                const optimisticIdx = prev.findIndex(
                  (m) =>
                    m.id > 1000000000000 &&
                    m.text === data.message.text &&
                    m.sender_type === data.message.sender_type,
                )

                if (optimisticIdx !== -1) {
                  const newMessages = [...prev]
                  newMessages[optimisticIdx] = data.message
                  return newMessages
                }

                return [...prev, data.message]
              })
            }
            const convId = data.conversation_id
            if (conversationsRef.current.some((c) => c.id === convId)) {
              setConversations((prev) =>
                sortConversationsByActivity(
                  prev.map((c) =>
                    c.id === convId
                      ? {
                          ...c,
                          last_message_at: data.message.created_at,
                          last_message_preview: data.message.text,
                          unread_count:
                            data.message.sender_type === 'client' && convId !== selectedConversationIdRef.current
                              ? (c.unread_count ?? 0) + 1
                              : c.unread_count,
                        }
                      : c,
                  ),
                )
              )
            } else {
              void cognilabsaiService
                .getConversation(convId)
                .then((conversation) => {
                  if (!isComponentMounted) return
                  setConversations((prev) => upsertConversation(prev, conversation))
                })
                .catch(() => {
                  if (isComponentMounted) {
                    void refetchConversationsRef.current()
                  }
                })
            }
          } else if (data.type === 'conversation.updated') {
            setConversations((prev) => upsertConversation(prev, data.conversation))
            if (data.conversation_id === selectedConversationIdRef.current) {
              setSelectedConversationDetail(data.conversation)
              setFollowUpDraft(createFollowUpDraft(data.conversation))
            }
          }
        } catch {
          // ignore
        }
      }

      sock.onerror = () => {}
      sock.onclose = () => {
        if (isComponentMounted) {
          reconnectTimeout = setTimeout(connect, 5000)
        }
      }
    }

    connect()

    return () => {
      isComponentMounted = false
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (socket) {
        socket.close()
      }
    }
  }, [wsKey])

  const handleSelectConversation = useCallback((id: number) => {
    const nextConversation = conversations.find((c) => c.id === id) ?? null
    setSelectedConversationId(id)
    setMessageText('')
    setShowPauseUntil(false)
    setPauseUntilDate('')
    setSelectedConversationDetail(nextConversation)
    setFollowUpDraft(createFollowUpDraft(nextConversation))
  }, [conversations])

  async function handleDeleteConversation(conv: ConversationItem) {
    const name = getClientName(conv)
    const approved = await confirm({
      title: `Suhbatni o'chirish?`,
      description: `${name} bilan suhbat butunlay o'chiriladi.`,
      tone: 'danger',
      confirmLabel: `O'chirish`,
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
      showToast({ title: `Suhbat o'chirildi`, tone: 'success' })
    } catch (error) {
      showToast({ title: `O'chirishda xato`, description: getApiErrorMessage(error), tone: 'error' })
    }
  }

  function resolveVisibleCrmCustomerId(conv: ConversationItem) {
    return crmCustomerIdByConversationId.get(conv.id) ?? null
  }

  function handleOpenCrm(customerId: number) {
    navigate(`/crm?customer_id=${customerId}`)
  }

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
      is_read: true,
      read_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    try {
      await cognilabsaiService.sendMessage(selectedConversationId, text)
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setMessageText(text)
      showToast({ title: 'Xatolik', description: getApiErrorMessage(err), tone: 'error' })
    } finally {
      setIsSending(false)
    }
  }

  async function handleToggleAi(action: 'pause' | 'resume') {
    if (!selectedConversationId || isTogglingAi) return
    setIsTogglingAi(true)
    try {
      const updated =
        action === 'pause'
          ? await cognilabsaiService.pause(selectedConversationId)
          : await cognilabsaiService.resume(selectedConversationId)
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSelectedConversationDetail(updated)
      showToast({ title: action === 'pause' ? "AI to'xtatildi" : 'AI faollashdi', tone: 'success' })
    } catch (err) {
      showToast({ title: 'Xatolik', description: getApiErrorMessage(err), tone: 'error' })
    } finally {
      setIsTogglingAi(false)
    }
  }

  async function handleRetryAi() {
    if (!selectedConversationId || isTogglingAi) return
    setIsTogglingAi(true)
    try {
      await cognilabsaiService.retryAi(selectedConversationId)
      showToast({ title: 'AI qayta ishga tushdi', tone: 'success' })
    } catch (err) {
      showToast({ title: 'Xatolik', description: getApiErrorMessage(err), tone: 'error' })
    } finally {
      setIsTogglingAi(false)
    }
  }

  async function handlePauseUntil() {
    if (!selectedConversationId || !pauseUntilDate || isTogglingAi) return
    setIsTogglingAi(true)
    try {
      const updated = await cognilabsaiService.pauseUntil(
        selectedConversationId,
        new Date(pauseUntilDate).toISOString(),
      )
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSelectedConversationDetail(updated)
      setShowPauseUntil(false)
      setPauseUntilDate('')
      showToast({ title: "AI vaqtinchalik to'xtatildi", tone: 'success' })
    } catch (err) {
      showToast({ title: 'Xatolik', description: getApiErrorMessage(err), tone: 'error' })
    } finally {
      setIsTogglingAi(false)
    }
  }

  async function handleSaveFollowUp() {
    if (!selectedConversationId || isSavingFollowUp) return
    if (!followUpDraft.enabled) return

    if (followUpDraft.enabled && followUpDraft.mode === 'custom') {
      const delay = Number(followUpDraft.delay_minutes)
      if (!Number.isFinite(delay) || delay <= 0) {
        showToast({ title: 'Xatolik', description: 'Custom mode uchun delay_minutes 0 dan katta bo‘lishi kerak.', tone: 'error' })
        return
      }
      if (!followUpDraft.message.trim()) {
        showToast({ title: 'Xatolik', description: 'Custom mode uchun message bo‘sh bo‘lmasligi kerak.', tone: 'error' })
        return
      }
    }

    setIsSavingFollowUp(true)
    try {
      const updated = await cognilabsaiService.updateConversationFollowUp(
        selectedConversationId,
        followUpDraft.enabled
          ? followUpDraft.mode === 'custom'
            ? {
                enabled: true,
                mode: 'custom',
                delay_minutes: Number(followUpDraft.delay_minutes),
                message: followUpDraft.message.trim(),
              }
            : { enabled: true, mode: 'global' }
          : { enabled: false },
      )

      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSelectedConversationDetail(updated)
      setFollowUpDraft(createFollowUpDraft(updated))
      showToast({ title: 'Follow-up saqlandi', tone: 'success' })
    } catch (err) {
      showToast({ title: 'Xatolik', description: getApiErrorMessage(err), tone: 'error' })
    } finally {
      setIsSavingFollowUp(false)
    }
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const showChat = selectedConversationId !== null
  const supportsAi = selectedConversation?.supports_ai ?? false
  const aiPaused = selectedConversation?.chat_mode !== 'instagram_ai' || Boolean(selectedConversation?.pause_reason)
  const followUpModeLabel = getFollowUpModeLabel(selectedConversation?.follow_up_mode as FollowUpMode | null | undefined)
  const followUpStatusLabel = selectedConversation?.follow_up_enabled
    ? `${followUpModeLabel}${selectedConversation?.follow_up_sent_at ? ' · Sent' : selectedConversation?.follow_up_due_at ? ' · Pending' : ''}`
    : 'Disabled'

  const tabItems: TabItem<ChannelTab>[] = [
    { value: 'all', label: <ChannelFilterIcon channel="all" label="All" /> },
    { value: 'instagram', label: <ChannelFilterIcon channel="instagram" label="Instagram" /> },
    { value: 'telegram', label: <ChannelFilterIcon channel="telegram" label="Telegram" /> },
    { value: 'website', label: <ChannelFilterIcon channel="website" label="Website" /> },
  ]

  function handleReturnToCrm() {
    const returnTo = searchParams.get('return_to')
    navigate(returnTo === '/outbound-crm' ? returnTo : '/crm')
  }

  return (
    <div
      className="flex min-h-0 flex-col bg-[var(--background)] text-[var(--foreground)] font-sans -mx-7 -mt-[26px] -mb-10"
      style={{ height: 'var(--page-h-bleed)' }}
    >
      <div className="flex min-h-0 w-full flex-1 gap-[18px] overflow-hidden p-[18px]">

        {/* Left panel – conversations list */}
        <div
          className={cn(
            'flex w-full shrink-0 flex-col overflow-hidden rounded-[24px] bg-[var(--surface)] md:w-[340px] lg:w-[400px] xl:w-[440px]',
            showChat && isMobile ? 'hidden' : 'flex',
          )}
        >
          {/* Header */}
          <div className="shrink-0 px-[18px] pt-[18px] pb-4">
            <div className="mb-[18px] flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">Xabarlar</h2>
              <IconButton
                tone="primary"
                label="Yangi Telegram chat"
                className="bg-[var(--blue-dim)] hover:bg-[var(--blue-soft)]"
                onClick={() => {
                  setNewTelegramInitialQuery('')
                  setShowNewTelegramModal(true)
                }}
              >
                <Plus strokeWidth={1.8} className="h-4 w-4" />
              </IconButton>
            </div>

            {/* Filter tabs */}
            <Tabs
              items={tabItems}
              value={activeTab}
              onChange={setActiveTab}
              className="mb-3"
            />

            {/* Pagination */}
            {conversationsTotal > 50 && (
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-medium tabular-nums text-[var(--muted)]">
                  {conversationsPage * 50 + 1}–{Math.min((conversationsPage + 1) * 50, conversationsTotal)} / {conversationsTotal}
                </span>
                <div className="flex items-center gap-1">
                  <IconButton
                    size="sm"
                    label="Oldingi"
                    onClick={() => setConversationsPage((p) => Math.max(0, p - 1))}
                    disabled={conversationsPage === 0 || conversationsQuery.isLoading}
                  >
                    <ChevronLeft strokeWidth={1.8} className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    label="Keyingi"
                    onClick={() => setConversationsPage((p) => p + 1)}
                    disabled={(conversationsPage + 1) * 50 >= conversationsTotal || conversationsQuery.isLoading}
                  >
                    <ChevronRight strokeWidth={1.8} className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                placeholder="Qidiruv..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-9 rounded-[11px] pl-9 text-[13px]"
              />
            </div>
          </div>

          {/* Chat list */}
          <div className="custom-scrollbar-visible flex-1 overflow-y-auto px-[10px] pb-[18px]">
            {conversationsQuery.isLoading ? (
              <div className="space-y-1">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex gap-3 rounded-[14px] px-3 py-2.5">
                    <Skeleton rounded="full" className="h-11 w-11 shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <Skeleton rounded="full" className="h-2.5 w-2/5" />
                      <Skeleton rounded="full" className="h-2.5 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="mx-2 mt-2 flex flex-col items-center justify-center rounded-[18px] bg-[var(--muted-surface)] px-6 py-14 text-center">
                <MessageSquare strokeWidth={1.8} className="mb-3 h-10 w-10 text-[var(--caption)]" />
                <p className="text-[13px] font-semibold text-[var(--muted-strong)]">Chatlar topilmadi</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredConversations.map((conv) => (
                  <ConversationListItem
                    key={conv.id}
                    conv={conv}
                    isActive={selectedConversationId === conv.id}
                    onSelect={() => handleSelectConversation(conv.id)}
                    crmCustomerId={resolveVisibleCrmCustomerId(conv)}
                    onOpenCrm={() => {
                      const customerId = resolveVisibleCrmCustomerId(conv)
                      if (customerId) {
                        handleOpenCrm(customerId)
                      }
                    }}
                    onDelete={() => void handleDeleteConversation(conv)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel – chat */}
        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-[var(--surface)]',
            !showChat && isMobile ? 'hidden' : 'flex',
          )}
        >
          {!selectedConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[var(--muted-surface)]">
                <MessageCircle strokeWidth={1.8} className="h-8 w-8 text-[var(--muted)]" />
              </div>
              <h3 className="mb-1 text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Chat tanlang</h3>
              <p className="max-w-xs text-[13px] text-[var(--muted)]">Chap tomondagi ro'yxatdan suhbatni tanlang</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="z-30 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-[22px] py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  {isMobile ? (
                    <IconButton
                      size="sm"
                      label="Orqaga"
                      onClick={() => setSelectedConversationId(null)}
                    >
                      <ArrowLeft strokeWidth={1.8} className="h-5 w-5" />
                    </IconButton>
                  ) : null}
                  <div className="relative shrink-0">
                    <AvatarOrInitials avatarUrl={selectedConversation.client_avatar_url} name={getClientName(selectedConversation)} size="sm" />
                    <div className={cn(
                      'absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--surface)] text-white',
                      getChannelBadgeClass(selectedConversation.channel)
                    )}>
                      <ChannelIcon channel={selectedConversation.channel} />
                    </div>
                    </div>
                  {returnCustomerId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleReturnToCrm}
                      className="shrink-0 px-2.5 text-[12px]"
                      title="Back to CRM"
                      leftIcon={
                        <ArrowLeft strokeWidth={1.8} className="h-4 w-4" aria-hidden="true" />
                      }
                    >
                      CRM
                    </Button>
                  ) : null}
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{getClientName(selectedConversation)}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--muted)]">
                          <ChannelIcon channel={selectedConversation.channel} />
                          {getChannelLabel(selectedConversation.channel)}
                        </span>
                        {selectedConversation.channel === 'telegram' && (
                          <>
                            <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--caption)]" />
                            <PresenceBadge
                              status={selectedConversation.telegram_presence_status}
                              isOnline={selectedConversation.telegram_is_online}
                              lastSeenAt={selectedConversation.telegram_last_seen_at}
                            />
                          </>
                        )}
                        {selectedConversation.pause_reason && (
                          <>
                            <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--caption)]" />
                          <PauseReasonBadge reason={selectedConversation.pause_reason} />
                        </>
                      )}
                      {selectedConversation.last_operator_name && (
                        <>
                          <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--caption)]" />
                          <span className="text-[11.5px] font-medium text-[var(--muted)]">{selectedConversation.last_operator_name}</span>
                        </>
                      )}
                      {selectedConversation.ai_stage && (
                        <>
                          <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--caption)]" />
                          <AiStageBadge stage={selectedConversation.ai_stage} label={selectedConversation.ai_stage_label} />
                        </>
                      )}
                      {!selectedConversation.crm_customer_id && !selectedConversation.lead_phone_number && (selectedConversation.ai_follow_up_due_at || selectedConversation.ai_follow_up_sent_at) && (
                        <>
                          <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--caption)]" />
                          <AiFollowUpBadge dueAt={selectedConversation.ai_follow_up_due_at} sentAt={selectedConversation.ai_follow_up_sent_at} />
                        </>
                      )}
                    </div>
                    {/* Lead info row */}
                    {(selectedConversation.lead_phone_number || selectedConversation.lead_full_name) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {selectedConversation.lead_phone_number && (
                          <Badge variant="success" size="sm" className="tabular-nums">
                            <Phone strokeWidth={1.8} className="h-2.5 w-2.5" />
                            {selectedConversation.lead_phone_number}
                          </Badge>
                        )}
                        {selectedConversation.lead_full_name && (
                          <Badge variant="secondary" size="sm">
                            {selectedConversation.lead_full_name}
                          </Badge>
                        )}
                        {selectedConversation.lead_business_field && (
                          <Badge variant="secondary" size="sm">
                            {selectedConversation.lead_business_field}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {returnToKanban && selectedConversationId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/cognilabsai/kanban?highlight=${selectedConversationId}`)}
                      className="text-[12px]"
                      title="Kanbanga qaytish"
                      leftIcon={
                        <ArrowLeft strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true" />
                      }
                    >
                      Kanban
                    </Button>
                  ) : null}
                  {selectedConversation.crm_customer_id ? (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => handleOpenCrm(selectedConversation.crm_customer_id!)}
                      className="text-[12px]"
                      title="CRM da ko'rish"
                      leftIcon={
                        <IdCard strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true" />
                      }
                    >
                      CRM
                    </Button>
                  ) : null}
                  {supportsAi && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleAi(aiPaused ? 'resume' : 'pause')}
                      disabled={isTogglingAi}
                      className={cn(
                        'text-[12px]',
                        aiPaused
                          ? 'bg-[var(--success-dim)] text-[var(--success-text)] hover:bg-[var(--success-strong)] hover:text-[var(--success-text)]'
                          : 'bg-[var(--warning-dim)] text-[var(--warning-text)] hover:bg-[var(--warning-soft)] hover:text-[var(--warning-text)]'
                      )}
                    >
                      {isTogglingAi ? '...' : aiPaused ? 'AI yoqish' : "AI to'xtatish"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Follow-up */}
              <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-[18px] py-[18px] sm:px-[22px]">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[var(--accent-soft)] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Follow-up</h4>
                      <Badge variant="secondary" size="sm">
                        {followUpStatusLabel}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Switch
                      checked={followUpDraft.enabled}
                      onChange={(v) => setFollowUpDraft((prev) => ({ ...prev, enabled: v }))}
                      label="Follow-up enabled"
                    />
                    <Button
                      size="sm"
                      onClick={() => void handleSaveFollowUp()}
                      disabled={isSavingFollowUp || !followUpDraft.enabled}
                    >
                      {isSavingFollowUp ? 'Saving...' : 'Save follow-up'}
                    </Button>
                  </div>
                </div>

                {followUpDraft.enabled ? (
                  <div className="mt-[18px] grid gap-[18px] lg:grid-cols-[170px_1fr]">
                    <div>
                      <Label className="mb-1.5 block">Mode</Label>
                      <SelectField
                        value={followUpDraft.mode}
                        onValueChange={(value) => setFollowUpDraft((prev) => ({ ...prev, mode: value as FollowUpMode }))}
                        options={[
                          { value: 'global', label: 'Global' },
                          { value: 'custom', label: 'Custom' },
                        ]}
                      />
                    </div>

                    <div className="grid gap-[18px] sm:grid-cols-2">
                      <div className={followUpDraft.mode === 'global' ? 'opacity-60' : ''}>
                        <Label className="mb-1.5 block">Delay (minutes)</Label>
                        <Input
                          type="number"
                          min={1}
                          disabled={followUpDraft.mode !== 'custom'}
                          value={followUpDraft.mode === 'custom' ? followUpDraft.delay_minutes : ''}
                          onChange={(e) => setFollowUpDraft((prev) => ({ ...prev, delay_minutes: e.target.value }))}
                          placeholder="60"
                          className="tabular-nums"
                        />
                      </div>

                      <div className={followUpDraft.mode === 'global' ? 'opacity-60 sm:col-span-2' : 'sm:col-span-2'}>
                        <Label className="mb-1.5 block">Message</Label>
                        <Textarea
                          disabled={followUpDraft.mode !== 'custom'}
                          value={followUpDraft.mode === 'custom' ? followUpDraft.message : ''}
                          onChange={(e) => setFollowUpDraft((prev) => ({ ...prev, message: e.target.value }))}
                          placeholder="Assalomu alaykum, yozishganingiz bo'yicha yana eslatib o'tmoqchi edik."
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Messages */}
              <div
                ref={messagesContainerRef}
                className="custom-scrollbar-visible relative flex-1 overflow-y-auto bg-[var(--accent-soft)] px-[18px] py-[18px] sm:px-[22px]"
              >
                <div className="flex min-h-full flex-col">
                  <div className="flex-1" />
                  {messages.length === 0 && !isLoadingMessages ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="rounded-full bg-[var(--surface)] px-4 py-2">
                        <p className="text-[13px] font-medium text-[var(--muted)]">Xabarlar ko'rsatiladi</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {messages.reduce((acc: React.ReactNode[], msg, idx) => {
                        const prevMsg = messages[idx - 1]
                        const nextMsg = messages[idx + 1]
                        const msgDate = new Date(msg.created_at).toLocaleDateString([], { month: 'long', day: 'numeric' })
                        const prevMsgDate = prevMsg ? new Date(prevMsg.created_at).toLocaleDateString([], { month: 'long', day: 'numeric' }) : null

                        if (msgDate !== prevMsgDate) {
                          acc.push(<DateSeparator key={`date-${msg.created_at}`} date={msgDate} />)
                        }

                        const isNextSameSender = Boolean(
                          nextMsg &&
                          nextMsg.sender_type === msg.sender_type &&
                          new Date(nextMsg.created_at).toLocaleDateString([], { month: 'long', day: 'numeric' }) === msgDate
                        )

                        acc.push(<MessageBubble key={msg.id} msg={msg} isNextSameSender={isNextSameSender} />)
                        return acc
                      }, [])}
                    </div>
                  )}
                  {isLoadingMessages ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--accent-soft)]/70">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-hover)] border-t-[var(--primary)]" />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* AI Controls bar (Instagram only) */}
              {supportsAi && (
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-[18px] py-2.5 sm:px-[22px]">
                  <span className="ui-eyebrow">AI:</span>

                  <button
                    type="button"
                    onClick={() => handleToggleAi(aiPaused ? 'resume' : 'pause')}
                    disabled={isTogglingAi}
                    className={cn(
                      'inline-flex h-[30px] items-center gap-1.5 rounded-[9px] px-2.5 text-[12px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40',
                      aiPaused
                        ? 'bg-[var(--success-dim)] text-[var(--success-text)] hover:bg-[var(--success-strong)]'
                        : 'bg-[var(--warning-dim)] text-[var(--warning-text)] hover:bg-[var(--warning-soft)]'
                    )}
                  >
                    {aiPaused ? (
                      <Play strokeWidth={1.8} className="h-3 w-3" />
                    ) : (
                      <Pause strokeWidth={1.8} className="h-3 w-3" />
                    )}
                    {aiPaused ? 'AI yoqish' : "AI to'xtatish"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleRetryAi()}
                    disabled={isTogglingAi}
                    className="inline-flex h-[30px] items-center gap-1.5 rounded-[9px] bg-[var(--blue-dim)] px-2.5 text-[12px] font-semibold text-[var(--blue-text)] transition-colors hover:bg-[var(--blue-soft)] disabled:pointer-events-none disabled:opacity-40"
                  >
                    <RefreshCw strokeWidth={1.8} className="h-3 w-3" />
                    Qayta urinish
                  </button>

                  {/* Pause until */}
                  {showPauseUntil ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="datetime-local"
                        value={pauseUntilDate}
                        onChange={(e) => setPauseUntilDate(e.target.value)}
                        className="h-[30px] min-h-[30px] w-auto rounded-[9px] px-2 py-0 text-[12px] tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => void handlePauseUntil()}
                        disabled={isTogglingAi || !pauseUntilDate}
                        className="inline-flex h-[30px] items-center rounded-[9px] bg-[var(--warning-dim)] px-2.5 text-[12px] font-semibold text-[var(--warning-text)] transition-colors hover:bg-[var(--warning-soft)] disabled:pointer-events-none disabled:opacity-40"
                      >
                        Tasdiqlash
                      </button>
                      <IconButton
                        size="sm"
                        label="Bekor qilish"
                        onClick={() => { setShowPauseUntil(false); setPauseUntilDate('') }}
                      >
                        <X strokeWidth={1.8} className="h-3 w-3" />
                      </IconButton>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowPauseUntil(true)}
                      disabled={isTogglingAi}
                      className="inline-flex h-[30px] items-center gap-1.5 rounded-[9px] bg-[var(--input-surface)] px-2.5 text-[12px] font-semibold text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface-hover)] disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Clock strokeWidth={1.8} className="h-3 w-3" />
                      Muddat belgilash
                    </button>
                  )}
                </div>
              )}

              {/* Composer */}
              <div className="z-30 shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-[18px] py-[18px] sm:px-[22px]">
                <div className="flex items-end gap-2.5 rounded-[18px] bg-[var(--input-surface)] px-3 py-2 transition-colors focus-within:bg-[var(--surface)] focus-within:ring-2 focus-within:ring-[var(--primary)]/20">
                  <textarea
                    ref={textareaRef}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSend()
                      }
                    }}
                    placeholder="Xabar yozing..."
                    rows={1}
                    className="custom-scrollbar-none max-h-[200px] flex-1 resize-none overflow-y-auto border-0 bg-transparent py-1.5 text-[13.5px] leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-0"
                    style={{ fieldSizing: 'content' } as React.CSSProperties}
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={isSending || !messageText.trim()}
                    className={cn(
                      "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] transition-colors duration-150",
                      messageText.trim()
                        ? "bg-[var(--primary)] text-white shadow-[var(--elev-primary)] hover:bg-[var(--primary-hover)]"
                        : "cursor-not-allowed bg-[var(--surface)] text-[var(--caption)]"
                    )}
                  >
                    {messageText.trim() ? (
                      <Send strokeWidth={1.8} className="h-4 w-4 ml-0.5" />
                    ) : (
                      <ArrowUp strokeWidth={1.8} className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showNewTelegramModal ? (
        <TelegramSearchModal
          initialQuery={newTelegramInitialQuery}
          onBackToCrm={
            returnCustomerId
              ? () => {
                  setShowNewTelegramModal(false)
                  setNewTelegramInitialQuery('')
                  handleReturnToCrm()
                }
              : undefined
          }
          onClose={() => {
            setShowNewTelegramModal(false)
            setNewTelegramInitialQuery('')
          }}
          onStartChat={(id) => {
            handleSelectConversation(id)
            setShowNewTelegramModal(false)
            setNewTelegramInitialQuery('')
          }}
          onNewChatStarted={() => void conversationsQuery.refetch()}
        />
      ) : null}
    </div>
  )
}
