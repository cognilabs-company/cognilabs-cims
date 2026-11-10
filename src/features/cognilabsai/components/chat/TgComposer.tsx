import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { SendHorizontal, Smile } from 'lucide-react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { cn } from '../../../../shared/lib/cn'

const EMOJIS = ['😊', '👍', '🙏', '👌', '😂', '❤️', '🔥', '✅', '🎉', '🤝', '😉', '🙂', '😍', '🤔', '👏', '💪', '📞', '📍', '⏰', '📅', '💼', '✍️', '👋', '🚀']

type TgComposerProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  sending: boolean
  disabled?: boolean
}

/** Floating composer: rounded field with an emoji picker and a round send button. */
export function TgComposer({ value, onChange, onSend, sending, disabled }: TgComposerProps) {
  const { t } = useLocale()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const canSend = Boolean(value.trim()) && !sending && !disabled

  useEffect(() => {
    if (!emojiOpen) return
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-emoji-zone]')) setEmojiOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [emojiOpen])

  function insert(emoji: string) {
    const area = textareaRef.current
    const start = area?.selectionStart ?? value.length
    const end = area?.selectionEnd ?? value.length
    const next = value.slice(0, start) + emoji + value.slice(end)
    onChange(next)
    window.requestAnimationFrame(() => {
      area?.focus()
      area?.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  return (
    <div className="flex items-end gap-2">
      <div data-emoji-zone className="tg-composer relative flex min-h-[54px] flex-1 items-end rounded-[16px] rounded-br-none pr-3">
        <button
          type="button"
          onClick={() => setEmojiOpen((open) => !open)}
          aria-label={t('aichat.emoji', 'Emoji')}
          aria-expanded={emojiOpen}
          className={cn('grid h-[54px] w-[50px] shrink-0 place-items-center transition-colors', emojiOpen ? 'text-[var(--tg-primary)]' : 'text-[var(--tg-secondary)] hover:text-[var(--tg-primary)]')}
        >
          <Smile size={24} />
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              if (canSend) onSend()
            }
          }}
          disabled={disabled}
          rows={1}
          placeholder={t('aichat.message_placeholder', 'Message')}
          aria-label={t('aichat.message_placeholder', 'Message')}
          className="tg-scroll max-h-[220px] min-h-[54px] flex-1 resize-none bg-transparent py-[15px] text-[16px] leading-[1.4] text-[var(--tg-text)] outline-none placeholder:text-[var(--tg-secondary)] disabled:opacity-50"
          style={{ fieldSizing: 'content' } as CSSProperties}
        />
        {/* tail of the field, like Telegram */}
        <svg viewBox="0 0 9 17" className="absolute -right-[8.6px] bottom-0 h-[17px] w-[9px]" aria-hidden="true">
          <path d="M0 0v17h6.6c1.5 0 2.1-1.2 1.1-2.3C3.8 10.7.6 6.3 0 0Z" fill="var(--tg-composer)" />
        </svg>

        {emojiOpen ? (
          <div className="tg-menu absolute bottom-[62px] left-0 grid w-[296px] grid-cols-8 gap-0.5 rounded-[14px] p-2">
            {EMOJIS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => insert(emoji)} className="grid h-9 w-9 place-items-center rounded-[8px] text-[22px] transition-transform hover:scale-110 hover:bg-[var(--tg-hover)]">
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        aria-label={t('aichat.send', 'Send')}
        title={t('aichat.send', 'Send')}
        className={cn(
          'tg-send grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full transition-[transform,color,background-color] duration-200',
          canSend ? 'text-[var(--tg-primary)] hover:scale-105 active:scale-95' : 'cursor-default text-[var(--tg-secondary)]',
        )}
      >
        <SendHorizontal size={24} className={cn('transition-transform duration-200', canSend && 'translate-x-[1px]')} />
      </button>
    </div>
  )
}
