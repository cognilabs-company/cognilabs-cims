import { useEffect, useRef, useState } from 'react'
import { Music, RotateCcw, RotateCw } from 'lucide-react'
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
import { IconButton } from '@/shared/ui/icon-button'
import { Progress } from '@/shared/ui/progress'

interface AudioPlayerCardProps {
  src: string
  name: string
}

const seekBtnClass =
  'rounded-full text-[var(--muted-strong)] transition-[color,background-color,transform] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)] active:scale-95'

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
    <div className="rounded-[18px] bg-[var(--accent-soft)] p-[14px]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-[14px]">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--blue-dim)]">
          <Music className="h-4 w-4 text-[var(--blue-text)]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-snug font-semibold text-[var(--foreground)]" title={name}>
            {name}
          </p>
          <p className="text-[12.5px] text-[var(--muted)]">Audio recording</p>
        </div>
      </div>

      {/* Player */}
      <div className="rounded-[14px] bg-[var(--surface)] px-2.5 py-1.5">
        {isLoading ? (
          <div className="flex items-center gap-3 px-1 py-3">
            <Progress
              value={Math.max(4, loadProgress)}
              tone="blue"
              size="xs"
              className={cn('flex-1', loadProgress === 0 && 'animate-pulse')}
            />
            <span className="min-w-10 text-right text-[11.5px] tabular-nums text-[var(--muted)]">
              {loadProgress > 0 ? `${loadProgress}%` : '…'}
            </span>
          </div>
        ) : loadError ? (
          <p className="px-1 py-3 text-sm font-medium text-[var(--danger-text)]">{loadError}</p>
        ) : (
          <AudioPlayer>
            <AudioPlayerElement src={blobUrl!} ref={audioRef} preload="auto" />
            <AudioPlayerControlBar>
              <AudioPlayerPlayButton />

              <IconButton
                label="10 soniya orqaga"
                title="-10s"
                className={seekBtnClass}
                onClick={() => seek(-10)}
              >
                <span className="relative flex items-center justify-center">
                  <RotateCcw className="h-5 w-5" strokeWidth={1.8} />
                  <span className="absolute text-[8px] font-bold leading-none" style={{ marginTop: 1 }}>10</span>
                </span>
              </IconButton>

              <IconButton
                label="10 soniya oldinga"
                title="+10s"
                className={seekBtnClass}
                onClick={() => seek(10)}
              >
                <span className="relative flex items-center justify-center">
                  <RotateCw className="h-5 w-5" strokeWidth={1.8} />
                  <span className="absolute text-[8px] font-bold leading-none" style={{ marginTop: 1 }}>10</span>
                </span>
              </IconButton>

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
