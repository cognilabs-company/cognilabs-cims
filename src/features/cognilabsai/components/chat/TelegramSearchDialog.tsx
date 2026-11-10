import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Search } from 'lucide-react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { cn } from '../../../../shared/lib/cn'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { useToast } from '../../../../shared/toast/useToast'
import { Button } from '../../../../shared/ui/button'
import { Dialog } from '../../../../shared/ui/dialog'
import { cognilabsaiService, type TelegramSearchResult } from '../../../../shared/api/services/cognilabsai.service'
import { presenceOf } from './chatUtils'
import { ChannelGlyph, TgAvatar } from './TgParts'

type Props = {
  initialQuery?: string
  onClose: () => void
  onStartChat: (conversationId: number) => void
  onNewChatStarted?: () => void
  onBackToCrm?: () => void
  presenceText: (kind: ReturnType<typeof presenceOf>) => string
}

/** "New Telegram chat": search a user, then open the existing chat or send a first message. */
export function TelegramSearchDialog({ initialQuery = '', onClose, onStartChat, onNewChatStarted, onBackToCrm, presenceText }: Props) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<TelegramSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<TelegramSearchResult | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trimmed = query.trim()
  const visible = trimmed ? results : []

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!trimmed) return
    timer.current = setTimeout(() => {
      setSearching(true)
      cognilabsaiService.telegramSearchList(trimmed, 10)
        .then((response) => setResults(response.items))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 400)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [trimmed])

  async function start() {
    if (!selected) return
    if (selected.existing_conversation_id) { onStartChat(selected.existing_conversation_id); return }
    if (!message.trim()) return
    setSending(true)
    try {
      await cognilabsaiService.telegramStart(selected.peer, message.trim(), selected.full_name ?? undefined)
      showToast({ title: t('aichat.chat_started', 'Chat started'), tone: 'success' })
      onNewChatStarted?.()
      onClose()
    } catch (error) {
      showToast({ title: t('common.error', 'Error'), description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('aichat.new_chat', 'New Telegram chat')}
      description={t('aichat.new_chat_hint', 'Search by username, @handle or t.me link')}
      headerIcon={<ChannelGlyph channel="telegram" />}
      footer={
        <>
          {onBackToCrm ? <Button variant="ghost" onClick={onBackToCrm} disabled={sending} leftIcon={<ArrowLeft size={15} />}>{t('aichat.back_to_crm', 'Back to CRM')}</Button> : null}
          <Button variant="secondary" onClick={onClose} disabled={sending}>{t('common.cancel', 'Cancel')}</Button>
          {selected ? (
            <Button onClick={() => void start()} loading={sending} disabled={!selected.existing_conversation_id && !message.trim()}>
              {selected.existing_conversation_id ? t('aichat.open_chat', 'Open chat') : t('aichat.start_chat', 'Start chat')}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="tg space-y-3">
        <label className="group/search relative flex h-[42px] items-center rounded-full bg-[var(--tg-search)] ring-[var(--tg-primary)] focus-within:ring-2">
          <Search size={19} className="pointer-events-none absolute left-3.5 text-[var(--tg-secondary)]" />
          <input
            autoFocus
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSelected(null) }}
            placeholder="username, @handle, t.me/…"
            aria-label={t('aichat.search', 'Search')}
            className="h-full w-full bg-transparent pr-4 pl-11 text-[15px] text-[var(--tg-text)] outline-none placeholder:text-[var(--tg-secondary)]"
          />
        </label>

        <div className="tg-scroll max-h-[300px] overflow-y-auto">
          {searching && visible.length === 0 ? (
            Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 px-2 py-2">
                <span className="skeleton h-[46px] w-[46px] rounded-full" />
                <span className="flex-1 space-y-2"><span className="skeleton block h-3 w-2/5 rounded-full" /><span className="skeleton block h-3 w-1/3 rounded-full" /></span>
              </div>
            ))
          ) : visible.length > 0 ? visible.map((item) => {
            const name = item.full_name || item.username || item.peer
            const presence = presenceOf(item.presence_status, item.is_online, item.last_seen_at)
            const active = selected?.peer === item.peer
            return (
              <button
                key={item.peer}
                type="button"
                onClick={() => setSelected(item)}
                className={cn('flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left transition-colors', active ? 'bg-[var(--tg-primary)]' : 'hover:bg-[var(--tg-hover)]')}
              >
                <TgAvatar url={item.avatar_url} name={name} size={46} online={presence.kind === 'online'} ring={active ? 'var(--tg-primary)' : 'var(--surface)'} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[15.5px] font-semibold', active ? 'text-white' : 'text-[var(--tg-text)]')}>{name}</span>
                  <span className={cn('block truncate text-[13.5px]', active ? 'text-white/85' : presence.kind === 'online' ? 'text-[var(--tg-primary)]' : 'text-[var(--tg-secondary)]')}>
                    {[item.username ? `@${item.username}` : null, presenceText(presence) || null, item.existing_conversation_id ? t('aichat.existing_chat', 'chat exists') : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {active ? <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[var(--tg-primary)]"><Check size={15} strokeWidth={3} /></span> : null}
              </button>
            )
          }) : (
            <p className="py-8 text-center text-[14px] text-[var(--tg-secondary)]">
              {trimmed ? t('aichat.nothing_found', 'Nothing found') : t('aichat.type_to_search', 'Type a username or a link')}
            </p>
          )}
        </div>

        {selected && !selected.existing_conversation_id ? (
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            placeholder={t('aichat.first_message', 'First message…')}
            className="control-field w-full resize-none rounded-[12px] px-3 py-2 text-[14.5px] leading-relaxed"
          />
        ) : null}
      </div>
    </Dialog>
  )
}
