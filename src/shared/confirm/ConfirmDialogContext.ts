import { createContext } from 'react'

type ConfirmOptions = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

export type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

export type { ConfirmOptions }

export const ConfirmDialogContext = createContext<ConfirmContextValue | null>(null)
