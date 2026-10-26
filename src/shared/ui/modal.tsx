import type { ReactNode } from 'react'
import { Dialog } from './dialog'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  footer?: ReactNode
  children?: ReactNode
  size?: 'md' | 'lg' | 'xl'
}

export function Modal(props: ModalProps) {
  return <Dialog {...props} />
}
