import { useEffect, useState, type ReactNode } from 'react'
import Lottie from 'lottie-react'
import { cn } from '../../../../shared/lib/cn'
import { resolveMediaUrl } from '../../../../shared/lib/media-url'
import { cognilabsaiService, type MessageItem } from '../../../../shared/api/services/cognilabsai.service'
import { avatarGradient, formatMessageTime, initialsOf, isPendingMessage, isStickerMediaType, shouldShowStickerCaption } from './chatUtils'

/* ── avatar ──────────────────────────────────────────── */

export function TgAvatar({ url, name, size = 54, online = false, ring = 'var(--tg-bg)' }: { url?: string | null; name: string; size?: number; online?: boolean; ring?: string }) {
  const [failed, setFailed] = useState(false)
  const resolved = url ? cognilabsaiService.buildAvatarUrl(url) ?? resolveMediaUrl(url) : null
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {resolved && !failed ? (
        <img src={resolved} alt="" onError={() => setFailed(true)} className="h-full w-full rounded-full object-cover" draggable={false} />
      ) : (
        <span
          className="grid h-full w-full place-items-center rounded-full font-semibold text-white select-none"
          style={{ background: avatarGradient(name), fontSize: Math.round(size * 0.38) }}
        >
          {initialsOf(name)}
        </span>
      )}
      {online ? (
        <span
          className="absolute right-[1px] bottom-[1px] rounded-full bg-[var(--success)]"
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26), boxShadow: `0 0 0 2px ${ring}` }}
        />
      ) : null}
    </span>
  )
}

/* ── channel glyphs (small, before the name) ─────────── */

export function ChannelGlyph({ channel, className }: { channel: string; className?: string }) {
  if (channel === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className={cn('h-[14px] w-[14px] shrink-0', className)} fill="none" stroke="currentColor" strokeWidth="2" aria-label="Instagram">
        <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (channel === 'telegram') {
    return (
      <svg viewBox="0 0 24 24" className={cn('h-[14px] w-[14px] shrink-0', className)} fill="currentColor" aria-label="Telegram">
        <path d="M21.6 4.2 2.9 11.4c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.6.2 1.8-.8l3.3-15.4c.3-1.3-.5-1.9-1.4-1.5ZM8.9 14.1l9.6-6.1c.5-.3.9-.1.5.2l-8.2 7.4-.3 3.4-1.6-4.9Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={cn('h-[14px] w-[14px] shrink-0', className)} fill="none" stroke="currentColor" strokeWidth="2" aria-label="Website">
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  )
}

/* ── ticks / clock ───────────────────────────────────── */

function Ticks({ read, pending }: { read: boolean; pending: boolean }) {
  if (pending) {
    return (
      <svg viewBox="0 0 16 16" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-label="Sending">
        <circle cx="8" cy="8" r="6" /><path d="M8 5v3.2l2 1.3" strokeLinecap="round" />
      </svg>
    )
  }
  return read ? (
    <svg viewBox="0 0 20 12" className="h-[11px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-label="Read">
      <path d="M1.5 6.5 5 10l7-8" /><path d="M8.6 9.6 9 10l7-8" />
    </svg>
  ) : (
    <svg viewBox="0 0 14 12" className="h-[11px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-label="Sent">
      <path d="M1.5 6.5 5 10l7-8" />
    </svg>
  )
}

/* ── service pills ───────────────────────────────────── */

export function ServicePill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('tg-service inline-block rounded-full px-2.5 py-[3px] text-[13.5px] leading-[1.45] font-medium text-white', className)}>{children}</span>
}

export function DateDivider({ label }: { label: string }) {
  return (
    <div className="pointer-events-none sticky top-2 z-10 my-2 flex justify-center">
      <ServicePill>{label}</ServicePill>
    </div>
  )
}

export function UnreadDivider({ label }: { label: string }) {
  return (
    <div className="tg-unread-bar -mx-4 my-2 py-1 text-center text-[13.5px] font-medium">{label}</div>
  )
}

/* ── message ─────────────────────────────────────────── */

type MessageRowProps = {
  msg: MessageItem
  /** first in a run from the same sender (shows the sender name) */
  first: boolean
  /** last in a run (gets the tail and bigger gap) */
  last: boolean
  labels: { ai: string; operator: string; autoFollowUp: string }
}

function Tail({ side }: { side: 'in' | 'out' }) {
  return side === 'in' ? (
    <svg viewBox="0 0 9 17" className="tg-tail absolute bottom-0 -left-[8.6px] h-[17px] w-[9px]" aria-hidden="true">
      <path d="M9 0v17H2.4C.9 17 .3 15.8 1.3 14.7 5.2 10.7 8.4 6.3 9 0Z" fill="var(--tg-bubble-in)" />
    </svg>
  ) : (
    <svg viewBox="0 0 9 17" className="tg-tail absolute -right-[8.6px] bottom-0 h-[17px] w-[9px]" aria-hidden="true">
      <path d="M0 0v17h6.6c1.5 0 2.1-1.2 1.1-2.3C3.8 10.7.6 6.3 0 0Z" fill="var(--tg-bubble-out)" />
    </svg>
  )
}

export function MessageRow({ msg, first, last, labels }: MessageRowProps) {
  const incoming = msg.sender_type === 'client'
  const isAi = msg.sender_type === 'ai'
  const sticker = isStickerMediaType(msg.media_type)
  const animated = msg.media_type === 'animated_sticker'
  const mediaUrl = sticker ? resolveMediaUrl(msg.media_url) : null
  const [animationData, setAnimationData] = useState<unknown | null>(null)

  useEffect(() => {
    if (!animated || !mediaUrl) return
    const controller = new AbortController()
    void fetch(mediaUrl, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => { if (!controller.signal.aborted) setAnimationData(data) })
      .catch(() => { if (!controller.signal.aborted) setAnimationData(null) })
    return () => controller.abort()
  }, [animated, mediaUrl])

  if (msg.sender_type === 'system') {
    return (
      <div className="my-1.5 flex justify-center">
        <ServicePill className="max-w-[80%] text-center whitespace-pre-wrap">
          <span className="font-semibold">{labels.autoFollowUp}:</span> {msg.text}
        </ServicePill>
      </div>
    )
  }

  const time = formatMessageTime(msg.created_at)
  const pending = isPendingMessage(msg)
  const meta = (
    <>
      {time}
      {!incoming ? <Ticks read={msg.is_read} pending={pending} /> : null}
    </>
  )
  const sender = !incoming && first ? (isAi ? labels.ai : msg.operator_name_snapshot || labels.operator) : null

  // Stickers: no bubble, time in a translucent pill
  const stickerVisible = sticker && mediaUrl && (!animated || animationData)
  if (stickerVisible && !shouldShowStickerCaption(msg.text)) {
    return (
      <div className={cn('flex', incoming ? 'justify-start' : 'justify-end', last ? 'mb-2' : 'mb-0.5')}>
        <div className="relative">
          {animated ? (
            <div className="h-[180px] w-[180px]"><Lottie animationData={animationData as object} loop autoplay /></div>
          ) : (
            <img src={mediaUrl!} alt={msg.text?.trim() || 'Sticker'} className="block max-h-[180px] max-w-[180px] object-contain" loading="lazy" draggable={false} />
          )}
          <span className="tg-service absolute right-1 bottom-1 inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[12px] text-white">{meta}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex', incoming ? 'justify-start pl-[9px]' : 'justify-end pr-[9px]', last ? 'mb-2' : 'mb-0.5')}>
      <div
        className={cn(
          'tg-bubble relative max-w-[min(480px,82%)] px-2.5 pt-[5px] pb-[6px] text-[15px] leading-[1.35]',
          incoming ? 'tg-bubble-in' : 'tg-bubble-out',
          'rounded-[15px]',
          last && (incoming ? 'rounded-bl-none' : 'rounded-br-none'),
          !first && (incoming ? 'rounded-tl-[6px]' : 'rounded-tr-[6px]'),
          !last && (incoming ? 'rounded-bl-[6px]' : 'rounded-br-[6px]'),
        )}
      >
        {sender ? <p className={cn('mb-px truncate text-[14px] leading-5 font-semibold', isAi ? 'text-[var(--tg-name-ai)]' : 'text-[var(--tg-name-op)]')}>{sender}</p> : null}

        {sticker && mediaUrl && stickerVisible ? (
          <div className="mb-1 overflow-hidden rounded-[10px]">
            {animated ? <div className="h-[160px] w-[160px]"><Lottie animationData={animationData as object} loop autoplay /></div>
              : <img src={mediaUrl} alt="" className="block max-h-[160px] max-w-[160px] object-contain" loading="lazy" draggable={false} />}
          </div>
        ) : null}

        <p className="break-words whitespace-pre-wrap">
          {msg.text}
          {/* room for the time so it never overlaps the last line */}
          <span className={cn('inline-block', incoming ? 'w-[44px]' : 'w-[64px]')} aria-hidden="true" />
        </p>
        <span className={cn('tg-meta absolute right-2 bottom-[4px] inline-flex items-center gap-[3px] text-[12px] leading-none select-none', incoming ? 'tg-meta-in' : 'tg-meta-out')}>
          {meta}
        </span>
        {last ? <Tail side={incoming ? 'in' : 'out'} /> : null}
      </div>
    </div>
  )
}
