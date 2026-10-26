import { createContext } from 'react'

type ToastTone = 'success' | 'error' | 'info'

export type ToastInput = {
  title: string
  description?: string
  tone?: ToastTone
}

export type ToastContextValue = {
  showToast: (input: ToastInput) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
