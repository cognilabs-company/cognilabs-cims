import { Alert } from '../../../shared/ui/alert'
import type { Tone } from '../../../shared/ui/tone'

type AuthFeedbackProps = {
  tone?: 'error' | 'success' | 'info'
  message?: string | null
}

const alertTones: Record<NonNullable<AuthFeedbackProps['tone']>, Tone> = {
  error: 'danger',
  success: 'success',
  info: 'blue',
}

export function AuthFeedback({ tone = 'info', message }: AuthFeedbackProps) {
  if (!message) {
    return null
  }

  return (
    <Alert tone={alertTones[tone]} className="p-3.5">
      {message}
    </Alert>
  )
}
