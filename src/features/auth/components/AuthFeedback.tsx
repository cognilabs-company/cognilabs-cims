import { cn } from '../../../shared/lib/cn'

type AuthFeedbackProps = {
  tone?: 'error' | 'success' | 'info'
  message?: string | null
}

const toneClasses = {
  error: 'border-red-500/20 bg-red-500/10 text-red-300',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  info: 'border-white/10 bg-white/5 text-[var(--muted-strong)]',
}

export function AuthFeedback({ tone = 'info', message }: AuthFeedbackProps) {
  if (!message) {
    return null
  }

  return (
    <div className={cn('rounded-md border px-3 py-2.5 text-xs', toneClasses[tone])}>
      {message}
    </div>
  )
}
