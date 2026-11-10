import { XIcon } from '@phosphor-icons/react'
import { IconButton } from '@/shared/ui/icon-button'
import { AudioPlayerCard } from './AudioPlayerCard'

interface AudioPlayerModalProps {
  src: string
  name: string
  onClose: () => void
}

export function AudioPlayerModal({ src, name, onClose }: AudioPlayerModalProps) {
  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="dialog-backdrop absolute inset-0" aria-hidden="true" />

      <div
        className="relative z-10 flex w-full max-w-md flex-col gap-2.5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Audio player"
      >
        {/* Close button overlay */}
        <div className="flex justify-end">
          <IconButton
            label="Close player"
            size="sm"
            className="rounded-full bg-[var(--surface)] shadow-[var(--elev-md)]"
            onClick={onClose}
          >
            <XIcon className="h-4 w-4" weight="bold" />
          </IconButton>
        </div>

        <div className="modal-pop rounded-[20px] bg-[var(--card)] p-4 shadow-[var(--elev-xl)] ring-1 ring-[var(--border)]">
          <AudioPlayerCard src={src} name={name} />
        </div>
      </div>
    </div>
  )
}
