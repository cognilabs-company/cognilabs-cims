import { XIcon } from '@phosphor-icons/react'
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      <div
        className="relative z-10 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Audio player"
      >
        {/* Close button overlay */}
        <div className="absolute right-3 top-3 z-10">
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-(--muted) transition hover:bg-(--muted-surface) hover:text-(--foreground)"
            aria-label="Close player"
          >
            <XIcon className="h-4 w-4" weight="bold" />
          </button>
        </div>

        <AudioPlayerCard src={src} name={name} />
      </div>
    </div>
  )
}
