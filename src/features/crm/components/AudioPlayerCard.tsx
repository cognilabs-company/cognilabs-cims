import { useEffect, useRef, useState } from 'react'
import { ArrowClockwiseIcon, ArrowCounterClockwiseIcon, MusicNotesIcon } from '@phosphor-icons/react'
import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerDurationDisplay,
  AudioPlayerElement,
  AudioPlayerMuteButton,
  AudioPlayerPlayButton,
  AudioPlayerTimeDisplay,
  AudioPlayerTimeRange,
  AudioPlayerVolumeRange,
} from '@/components/ai-elements/audio-player'
import { cn } from '@/shared/lib/cn'
import { getAccessToken } from '@/shared/lib/session'

interface AudioPlayerCardProps {
  src: string
  name: string
}

const seekBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-(--muted-strong) transition hover:bg-(--muted-surface) hover:text-(--foreground) active:scale-95 disabled:opacity-40 disabled:pointer-events-none'

export function AudioPlayerCard({ src, name }: AudioPlayerCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loadProgress, setLoadProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    const controller = new AbortController()

    setIsLoading(true)
    setLoadProgress(0)
    setBlobUrl(null)
    setLoadError(null)

    const token = getAccessToken()
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

    fetch(src, { signal: controller.signal, headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        const total = Number(res.headers.get('content-length') || 0)
        const reader = res.body!.getReader()
        const chunks: Uint8Array<ArrayBuffer>[] = []
        let loaded = 0

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (cancelled) return
          chunks.push(value)
          loaded += value.byteLength
          if (total > 0) setLoadProgress(Math.round((loaded / total) * 100))
        }

        if (!cancelled) {
          objectUrl = URL.createObjectURL(new Blob(chunks))
          setBlobUrl(objectUrl)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled && err.name !== 'AbortError') {
          setLoadError("Audio yuklab bo'lmadi")
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  function seek(delta: number) {
    const audio = audioRef.current
    if (!audio || !isFinite(audio.duration)) return
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + delta))
  }

  return (
    <div className="rounded-2xl bg-(--surface-elevated) ring-1 ring-white/8">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-(--border) px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--muted-surface)">
          <MusicNotesIcon className="h-4 w-4 text-(--muted-strong)" weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-snug text-(--foreground)" title={name}>
            {name}
          </p>
          <p className="text-[11px] text-(--muted)">Audio recording</p>
        </div>
      </div>

      {/* Player */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex items-center gap-3 py-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--muted-surface)">
              <div
                className={cn(
                  'h-full rounded-full bg-(--foreground) transition-all duration-200',
                  loadProgress === 0 && 'animate-pulse',
                )}
                style={{ width: `${Math.max(4, loadProgress)}%` }}
              />
            </div>
            <span className="min-w-10 text-right text-[11px] tabular-nums text-(--muted)">
              {loadProgress > 0 ? `${loadProgress}%` : '…'}
            </span>
          </div>
        ) : loadError ? (
          <p className="py-2 text-[13px] text-(--danger-text)">{loadError}</p>
        ) : (
          <AudioPlayer>
            <AudioPlayerElement src={blobUrl!} ref={audioRef} preload="auto" />
            <AudioPlayerControlBar>
              <AudioPlayerPlayButton />

              <button
                type="button"
                onClick={() => seek(-10)}
                className={seekBtnClass}
                aria-label="10 soniya orqaga"
                title="-10s"
              >
                <span className="relative flex items-center justify-center">
                  <ArrowCounterClockwiseIcon className="h-5 w-5" weight="bold" />
                  <span className="absolute text-[8px] font-bold leading-none" style={{ marginTop: 1 }}>10</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => seek(10)}
                className={seekBtnClass}
                aria-label="10 soniya oldinga"
                title="+10s"
              >
                <span className="relative flex items-center justify-center">
                  <ArrowClockwiseIcon className="h-5 w-5" weight="bold" />
                  <span className="absolute text-[8px] font-bold leading-none" style={{ marginTop: 1 }}>10</span>
                </span>
              </button>

              <AudioPlayerTimeDisplay />
              <AudioPlayerTimeRange />
              <AudioPlayerDurationDisplay />
              <AudioPlayerMuteButton />
              <AudioPlayerVolumeRange />
            </AudioPlayerControlBar>
          </AudioPlayer>
        )}
      </div>
    </div>
  )
}
