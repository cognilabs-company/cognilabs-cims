import { useState, type ReactNode } from 'react'
import { ChecksIcon, ClockCountdownIcon, PauseCircleIcon, PhoneIcon, UserCheckIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { cognilabsaiService, type ConversationItem } from '../../../../shared/api/services/cognilabsai.service'
import { cn } from '../../../../shared/lib/cn'
import { resolveMediaUrl } from '../../../../shared/lib/media-url'
import { ChannelGlyph } from './ChannelGlyph'
import { avatarTone, CHANNEL_TONES, channelKind, channelLabel, formatRelativeTime, getClientName, initialsOf } from './kanbanUtils'

function ClientAvatar({ name, url, size = 34 }: { name: string; url?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false)
  const resolved = url ? cognilabsaiService.buildAvatarUrl(url) ?? resolveMediaUrl(url) : null
  if (resolved && !failed) {
    return <img src={resolved} alt="" onError={() => setFailed(true)} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  const [background, color] = avatarTone(name)
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full text-[11.5px] font-semibold tracking-[0.01em] select-none"
      style={{ width: size, height: size, background, color }}
    >
      {initialsOf(name)}
    </span>
  )
}

type ChipTone = 'neutral' | 'success' | 'blue' | 'warning'

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: 'bg-[var(--muted-surface)] text-[var(--muted-strong)]',
  success: 'bg-[var(--success-dim)] text-[var(--success-text)]',
  blue: 'bg-[var(--blue-dim)] text-[var(--blue-text)]',
  warning: 'bg-[var(--warning-dim)] text-[var(--warning-text)]',
}

function Chip({ tone, icon, title, children, className }: { tone: ChipTone; icon: ReactNode; title?: string; children: ReactNode; className?: string }) {
  return (
    <span title={title} className={cn('inline-flex h-[22px] max-w-full min-w-0 items-center gap-1 rounded-[7px] px-1.5 text-[11px] leading-none font-medium', CHIP_TONES[tone], className)}>
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  )
}

/** Compact card: who, from where, how fresh, and the few facts that matter (phone, CRM, unread, follow-up). */
export function KanbanCard({ conv, onClick, highlighted, index }: { conv: ConversationItem; onClick: () => void; highlighted?: boolean; index: number }) {
  const { t } = useLocale()
  const name = getClientName(conv)
  const kind = channelKind(conv.channel)
  const followUpSent = !conv.crm_customer_id && !conv.lead_phone_number && conv.ai_follow_up_sent_at
  const followUpDue = !conv.crm_customer_id && !conv.lead_phone_number && conv.ai_follow_up_due_at && !followUpSent
  const subtitle = conv.ai_interest || conv.last_message_preview
  const unread = conv.unread_count > 0
  const hasChips = Boolean(conv.lead_phone_number || conv.crm_customer_id || followUpSent || followUpDue || conv.pause_reason)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'kb-in group/card relative block w-full rounded-[12px] border bg-[var(--surface-elevated)] p-3 text-left shadow-[var(--elev-sm)]',
        'transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-[var(--border-hover)] hover:shadow-[var(--elev-md)] motion-reduce:hover:translate-y-0',
        'focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none',
        highlighted ? 'border-transparent ring-2 ring-[var(--primary)]' : 'border-[var(--border)]',
      )}
      style={{ animationDelay: `${Math.min(index * 30, 360)}ms` }}
    >
      <span className="flex items-start gap-2.5">
        <span className="relative shrink-0">
          <ClientAvatar name={name} url={conv.client_avatar_url} />
          <span
            className="absolute -right-1 -bottom-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-[var(--surface-elevated)] ring-2 ring-[var(--surface-elevated)]"
            style={{ color: CHANNEL_TONES[kind] }}
            title={channelLabel(kind, t)}
          >
            <ChannelGlyph kind={kind} size={13} weight="fill" />
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] leading-5 font-semibold tracking-[-0.01em] text-[var(--foreground)]">{name}</span>
            <span className={cn('shrink-0 text-[11px] tabular-nums', unread ? 'font-semibold text-[var(--blue-text)]' : 'text-[var(--caption)]')}>
              {formatRelativeTime(conv.last_message_at, t)}
            </span>
          </span>
          <span className="mt-0.5 flex items-start gap-2">
            <span className={cn('line-clamp-2 min-w-0 flex-1 text-[12px] leading-[1.45] break-words', subtitle ? 'text-[var(--muted)]' : 'text-[var(--caption)] italic')}>
              {subtitle || t('aichat.no_messages', 'No messages')}
            </span>
            {unread ? (
              <span
                className="mt-px grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-[var(--primary)] px-1.5 text-[10.5px] leading-none font-semibold text-[var(--on-inverse)] tabular-nums"
                title={t('aichat.unread_messages', 'Unread messages')}
              >
                {conv.unread_count > 99 ? '99+' : conv.unread_count}
              </span>
            ) : null}
          </span>
        </span>
      </span>

      {hasChips ? (
        <span className="mt-2.5 flex flex-wrap items-center gap-1">
          {conv.lead_phone_number ? (
            <Chip tone="neutral" icon={<PhoneIcon size={12} weight="bold" />} className="tabular-nums">{conv.lead_phone_number}</Chip>
          ) : null}
          {conv.crm_customer_id ? (
            <Chip tone="success" icon={<UserCheckIcon size={12} weight="bold" />} title={t('aikanban.in_crm', 'Customer is in the CRM')}>CRM</Chip>
          ) : null}
          {followUpSent ? (
            <Chip tone="neutral" icon={<ChecksIcon size={12} weight="bold" />} title={t('aikanban.follow_up_sent', 'Follow-up sent')}>{t('aichat.follow_up', 'Follow-up')}</Chip>
          ) : null}
          {followUpDue ? (
            <Chip tone="blue" icon={<ClockCountdownIcon size={12} weight="bold" />} title={t('aikanban.follow_up_due', 'Follow-up scheduled')}>{t('aichat.follow_up', 'Follow-up')}</Chip>
          ) : null}
          {conv.pause_reason ? (
            <Chip tone="warning" icon={<PauseCircleIcon size={12} weight="bold" />} title={conv.pause_reason}>{conv.pause_reason}</Chip>
          ) : null}
        </span>
      ) : null}
    </button>
  )
}
