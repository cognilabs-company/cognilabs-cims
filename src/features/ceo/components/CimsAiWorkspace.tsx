import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCimsAi } from '../hooks/useCimsAi'
import {
  cimsAiLoadingStages,
  cimsAiQuickPrompts,
  type CimsAiLoadingStage,
  type CimsAiChatMessage,
} from '../lib/cimsAi'
import { cn } from '../../../shared/lib/cn'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Textarea } from '../../../shared/ui/textarea'
import { NavGlyph } from '../../../widgets/navigation/NavGlyph'

type CimsAiWorkspaceProps = {
  mode: 'page' | 'dialog'
}

const promptTileClassName =
  'rounded-[14px] bg-[var(--muted-surface)] px-4 py-3.5 text-left text-sm leading-6 ' +
  'text-[var(--muted-strong)] transition-colors hover:bg-[var(--blue-dim)] hover:text-[var(--foreground)]'

const bubbleShellClassName = 'rounded-[18px] px-[18px] py-4 text-[var(--foreground)]'

const bubbleLabelClassName = 'text-[11px] font-semibold text-[var(--muted-strong)]'

function formatMessageTime(createdAt: number) {
  return new Intl.DateTimeFormat(getIntlLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(createdAt))
}

function AiGlyph({
  className,
  glyphClassName,
}: {
  className?: string
  glyphClassName?: string
}) {
  return (
    <div className={cn(
      'grid shrink-0 place-items-center rounded-[11px] bg-[var(--blue-dim)] text-[var(--primary)]',
      className,
    )}>
      <NavGlyph name="ai" className={cn('h-5 w-5 text-current', glyphClassName)} />
    </div>
  )
}

function ConversationBubble({ message }: { message: CimsAiChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <article
      className={cn(
        'group flex w-full items-start gap-3',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {!isUser ? (
        <AiGlyph className="mt-1 h-9 w-9" />
      ) : null}

      <div
        data-i18n-skip="true"
        className={cn(
          'min-w-0 w-fit max-w-[min(100%,720px)]',
          bubbleShellClassName,
          isUser
            ? 'ml-auto bg-[var(--blue-dim)]'
            : 'bg-[var(--muted-surface)]',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <p className={bubbleLabelClassName}>
            {isUser ? translateCurrentLiteral('You') : 'CIMS AI'}
          </p>
          <span className="text-[11px] tabular-nums text-[var(--caption)]">{formatMessageTime(message.createdAt)}</span>
        </div>
        <div className="mt-2.5 whitespace-pre-wrap break-words text-sm leading-[1.7]">
          {message.content}
        </div>
      </div>
    </article>
  )
}

function LoadingBubble({ stage }: { stage: CimsAiLoadingStage }) {
  const currentStage = cimsAiLoadingStages.find((item) => item.key === stage) ?? cimsAiLoadingStages[0]

  return (
    <article className="group flex w-full justify-start gap-3" data-i18n-skip="true">
      <AiGlyph className="mt-1 h-9 w-9" />

      <div className={cn('max-w-[min(100%,780px)] bg-[var(--muted-surface)]', bubbleShellClassName)}>
        <div className="flex items-center justify-between gap-3">
          <p className={bubbleLabelClassName}>
            CIMS AI
          </p>
          <span className="text-[11px] font-semibold text-[var(--primary)]">{translateCurrentLiteral('Thinking')}</span>
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)] [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)] opacity-70 [animation-delay:180ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)] opacity-50 [animation-delay:360ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)] opacity-30 [animation-delay:540ms]" />
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">{translateCurrentLiteral(currentStage.label)}</p>
        </div>
      </div>
    </article>
  )
}

function EmptyConversation({
  mode,
  onPrompt,
}: {
  mode: 'page' | 'dialog'
  onPrompt: (prompt: string) => void
}) {
  return (
    <div className={cn(
      'flex h-full flex-col justify-center',
      mode === 'page' ? 'px-2 py-8' : 'px-1 py-2',
    )}>
      <div className="mx-auto max-w-3xl text-center">
        <AiGlyph
          className="mx-auto h-14 w-14 rounded-[18px] bg-[var(--surface-inverse)] text-white"
          glyphClassName="h-7 w-7"
        />
        <h2 className="mt-5 text-[22px] font-bold tracking-[-0.03em] text-[var(--foreground)]">
          {translateCurrentLiteral('Ask CIMS AI from anywhere')}
        </h2>
        <p className="mx-auto mt-2.5 max-w-md text-sm leading-6 text-[var(--muted)]">
          {translateCurrentLiteral('Use it for team updates, CRM signals, payment priorities, and fast executive summaries.')}
        </p>
      </div>

      <div className={cn(
        'mx-auto mt-[18px] grid w-full max-w-3xl gap-2.5',
        mode === 'page' ? 'md:grid-cols-2' : 'grid-cols-1',
      )}>
        {cimsAiQuickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPrompt(prompt)}
            className={promptTileClassName}
          >
            {translateCurrentLiteral(prompt)}
          </button>
        ))}
      </div>
    </div>
  )
}

function Composer({
  mode,
}: {
  mode: 'page' | 'dialog'
}) {
  const { draft, setDraft, submitQuestion, isSubmitting } = useCimsAi()

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void submitQuestion()
    }
  }

  return (
    <div className={cn(
      'shrink-0',
      mode === 'page' ? 'px-[22px] pb-[22px] pt-[18px]' : 'px-[18px] pb-[18px] pt-[18px]',
    )}>
      <div className="rounded-[18px] bg-[var(--muted-surface)] p-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={mode === 'page' ? 5 : 4}
          placeholder={translateCurrentLiteral('Write a question for CIMS AI. Ctrl/Cmd + Enter to send.')}
          className="min-h-0 resize-none bg-transparent px-2 py-1.5 text-sm leading-7 hover:bg-transparent focus:border-transparent focus:bg-transparent focus:shadow-none"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-2 pb-0.5">
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--caption)]">
            <span>{translateCurrentLiteral('Frontend chat history')}</span>
            <span className="h-1 w-1 rounded-full bg-[var(--border-hover)]" />
            <span>{translateCurrentLiteral('Shared across pages')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft('')}
              disabled={!draft.trim() || isSubmitting}
            >
              {translateCurrentLiteral('Reset')}
            </Button>
            <Button size="sm" onClick={() => void submitQuestion()} loading={isSubmitting}>
              {translateCurrentLiteral('Send')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CimsAiWorkspace({ mode }: CimsAiWorkspaceProps) {
  const { history, clearConversation, fillPrompt, isSubmitting, loadingStage } = useCimsAi()
  const streamRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = streamRef.current

    if (!element) {
      return
    }

    element.scrollTop = element.scrollHeight
  }, [history])

  if (mode === 'dialog') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-[18px] py-[18px]">
          <div className="min-w-0">
            <p className="ui-eyebrow text-[var(--primary)]">CIMS AI</p>
            <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">{translateCurrentLiteral('Quick assistant')}</h2>
          </div>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/ceo/ai">{translateCurrentLiteral('Open page')}</Link>
          </Button>
        </div>

        <div ref={streamRef} data-chat-stream="true" className="min-h-0 flex-1 overflow-y-auto px-[18px] py-[18px]">
          {history.length > 0 ? (
            <div className="space-y-[18px]">
              {history.map((message) => (
                <ConversationBubble key={message.id} message={message} />
              ))}
              {isSubmitting ? <LoadingBubble stage={loadingStage} /> : null}
            </div>
          ) : (
            <div className="space-y-[18px]">
              <EmptyConversation mode={mode} onPrompt={fillPrompt} />
              {isSubmitting ? <LoadingBubble stage={loadingStage} /> : null}
            </div>
          )}
        </div>

        <Composer mode={mode} />
      </div>
    )
  }

  return (
    <section className="grid min-h-[var(--page-h)] gap-[18px] xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-[18px] xl:sticky xl:top-6 xl:self-start">
        <div className="px-1">
          <p className="ui-eyebrow text-[var(--primary)]">CIMS AI</p>
          <h1 className="mt-2.5 text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
            {translateCurrentLiteral('Executive copilot for live operations')}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">
            {translateCurrentLiteral('Ask about updates, CRM movement, workload pressure, and management decisions without leaving your current workflow.')}
          </p>
        </div>

        <Card noPadding className="overflow-hidden">
          <div className="px-[22px] pt-[22px]">
            <p className="ui-eyebrow text-[var(--primary)]">{translateCurrentLiteral('Prompt library')}</p>
            <p className="mt-2 text-[13px] text-[var(--muted)]">{translateCurrentLiteral('Fast starts for CEO-level questions.')}</p>
          </div>
          <div className="grid gap-2.5 p-[22px] pt-4">
            {cimsAiQuickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => fillPrompt(prompt)}
                className={promptTileClassName}
              >
                {translateCurrentLiteral(prompt)}
              </button>
            ))}
          </div>
        </Card>

      </aside>

      <div className="relative flex min-h-[78vh] min-w-0 flex-col overflow-hidden rounded-[24px] bg-[var(--card)]">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] px-[22px] py-[18px]">
          <div className="min-w-0">
            <p className="ui-eyebrow text-[var(--primary)]">{translateCurrentLiteral('Shared conversation')}</p>
            <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{translateCurrentLiteral('Chat with CIMS AI')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="blue">{history.length} {translateCurrentLiteral('turns')}</Badge>
            <Button variant="secondary" size="sm" onClick={clearConversation} disabled={history.length === 0}>
              {translateCurrentLiteral('Clear chat')}
            </Button>
          </div>
        </div>

        <div ref={streamRef} data-chat-stream="true" className="relative min-h-0 flex-1 overflow-y-auto px-[22px] py-[22px]">
          {history.length > 0 ? (
            <div className="space-y-[18px]">
              {history.map((message) => (
                <ConversationBubble key={message.id} message={message} />
              ))}
              {isSubmitting ? <LoadingBubble stage={loadingStage} /> : null}
            </div>
          ) : (
            <div className="space-y-[18px]">
              <EmptyConversation mode={mode} onPrompt={fillPrompt} />
              {isSubmitting ? <LoadingBubble stage={loadingStage} /> : null}
            </div>
          )}
        </div>

        <Composer mode={mode} />
      </div>
    </section>
  )
}
