import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '../../../shared/lib/cn'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useToast } from '../../../shared/toast/useToast'
import { useAuth } from '../../auth/hooks/useAuth'
import { crmService } from '../../../shared/api/services/crm.service'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Textarea } from '../../../shared/ui/textarea'
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
  if (channel === 'instagram') return 'bg-pink-500'
  if (channel === 'telegram') return 'bg-[#2AABEE]'
  if (channel === 'website_ai' || channel === 'website') return 'bg-emerald-500'
  return 'bg-[var(--muted)]'
}

function getPresenceTone(status: string | null | undefined) {
  if (status === 'online') return 'text-emerald-400'
  if (status === 'recently') return 'text-amber-400'
  return 'text-[var(--muted)]'
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
        className={cn(sizeClass, 'shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]')}
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
        'shrink-0 rounded-full bg-[var(--blue-dim)] text-[var(--blue-text)] font-medium flex items-center justify-center select-none ring-1 ring-[var(--border)]',
      )}
    >
      {initials}
    </div>
  )
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === 'all') {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
      </svg>
    )
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
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" strokeLinecap="round" />
        <path d="M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z"/>
    </svg>
  )
}

function ChannelFilterIcon({ channel }: { channel: ChannelTab }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-current">
      <ChannelIcon channel={channel} />
    </span>
  )
}

function PauseReasonBadge({ reason }: { reason: string | null }) {
  if (!reason) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
      {reason}
    </span>
  )
}

function AiFollowUpBadge({ dueAt, sentAt }: { dueAt: string | null; sentAt: string | null }) {
  if (sentAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        AI Follow-up ✓
      </span>
    )
  }
  if (dueAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        AI Follow-up
      </span>
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
    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 capitalize">
      {translateStageLabel(stage, label)}
    </span>
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

  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', getPresenceTone(status))}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isOnline === true || status === 'online'
            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]'
            : status === 'recently'
              ? 'bg-amber-400'
              : 'bg-[var(--muted)]',
        )}
      />
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
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150 relative flex items-center gap-3 border border-transparent',
        isActive
          ? 'bg-[var(--accent-soft)] border-[var(--border-hover)] shadow-sm'
          : 'hover:bg-[var(--accent-soft)]',
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-7 bg-blue-500 rounded-r-full" />
      )}

      <div className="relative shrink-0 ml-1">
        <AvatarOrInitials avatarUrl={conv.client_avatar_url} name={name} size="md" />
        <div className={cn(
          'absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[var(--background)] flex items-center justify-center',
          getChannelBadgeClass(conv.channel)
        )}>
          <ChannelIcon channel={conv.channel} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1.5">
          <div className="min-w-0 flex items-center gap-2">
            <p className={cn(
              'truncate text-[13.5px] font-semibold leading-snug',
              isActive ? 'text-[var(--foreground)]' : 'text-[var(--foreground)]'
            )}>
              {name}
            </p>
            {conv.unread_count > 0 ? (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                {conv.unread_count > 99 ? '99+' : conv.unread_count}
              </span>
            ) : null}
          </div>
          {timeLabel && (
            <span className={cn(
              'shrink-0 text-[11px] font-medium group-hover:hidden',
              isActive ? 'text-[var(--muted)]' : 'text-[var(--caption)]'
            )}>
              {timeLabel}
            </span>
          )}
          <div className="hidden group-hover:flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {crmCustomerId ? (
              <button
                type="button"
                onClick={onOpenCrm}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                title="CRM"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M2.5 5.25A1.75 1.75 0 0 1 4.25 3.5h7.5A1.75 1.75 0 0 1 13.5 5.25v5.5a1.75 1.75 0 0 1-1.75 1.75h-7.5A1.75 1.75 0 0 1 2.5 10.75z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 6.25h6M5 8h3.25" strokeLinecap="round" />
                </svg>
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
              'truncate text-[12px] leading-snug',
              isActive ? 'text-[var(--muted)]' : 'text-[var(--caption)]'
            )}>
              {conv.last_message_preview || <span className="italic text-[var(--caption)]">Xabar yo'q</span>}
            </p>
            {presenceLabel ? (
              <div className="mt-1">
                <PresenceBadge
                  status={conv.telegram_presence_status}
                  isOnline={conv.telegram_is_online}
                  lastSeenAt={conv.telegram_last_seen_at}
                />
              </div>
            ) : null}
            {conv.ai_stage && !isActive ? (
              <AiStageBadge stage={conv.ai_stage} label={conv.ai_stage_label} />
            ) : null}
            {!conv.crm_customer_id && !conv.lead_phone_number && (conv.ai_follow_up_due_at || conv.ai_follow_up_sent_at) ? (
              <AiFollowUpBadge dueAt={conv.ai_follow_up_due_at} sentAt={conv.ai_follow_up_sent_at} />
            ) : null}
          </div>
          {conv.pause_reason && !isActive ? (
            <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-amber-400" />
          ) : null}
        </div>
      </div>
    </button>
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
      <div className="flex justify-center my-3">
        <div className="max-w-[78%] rounded-2xl border border-(--border) bg-(--muted-surface) px-4 py-2 text-center shadow-sm">
          <div className="mb-1 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--caption)">
            <span className="rounded-full bg-(--accent-soft) px-2 py-0.5 text-[10px] font-bold text-(--muted-strong)">Auto follow-up</span>
          </div>
          <p className="whitespace-pre-wrap wrap-break-word text-[12.5px] text-(--foreground)">{msg.text}</p>
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
          'relative max-w-[75%] sm:max-w-[62%] px-3.5 py-2 text-[13.5px] leading-relaxed shadow-sm',
          isClient
            ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] border border-[var(--border)] rounded-xl rounded-bl-sm'
            : 'bg-[var(--surface-elevated)] text-[var(--foreground)] border border-[var(--border)] rounded-xl rounded-br-sm',
          isNextSameSender && (isClient ? 'rounded-bl-sm' : 'rounded-br-sm')
        )}
      >
        {(isAi || msg.sender_type === 'operator') && (
          <p className={cn('mb-0.5 text-[10.5px] font-bold tracking-wide uppercase', !isClient ? 'text-[var(--foreground)]' : 'text-(--foreground)')}>
            {isAi ? 'AI' : msg.operator_name_snapshot || 'Operator'}
          </p>
        )}
        {isUnreadClientMessage ? (
          <p className={cn('mb-1 text-[10px] font-bold uppercase tracking-[0.18em]', !isClient ? 'text-[var(--foreground)]' : 'text-(--foreground)')}>
            New
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          {isAnimatedSticker && mediaUrl && animationData ? (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-black/5 p-1">
              <div className="h-[180px] w-[180px] sm:h-[220px] sm:w-[220px]">
                <Lottie animationData={animationData as object} loop autoplay />
              </div>
            </div>
          ) : isStaticSticker && mediaUrl ? (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-black/5">
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
            <p className="whitespace-pre-wrap wrap-break-word text-(--foreground)">{msg.text}</p>
          ) : null}
        </div>

        <div className={cn(
          'flex items-center gap-1 mt-1',
          isClient ? 'justify-start' : 'justify-end'
        )}>
          <span className={cn('text-[10px] font-medium', !isClient ? 'text-[#2AABEE]' : 'text-(--muted)')}>{timeStr}</span>
          {!isClient && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5 text-[#2AABEE]">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex justify-center my-4 sticky top-2 z-20">
      <span className="rounded-full bg-[var(--card)] border border-[var(--border)] px-4 py-1 text-[11px] font-semibold text-[var(--muted)] shadow-sm backdrop-blur-md">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[420px] rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-[var(--shadow-xl)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-[#2AABEE]/10 border border-[#2AABEE]/20 flex items-center justify-center text-[#2AABEE]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-white">Yangi Telegram Chat</h3>
              <p className="text-[11px] text-[var(--muted)]">Username, @handle yoki link qidiring</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--accent-soft)] text-[var(--muted)] hover:text-[var(--muted-strong)] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-4">
          <div className="relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--caption)]">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <Input
              placeholder="dev949, @username, t.me/link..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedPeer(null)
              }}
              className="h-10 pl-10 pr-4 bg-[var(--input-surface)] border-[var(--border)] focus:border-[#2AABEE]/50 rounded-xl text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--caption)]"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="px-2 pb-2">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-5 w-5 border-2 border-[#2AABEE]/30 border-t-[#2AABEE] rounded-full animate-spin" />
              <p className="mt-2 text-[12px] text-[var(--muted)]">Qidirilmoqda...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-[260px] space-y-0.5 overflow-y-auto custom-scrollbar-visible">
              {results.map((item) => (
                <button
                  key={item.peer}
                  type="button"
                  onClick={() => setSelectedPeer(item)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                    selectedPeer?.peer === item.peer
                      ? 'bg-[#2AABEE]/10 border border-[#2AABEE]/25'
                      : 'border border-transparent hover:bg-[var(--accent-soft)]',
                  )}
                >
                  <AvatarOrInitials avatarUrl={item.avatar_url} name={item.full_name || item.username || item.peer} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-[var(--foreground)]">{item.full_name || item.username || item.peer}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.username && (
                        <p className="truncate text-[12px] text-[var(--muted)]">@{item.username}</p>
                      )}
                      {item.presence_status || item.is_online === true ? (
                        <PresenceBadge
                          status={item.presence_status}
                          isOnline={item.is_online}
                          lastSeenAt={item.last_seen_at}
                        />
                      ) : null}
                      {item.existing_conversation_id && (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-1.5 py-0.5">
                          Mavjud chat
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedPeer?.peer === item.peer && (
                    <div className="shrink-0 h-4 w-4 rounded-full bg-[#2AABEE] flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-2.5 w-2.5 text-white">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : query.trim() && !isSearching ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-10 w-10 rounded-full bg-[var(--muted-surface)] flex items-center justify-center mb-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-[var(--caption)]">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <p className="text-[13px] font-medium text-[var(--muted)]">Natija topilmadi</p>
              <p className="text-[11px] text-[var(--caption)] mt-0.5">Boshqa username yoki link kiriting</p>
            </div>
          ) : !query.trim() ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-[12px] text-[var(--caption)]">Username yoki Telegram link kiriting</p>
            </div>
          ) : null}
        </div>

        {/* Message input (new chat) */}
        {selectedPeer && !selectedPeer.existing_conversation_id ? (
          <div className="px-5 pb-4">
            <div className="relative rounded-xl border border-[var(--border)] bg-[var(--input-surface)] focus-within:border-[#2AABEE]/40 transition-colors">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
                placeholder="Birinchi xabarni yozing..."
                className="w-full resize-none rounded-xl bg-transparent px-4 py-3 text-[13.5px] text-[var(--foreground)] focus:outline-none placeholder:text-[var(--caption)]"
              />
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          {onBackToCrm ? (
            <Button
              variant="ghost"
              onClick={onBackToCrm}
              disabled={isSending}
              className="flex-1 h-10 rounded-xl font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] text-[13px]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1.5 h-4 w-4">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              CRM ga qaytish
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSending}
            className={cn(
              'h-10 rounded-xl font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] text-[13px]',
              onBackToCrm ? 'flex-1' : 'w-full',
            )}
          >
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
              className="flex-[2] h-10 rounded-xl font-semibold bg-[#2AABEE] hover:bg-[#229ED9] text-white text-[13px]"
            >
              {selectedPeer.existing_conversation_id
                ? 'Chatni ochish'
                : isSending
                  ? 'Yuborilmoqda...'
                  : 'Boshlash'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
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

  const tabItems: Array<{ key: ChannelTab; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'telegram', label: 'Telegram' },
    { key: 'website', label: 'Website' },
  ]

  function handleReturnToCrm() {
    const returnTo = searchParams.get('return_to')
    navigate(returnTo === '/outbound-crm' ? returnTo : '/crm')
  }

  return (
    <div
      className="flex min-h-0 flex-col bg-[var(--background)] text-[var(--foreground)] font-sans -mx-4 -mt-4 -mb-6 sm:-mx-6 lg:-mx-8"
      style={{ height: 'calc(100vh - 74px)' }}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden w-full">

        {/* Left panel – conversations list */}
        <div
          className={cn(
            'flex w-full flex-col md:w-[340px] lg:w-[400px] xl:w-[440px] bg-[var(--surface)] border-r border-[var(--border)] overflow-hidden shrink-0',
            showChat && isMobile ? 'hidden' : 'flex',
          )}
        >
          {/* Header */}
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[var(--border)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-[var(--foreground)] tracking-tight">Xabarlar</h2>
              <button
                onClick={() => {
                  setNewTelegramInitialQuery('')
                  setShowNewTelegramModal(true)
                }}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-[#2AABEE]/10 text-[#2AABEE] hover:bg-[#2AABEE] hover:text-white transition-colors border border-[#2AABEE]/20"
                title="Yangi Telegram chat"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 mb-3">
              {tabItems.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  aria-label={tab.label}
                  title={tab.label}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all inline-flex items-center justify-center',
                    activeTab === tab.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--muted-strong)] hover:bg-[var(--accent-soft)]',
                  )}
                >
                  <ChannelFilterIcon channel={tab.key} />
                </button>
              ))}
            </div>

            {/* Pagination */}
            {conversationsTotal > 50 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-[var(--caption)]">
                  {conversationsPage * 50 + 1}–{Math.min((conversationsPage + 1) * 50, conversationsTotal)} / {conversationsTotal}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setConversationsPage((p) => Math.max(0, p - 1))}
                    disabled={conversationsPage === 0 || conversationsQuery.isLoading}
                    className="h-6 w-6 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConversationsPage((p) => p + 1)}
                    disabled={(conversationsPage + 1) * 50 >= conversationsTotal || conversationsQuery.isLoading}
                    className="h-6 w-6 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--caption)]">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <Input
                placeholder="Qidiruv..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 pr-3 text-[13px] bg-[var(--input-surface)] border-[var(--border)] focus:border-blue-500/40 rounded-xl text-[var(--foreground)] placeholder:text-[var(--caption)]"
              />
            </div>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar-visible p-2">
            {conversationsQuery.isLoading ? (
              <div className="space-y-1">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex gap-3 animate-pulse px-3 py-2.5 rounded-xl">
                    <div className="h-11 w-11 rounded-full bg-[var(--accent-soft)] shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-2.5 w-2/5 bg-[var(--accent-soft)] rounded" />
                      <div className="h-2.5 w-3/4 bg-[var(--accent-soft)] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[var(--caption)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 mb-3 opacity-40">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-[13px] font-medium">Chatlar topilmadi</p>
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
            'flex min-h-0 flex-1 flex-col bg-[var(--background)] overflow-hidden relative',
            !showChat && isMobile ? 'hidden' : 'flex',
          )}
        >
          {!selectedConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
              <div className="h-16 w-16 rounded-xl bg-[var(--muted-surface)] border border-[var(--border)] flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-[var(--caption)]">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="text-[15px] font-semibold text-[var(--muted-strong)] mb-1">Chat tanlang</h3>
              <p className="text-[13px] text-[var(--caption)] max-w-xs">Chap tomondagi ro'yxatdan suhbatni tanlang</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-3 bg-[var(--surface)] backdrop-blur-xl z-30 border-b border-[var(--border)]">
                <div className="flex items-center gap-3 min-w-0">
                  {isMobile ? (
                    <button
                      type="button"
                      onClick={() => setSelectedConversationId(null)}
                      className="rounded-lg p-1.5 hover:bg-[var(--accent-soft)] text-[var(--muted)]"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
                        <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : null}
                  <div className="relative shrink-0">
                    <AvatarOrInitials avatarUrl={selectedConversation.client_avatar_url} name={getClientName(selectedConversation)} size="sm" />
                    <div className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[var(--surface)] flex items-center justify-center',
                      getChannelBadgeClass(selectedConversation.channel)
                    )}>
                      <ChannelIcon channel={selectedConversation.channel} />
                    </div>
                    </div>
                  {returnCustomerId ? (
                    <button
                      type="button"
                      onClick={handleReturnToCrm}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--input-surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--foreground)] transition hover:border-[var(--border-hover)] hover:bg-[var(--input-surface-hover)]"
                      title="Back to CRM"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4" aria-hidden="true">
                        <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      CRM
                    </button>
                  ) : null}
                    <div className="min-w-0">
                      <h3 className="truncate text-[14px] font-bold text-[var(--foreground)]">{getClientName(selectedConversation)}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)] font-medium">
                          <ChannelIcon channel={selectedConversation.channel} />
                          {getChannelLabel(selectedConversation.channel)}
                        </span>
                        {selectedConversation.channel === 'telegram' && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-[var(--border)] shrink-0" />
                            <PresenceBadge
                              status={selectedConversation.telegram_presence_status}
                              isOnline={selectedConversation.telegram_is_online}
                              lastSeenAt={selectedConversation.telegram_last_seen_at}
                            />
                          </>
                        )}
                        {selectedConversation.pause_reason && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-[var(--border)] shrink-0" />
                          <PauseReasonBadge reason={selectedConversation.pause_reason} />
                        </>
                      )}
                      {selectedConversation.last_operator_name && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-[var(--border)] shrink-0" />
                          <span className="text-[11px] text-[var(--muted)]">{selectedConversation.last_operator_name}</span>
                        </>
                      )}
                      {selectedConversation.ai_stage && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-[var(--border)] shrink-0" />
                          <AiStageBadge stage={selectedConversation.ai_stage} label={selectedConversation.ai_stage_label} />
                        </>
                      )}
                      {!selectedConversation.crm_customer_id && !selectedConversation.lead_phone_number && (selectedConversation.ai_follow_up_due_at || selectedConversation.ai_follow_up_sent_at) && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-[var(--border)] shrink-0" />
                          <AiFollowUpBadge dueAt={selectedConversation.ai_follow_up_due_at} sentAt={selectedConversation.ai_follow_up_sent_at} />
                        </>
                      )}
                    </div>
                    {/* Lead info row */}
                    {(selectedConversation.lead_phone_number || selectedConversation.lead_full_name) && (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {selectedConversation.lead_phone_number && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            {selectedConversation.lead_phone_number}
                          </span>
                        )}
                        {selectedConversation.lead_full_name && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                            {selectedConversation.lead_full_name}
                          </span>
                        )}
                        {selectedConversation.lead_business_field && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                            {selectedConversation.lead_business_field}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {returnToKanban && selectedConversationId ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/cognilabsai/kanban?highlight=${selectedConversationId}`)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--input-surface)] px-3 text-[12px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface-hover)]"
                      title="Kanbanga qaytish"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5" aria-hidden="true">
                        <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Kanban
                    </button>
                  ) : null}
                  {selectedConversation.crm_customer_id ? (
                    <button
                      type="button"
                      onClick={() => handleOpenCrm(selectedConversation.crm_customer_id!)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-[12px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                      title="CRM da ko'rish"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M2.5 5.25A1.75 1.75 0 0 1 4.25 3.5h7.5A1.75 1.75 0 0 1 13.5 5.25v5.5a1.75 1.75 0 0 1-1.75 1.75h-7.5A1.75 1.75 0 0 1 2.5 10.75z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5 6.25h6M5 8h3.25" strokeLinecap="round" />
                      </svg>
                      CRM
                    </button>
                  ) : null}
                  {supportsAi && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleAi(aiPaused ? 'resume' : 'pause')}
                      disabled={isTogglingAi}
                      className={cn(
                        "h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors border",
                        aiPaused
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500 hover:text-white"
                      )}
                    >
                      {isTogglingAi ? '...' : aiPaused ? 'AI yoqish' : "AI to'xtatish"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Follow-up */}
              <div className="shrink-0 px-4 sm:px-6 py-3 bg-(--surface) border-b border-(--border)">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--border) bg-(--muted-surface) px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[12px] font-semibold text-(--foreground)">Follow-up</h4>
                      <span className="rounded-full border border-(--border) bg-(--card) px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-(--muted)">
                        {followUpStatusLabel}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={followUpDraft.enabled}
                      onChange={(v) => setFollowUpDraft((prev) => ({ ...prev, enabled: v }))}
                      label="Follow-up enabled"
                    />
                    <Button
                      size="sm"
                      onClick={() => void handleSaveFollowUp()}
                      disabled={isSavingFollowUp || !followUpDraft.enabled}
                      className="h-8 px-3"
                    >
                      {isSavingFollowUp ? 'Saving...' : 'Save follow-up'}
                    </Button>
                  </div>
                </div>

                {followUpDraft.enabled ? (
                  <div className="mt-3 grid gap-3 lg:grid-cols-[170px_1fr]">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-(--foreground)">Mode</label>
                      <SelectField
                        value={followUpDraft.mode}
                        onValueChange={(value) => setFollowUpDraft((prev) => ({ ...prev, mode: value as FollowUpMode }))}
                        options={[
                          { value: 'global', label: 'Global' },
                          { value: 'custom', label: 'Custom' },
                        ]}
                        className="h-10"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className={followUpDraft.mode === 'global' ? 'opacity-60' : ''}>
                        <label className="mb-1 block text-[11px] font-semibold text-(--foreground)">Delay (minutes)</label>
                        <Input
                          type="number"
                          min={1}
                          disabled={followUpDraft.mode !== 'custom'}
                          value={followUpDraft.mode === 'custom' ? followUpDraft.delay_minutes : ''}
                          onChange={(e) => setFollowUpDraft((prev) => ({ ...prev, delay_minutes: e.target.value }))}
                          placeholder="60"
                        />
                      </div>

                      <div className={followUpDraft.mode === 'global' ? 'opacity-60 sm:col-span-2' : 'sm:col-span-2'}>
                        <label className="mb-1 block text-[11px] font-semibold text-(--foreground)">Message</label>
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
                className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 custom-scrollbar-visible relative"
              >
                <div className="flex flex-col min-h-full">
                  <div className="flex-1" />
                  {messages.length === 0 && !isLoadingMessages ? (
                    <div className="py-10 flex flex-col items-center justify-center text-center">
                      <div className="px-4 py-2 rounded-xl bg-[var(--muted-surface)] border border-[var(--border)]">
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
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--background)]/40 backdrop-blur-[1px]">
                      <div className="h-5 w-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* AI Controls bar (Instagram only) */}
              {supportsAi && (
                <div className="shrink-0 flex items-center flex-wrap gap-2 px-4 py-2 bg-[var(--surface)] border-t border-[var(--border)]">
                  <span className="text-[11px] text-[var(--caption)] font-medium uppercase tracking-wider">AI:</span>

                  <button
                    type="button"
                    onClick={() => handleToggleAi(aiPaused ? 'resume' : 'pause')}
                    disabled={isTogglingAi}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-colors',
                      aiPaused
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                    )}
                  >
                    {aiPaused ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                        <path d="M5 3l14 9-14 9V3z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                        <path d="M10 4H6v16h4V4zM18 4h-4v16h4V4z" strokeLinecap="round" />
                      </svg>
                    )}
                    {aiPaused ? 'AI yoqish' : "AI to'xtatish"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleRetryAi()}
                    disabled={isTogglingAi}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                      <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Qayta urinish
                  </button>

                  {/* Pause until */}
                  {showPauseUntil ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="datetime-local"
                        value={pauseUntilDate}
                        onChange={(e) => setPauseUntilDate(e.target.value)}
                        className="h-7 rounded-lg px-2 text-[11px] bg-[var(--input-surface)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:border-blue-500/50"
                      />
                      <button
                        type="button"
                        onClick={() => void handlePauseUntil()}
                        disabled={isTogglingAi || !pauseUntilDate}
                        className="inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                      >
                        Tasdiqlash
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowPauseUntil(false); setPauseUntilDate('') }}
                        className="inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--accent-soft)] transition-colors"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowPauseUntil(true)}
                      disabled={isTogglingAi}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--accent-soft)] transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Muddat belgilash
                    </button>
                  )}
                </div>
              )}

              {/* Composer */}
              <div className="shrink-0 bg-[var(--surface)] px-4 py-3 z-30 border-t border-[var(--border)]">
                <div className="flex items-end gap-2.5 bg-[var(--input-surface)] rounded-xl px-3 py-2 border border-[var(--border)] focus-within:border-blue-500/40 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
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
                    className="flex-1 resize-none bg-transparent border-0 focus:ring-0 text-[13.5px] leading-relaxed py-1.5 max-h-[200px] overflow-y-auto custom-scrollbar-none placeholder:text-[var(--caption)] text-[var(--foreground)] outline-none"
                    style={{ fieldSizing: 'content' } as React.CSSProperties}
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={isSending || !messageText.trim()}
                    className={cn(
                      "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 mb-0.5",
                      messageText.trim()
                        ? "bg-blue-600 text-white hover:bg-blue-500 shadow-sm"
                        : "bg-[var(--accent-soft)] text-[var(--caption)] cursor-not-allowed"
                    )}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("h-4 w-4", messageText.trim() && "ml-0.5")}>
                      {messageText.trim() ? (
                        <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                      ) : (
                        <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                      )}
                    </svg>
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
