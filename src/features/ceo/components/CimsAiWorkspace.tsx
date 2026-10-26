import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCimsAi } from '../context/CimsAiContext'
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

function formatMessageTime(createdAt: number) {
  return new Intl.DateTimeFormat(getIntlLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(createdAt))
}

function AiGlyph({ className }: { className?: string }) {
  return (
    <div className={cn(
      'grid place-items-center rounded-xl border border-[var(--blue-border)] bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.26),rgba(15,23,42,0.92))] text-white shadow-[0_16px_48px_rgba(37,99,235,0.18)]',
      className,
    )}>
      <NavGlyph name="ai" className="h-5 w-5" />
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
        <AiGlyph className="mt-1 h-9 w-9 shrink-0 rounded-xl" />
      ) : null}

      <div
        data-i18n-skip="true"
        className={cn(
          'min-w-0 w-fit max-w-[min(100%,720px)] rounded-xl border px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
          isUser
            ? 'ml-auto border-[var(--blue-border)] bg-[linear-gradient(180deg,var(--blue-soft),var(--blue-dim))] text-[var(--foreground)]'
            : 'border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-elevated),var(--surface))] text-[var(--foreground)]',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            {isUser ? translateCurrentLiteral('You') : 'CIMS AI'}
          </p>
          <span className="text-[10px] text-[var(--muted)]">{formatMessageTime(message.createdAt)}</span>
        </div>
        <div className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-7">
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
      <AiGlyph className="mt-1 h-9 w-9 shrink-0 rounded-xl" />

      <div className="max-w-[min(100%,780px)] rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-elevated),var(--surface))] px-5 py-4 text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            CIMS AI
          </p>
          <span className="text-[10px] text-[var(--blue-text)]">{translateCurrentLiteral('Thinking')}</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-300 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-300/80 [animation-delay:180ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-300/60 [animation-delay:360ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-300/40 [animation-delay:540ms]" />
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
      mode === 'page' ? 'px-8 py-10 lg:px-10' : 'px-1 py-1',
    )}>
      <div className="mx-auto max-w-3xl text-center">
        <AiGlyph className="mx-auto h-14 w-14" />
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {translateCurrentLiteral('Ask CIMS AI from anywhere')}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          {translateCurrentLiteral('Use it for team updates, CRM signals, payment priorities, and fast executive summaries.')}
        </p>
      </div>

      <div className={cn(
        'mx-auto mt-8 grid w-full max-w-4xl gap-3',
        mode === 'page' ? 'md:grid-cols-2' : 'grid-cols-1',
      )}>
        {cimsAiQuickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-4 text-left text-sm leading-6 text-[var(--foreground)] transition hover:border-[var(--border-hover)] hover:bg-[var(--accent-soft)]"
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
      'border-t border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-elevated),var(--surface))]',
      mode === 'page' ? 'px-6 pb-6 pt-5 lg:px-8' : 'px-4 pb-4 pt-4',
    )}>
      <div className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-elevated),var(--surface))] p-3 shadow-[var(--shadow-xl)]">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={mode === 'page' ? 5 : 4}
          placeholder={translateCurrentLiteral('Write a question for CIMS AI. Ctrl/Cmd + Enter to send.')}
          className="min-h-0 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-7 shadow-none hover:bg-transparent focus:bg-transparent focus:shadow-none"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-2 pb-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
            <span>{translateCurrentLiteral('Frontend chat history')}</span>
            <span className="h-1 w-1 rounded-full bg-[var(--border)]" />
            <span>{translateCurrentLiteral('Shared across pages')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setDraft('')}
              disabled={!draft.trim() || isSubmitting}
            >
              {translateCurrentLiteral('Reset')}
            </Button>
            <Button onClick={() => void submitQuestion()} loading={isSubmitting}>
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
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--blue-text)]">CIMS AI</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">{translateCurrentLiteral('Quick assistant')}</h2>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/ceo/ai">{translateCurrentLiteral('Open page')}</Link>
          </Button>
        </div>

        <div ref={streamRef} data-chat-stream="true" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {history.length > 0 ? (
            <div className="space-y-4">
              {history.map((message) => (
                <ConversationBubble key={message.id} message={message} />
              ))}
              {isSubmitting ? <LoadingBubble stage={loadingStage} /> : null}
            </div>
          ) : (
            <div className="space-y-4">
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
    <section className="grid min-h-[calc(100vh-9rem)] gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div className="px-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--blue-text)]">CIMS AI</p>
          <h1 className="mt-3 text-[2.35rem] font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            {translateCurrentLiteral('Executive copilot for live operations')}
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-7 text-[var(--muted)]">
            {translateCurrentLiteral('Ask about updates, CRM movement, workload pressure, and management decisions without leaving your current workflow.')}
          </p>
        </div>

        <Card variant="glass" className="overflow-hidden rounded-xl p-0">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--blue-text)]">{translateCurrentLiteral('Prompt library')}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{translateCurrentLiteral('Fast starts for CEO-level questions.')}</p>
          </div>
          <div className="grid gap-3 px-5 py-5">
            {cimsAiQuickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => fillPrompt(prompt)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-left text-sm leading-6 text-[var(--foreground)] transition hover:border-[var(--border-hover)] hover:bg-[var(--accent-soft)]"
              >
                {translateCurrentLiteral(prompt)}
              </button>
            ))}
          </div>
        </Card>

      </aside>

      <div className="relative flex min-h-[78vh] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-elevated),var(--surface))] shadow-[var(--shadow-xl)]">
        <div className="relative flex items-center justify-between gap-4 border-b border-[var(--border)] px-6 py-5 lg:px-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--blue-text)]">{translateCurrentLiteral('Shared conversation')}</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">{translateCurrentLiteral('Chat with CIMS AI')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{history.length} {translateCurrentLiteral('turns')}</Badge>
            <Button variant="secondary" onClick={clearConversation} disabled={history.length === 0}>
              {translateCurrentLiteral('Clear chat')}
            </Button>
          </div>
        </div>

        <div ref={streamRef} data-chat-stream="true" className="relative min-h-0 flex-1 overflow-y-auto px-6 py-6 lg:px-8">
          {history.length > 0 ? (
            <div className="space-y-4">
              {history.map((message) => (
                <ConversationBubble key={message.id} message={message} />
              ))}
              {isSubmitting ? <LoadingBubble stage={loadingStage} /> : null}
            </div>
          ) : (
            <div className="space-y-4">
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
