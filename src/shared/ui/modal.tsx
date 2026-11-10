import type { ComponentProps } from 'react'
import { Dialog } from './dialog'

type ModalProps = ComponentProps<typeof Dialog>

/** Alias of Dialog kept for existing callers. */
export function Modal(props: ModalProps) {
  return <Dialog {...props} />
}
