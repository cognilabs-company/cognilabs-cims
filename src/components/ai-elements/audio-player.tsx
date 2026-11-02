import {
  MediaControlBar,
  MediaController,
  MediaDurationDisplay,
  MediaMuteButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from 'media-chrome/react'
import type { ComponentProps, CSSProperties } from 'react'
import { cn } from '@/shared/lib/cn'

export type AudioPlayerProps = ComponentProps<typeof MediaController> & { audio?: boolean }

export const AudioPlayer = ({ children, style, className, ...props }: AudioPlayerProps) => (
  <MediaController
    audio
    data-slot="audio-player"
    className={cn('w-full', className)}
    style={
      {
        '--media-background-color': 'transparent',
        '--media-button-icon-height': '1.1rem',
        '--media-button-icon-width': '1.1rem',
        '--media-control-background': 'transparent',
        '--media-control-hover-background': 'var(--input-surface)',
        '--media-control-padding': '6px',
        '--media-font-size': '11px',
        '--media-icon-color': 'currentColor',
        '--media-primary-color': 'var(--foreground)',
        '--media-range-bar-color': 'var(--primary)',
        '--media-range-thumb-background': 'var(--primary)',
        '--media-range-track-background': 'var(--input-surface)',
        '--media-range-track-border-radius': '999px',
        '--media-range-track-height': '6px',
        '--media-text-color': 'var(--muted-strong)',
        '--media-preview-time-background': 'var(--accent-soft)',
        '--media-preview-time-border-radius': '9px',
        '--media-preview-time-text-shadow': 'none',
        '--media-tooltip-background': 'var(--accent-soft)',
        '--media-tooltip-border': '1px solid var(--border-hover)',
        '--media-tooltip-border-radius': '9px',
        '--media-tooltip-filter': 'none',
        '--media-tooltip-arrow-display': 'none',
        ...style,
      } as CSSProperties
    }
    {...props}
  >
    {children}
  </MediaController>
)

export type AudioPlayerElementProps = ComponentProps<'audio'> & { src: string }

export const AudioPlayerElement = ({ src, ...props }: AudioPlayerElementProps) => (
  <audio data-slot="audio-player-element" slot="media" src={src} {...props} />
)

export type AudioPlayerControlBarProps = ComponentProps<typeof MediaControlBar>

export const AudioPlayerControlBar = ({ children, className, ...props }: AudioPlayerControlBarProps) => (
  <MediaControlBar
    data-slot="audio-player-control-bar"
    className={cn('flex items-center gap-1', className)}
    {...props}
  >
    {children}
  </MediaControlBar>
)

export type AudioPlayerPlayButtonProps = ComponentProps<typeof MediaPlayButton>

export const AudioPlayerPlayButton = ({ className, ...props }: AudioPlayerPlayButtonProps) => (
  <MediaPlayButton
    data-slot="audio-player-play-button"
    className={cn(
      'flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
      className,
    )}
    {...props}
  />
)

export type AudioPlayerSeekBackwardButtonProps = ComponentProps<typeof MediaSeekBackwardButton> & { seekOffset?: number }

export const AudioPlayerSeekBackwardButton = ({
  seekOffset = 10,
  className,
  ...props
}: AudioPlayerSeekBackwardButtonProps) => (
  <MediaSeekBackwardButton
    data-slot="audio-player-seek-backward-button"
    seekOffset={seekOffset}
    className={cn(
      'flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
      className,
    )}
    {...props}
  />
)

export type AudioPlayerSeekForwardButtonProps = ComponentProps<typeof MediaSeekForwardButton> & { seekOffset?: number }

export const AudioPlayerSeekForwardButton = ({
  seekOffset = 10,
  className,
  ...props
}: AudioPlayerSeekForwardButtonProps) => (
  <MediaSeekForwardButton
    data-slot="audio-player-seek-forward-button"
    seekOffset={seekOffset}
    className={cn(
      'flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
      className,
    )}
    {...props}
  />
)

export type AudioPlayerTimeDisplayProps = ComponentProps<typeof MediaTimeDisplay>

export const AudioPlayerTimeDisplay = ({ className, ...props }: AudioPlayerTimeDisplayProps) => (
  <MediaTimeDisplay
    data-slot="audio-player-time-display"
    className={cn('shrink-0 tabular-nums', className)}
    {...props}
  />
)

export type AudioPlayerTimeRangeProps = ComponentProps<typeof MediaTimeRange>

export const AudioPlayerTimeRange = ({ className, ...props }: AudioPlayerTimeRangeProps) => (
  <MediaTimeRange
    data-slot="audio-player-time-range"
    className={cn('flex-1', className)}
    {...props}
  />
)

export type AudioPlayerDurationDisplayProps = ComponentProps<typeof MediaDurationDisplay>

export const AudioPlayerDurationDisplay = ({ className, ...props }: AudioPlayerDurationDisplayProps) => (
  <MediaDurationDisplay
    data-slot="audio-player-duration-display"
    className={cn('shrink-0 tabular-nums', className)}
    {...props}
  />
)

export type AudioPlayerMuteButtonProps = ComponentProps<typeof MediaMuteButton>

export const AudioPlayerMuteButton = ({ className, ...props }: AudioPlayerMuteButtonProps) => (
  <MediaMuteButton
    data-slot="audio-player-mute-button"
    className={cn(
      'flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-strong)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
      className,
    )}
    {...props}
  />
)

export type AudioPlayerVolumeRangeProps = ComponentProps<typeof MediaVolumeRange>

export const AudioPlayerVolumeRange = ({ className, ...props }: AudioPlayerVolumeRangeProps) => (
  <MediaVolumeRange
    data-slot="audio-player-volume-range"
    className={cn('w-24', className)}
    {...props}
  />
)
