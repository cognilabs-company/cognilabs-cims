import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Contact, PauseCircle, Pencil, Search, Trash2, X } from 'lucide-react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { cn } from '../../../../shared/lib/cn'
import type { ConversationItem } from '../../../../shared/api/services/cognilabsai.service'
import { formatListTime, getClientName, getConversationTab, isOnline, type ChannelTab } from './chatUtils'
import { ChannelGlyph, TgAvatar } from './TgParts'

type TgSidebarProps = {
  conversations: ConversationItem[]
  allConversations: ConversationItem[]
  loading: boolean
  selectedId: number | null
  tab: ChannelTab
  onTabChange: (tab: ChannelTab) => void
  search: string
  onSearchChange: (value: string) => void
  onSelect: (id: number) => void
  /** Omit to hide the "new chat" button (no `create` permission). */
  onNewChat?: () => void
  crmCustomerIdFor: (conv: ConversationItem) => number | null
  onOpenCrm: (customerId: number) => void
  /** Omit to hide "Delete chat" (no `delete` permission). */
  onDelete?: (conv: ConversationItem) => void
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
}

type Menu = { conv: ConversationItem; x: number; y: number }

export function TgSidebar({
  conversations, allConversations, loading, selectedId, tab, onTabChange, search, onSearchChange, onSelect, onNewChat,
  crmCustomerIdFor, onOpenCrm, onDelete, page, pageCount, onPageChange, className,
}: TgSidebarProps) {
  const { t, locale } = useLocale()
  const [menu, setMenu] = useState<Menu | null>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', close)
    }
  }, [menu])

  const tabs: Array<[ChannelTab, string]> = [
    ['all', t('aichat.tab.all', 'All chats')],
    ['telegram', 'Telegram'],
    ['instagram', 'Instagram'],
    ['website', t('aichat.tab.website', 'Website')],
  ]
  const unreadIn = (value: ChannelTab) => allConversations.filter((conv) => conv.unread_count > 0 && (value === 'all' || getConversationTab(conv.channel) === value)).length

  return (
    <aside className={cn('relative flex min-h-0 flex-col bg-[var(--tg-bg)]', className)}>
      {/* search */}
      <div className="flex shrink-0 items-center gap-2 px-3 pt-2.5 pb-1.5">
        <label className="group/search relative flex h-[42px] flex-1 items-center rounded-full bg-[var(--tg-search)] ring-[var(--tg-primary)] transition-shadow focus-within:bg-[var(--tg-bg)] focus-within:ring-2">
          <Search size={20} className="pointer-events-none absolute left-3.5 text-[var(--tg-secondary)] transition-colors group-focus-within/search:text-[var(--tg-primary)]" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('aichat.search', 'Search')}
            aria-label={t('aichat.search', 'Search')}
            className="h-full w-full bg-transparent pr-9 pl-12 text-[15px] text-[var(--tg-text)] outline-none placeholder:text-[var(--tg-secondary)]"
          />
          {search ? (
            <button type="button" onClick={() => onSearchChange('')} aria-label={t('common.clear', 'Clear')} className="absolute right-2 grid h-7 w-7 place-items-center rounded-full text-[var(--tg-secondary)] hover:bg-[var(--tg-hover)]">
              <X size={16} />
            </button>
          ) : null}
        </label>
      </div>

      {/* folder tabs */}
      <div className="no-scrollbar flex shrink-0 gap-0.5 overflow-x-auto border-b border-[var(--tg-border)] px-1.5" role="tablist">
        {tabs.map(([value, label]) => {
          const active = tab === value
          const unread = unreadIn(value)
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(value)}
              className={cn('relative flex shrink-0 items-center gap-1.5 rounded-t-[10px] px-2.5 pt-2.5 pb-3 text-[14px] font-medium transition-colors', active ? 'text-[var(--tg-primary)]' : 'text-[var(--tg-secondary)] hover:bg-[var(--tg-hover)]')}
            >
              {label}
              {unread > 0 ? <span className={cn('grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11.5px] font-semibold text-white', active ? 'bg-[var(--tg-primary)]' : 'bg-[var(--tg-badge-muted)]')}>{unread}</span> : null}
              {active ? <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-[var(--tg-primary)]" /> : null}
            </button>
          )
        })}
      </div>

      {/* list */}
      <div className="tg-scroll min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {loading && conversations.length === 0 ? (
          Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 px-2 py-[9px]">
              <span className="skeleton h-[54px] w-[54px] shrink-0 rounded-full" />
              <span className="flex-1 space-y-2.5">
                <span className="skeleton block h-3 w-2/5 rounded-full" />
                <span className="skeleton block h-3 w-3/4 rounded-full" />
              </span>
            </div>
          ))
        ) : conversations.length === 0 ? (
          <div className="px-6 pt-16 text-center">
            <Search size={40} className="mx-auto text-[var(--tg-secondary)] opacity-60" />
            <p className="mt-3 text-[15px] font-medium text-[var(--tg-text)]">{t('aichat.no_chats', 'No chats found')}</p>
            <p className="mt-1 text-[13.5px] text-[var(--tg-secondary)]">{t('aichat.no_chats_hint', 'Try another name or folder.')}</p>
          </div>
        ) : conversations.map((conv) => {
          const name = getClientName(conv)
          const active = conv.id === selectedId
          const online = conv.channel === 'telegram' && isOnline(conv)
          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => onSelect(conv.id)}
              onContextMenu={(event) => {
                if (!onDelete && !crmCustomerIdFor(conv)) return
                event.preventDefault()
                setMenu({ conv, x: event.clientX, y: event.clientY })
              }}
              className={cn('flex w-full items-center gap-3 rounded-[12px] px-2 py-[9px] text-left transition-colors', active ? 'bg-[var(--tg-active)]' : 'hover:bg-[var(--tg-hover)]')}
            >
              <TgAvatar url={conv.client_avatar_url} name={name} size={54} online={online} ring={active ? 'var(--tg-active)' : 'var(--tg-bg)'} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <ChannelGlyph channel={conv.channel} className={active ? 'text-white' : 'text-[var(--tg-secondary)]'} />
                  <span className={cn('min-w-0 flex-1 truncate text-[16px] leading-[22px] font-semibold', active ? 'text-white' : 'text-[var(--tg-text)]')}>{name}</span>
                  {conv.pause_reason ? <PauseCircle size={14} className={cn('shrink-0', active ? 'text-white/80' : 'text-[var(--tg-secondary)]')} aria-label={t('aichat.ai_paused', 'AI paused')} /> : null}
                  <span className={cn('shrink-0 text-[12.5px] tabular-nums', active ? 'text-white/80' : 'text-[var(--tg-secondary)]')}>{formatListTime(conv.last_message_at, locale)}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className={cn('min-w-0 flex-1 truncate text-[15px] leading-[21px]', active ? 'text-white/85' : 'text-[var(--tg-secondary)]')}>
                    {conv.last_message_preview || <i>{t('aichat.no_messages', 'No messages')}</i>}
                  </span>
                  {conv.unread_count > 0 ? (
                    <span className={cn('grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full px-1.5 text-[13px] font-semibold tabular-nums', active ? 'bg-white text-[var(--tg-active)]' : 'bg-[var(--tg-badge)] text-white')}>
                      {conv.unread_count > 99 ? '99+' : conv.unread_count}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {pageCount > 1 ? (
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--tg-border)] px-3 py-1.5 text-[12.5px] text-[var(--tg-secondary)]">
          <button type="button" disabled={page === 0} onClick={() => onPageChange(page - 1)} aria-label={t('picker.prev_month', 'Previous')} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--tg-hover)] disabled:opacity-30"><ChevronLeft size={16} /></button>
          <span className="tabular-nums">{page + 1} / {pageCount}</span>
          <button type="button" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)} aria-label={t('picker.next_month', 'Next')} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--tg-hover)] disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      ) : null}

      {/* new chat (floating pencil, like Telegram) */}
      {onNewChat ? (
        <button
          type="button"
          onClick={onNewChat}
          aria-label={t('aichat.new_chat', 'New Telegram chat')}
          title={t('aichat.new_chat', 'New Telegram chat')}
          className={cn('absolute right-4 grid h-[54px] w-[54px] place-items-center rounded-full bg-[var(--tg-primary)] text-white shadow-[0_2px_10px_rgba(0,0,0,0.2)] transition-transform hover:scale-105 active:scale-95', pageCount > 1 ? 'bottom-14' : 'bottom-4')}
        >
          <Pencil size={22} />
        </button>
      ) : null}

      {menu && typeof document !== 'undefined' ? createPortal(
        <div
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
          className="tg tg-menu fixed z-[120] min-w-[200px] rounded-[12px] p-1"
          style={{ left: Math.min(menu.x, window.innerWidth - 216), top: Math.min(menu.y, window.innerHeight - 110) }}
        >
          {crmCustomerIdFor(menu.conv) ? (
            <button type="button" role="menuitem" onClick={() => { onOpenCrm(crmCustomerIdFor(menu.conv)!); setMenu(null) }} className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left text-[14px] font-medium text-[var(--tg-text)] hover:bg-[var(--tg-hover)]">
              <Contact size={18} className="text-[var(--tg-secondary)]" /> {t('aichat.open_crm', 'Open in CRM')}
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" role="menuitem" onClick={() => { onDelete(menu.conv); setMenu(null) }} className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left text-[14px] font-medium text-[#e53935] hover:bg-[var(--tg-hover)]">
              <Trash2 size={18} /> {t('aichat.delete_chat', 'Delete chat')}
            </button>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </aside>
  )
}
