import { useId } from 'react'
import { cn } from '../../lib/cn'

type SparklineProps = {
  points: number[]
  color?: string
  height?: number
  className?: string
}

function buildPath(points: number[], width: number, height: number) {
  if (points.length < 2) {
    return { line: '', area: '' }
  }

  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const step = width / (points.length - 1)

  const coords = points.map((value, index) => {
    const x = index * step
    const y = height - 10 - ((value - min) / span) * (height - 22)
    return [x, y] as const
  })

  let line = `M${coords[0][0]} ${coords[0][1].toFixed(2)}`
  for (let i = 1; i < coords.length; i += 1) {
    const [prevX, prevY] = coords[i - 1]
    const [x, y] = coords[i]
    const cx = (prevX + x) / 2
    line += ` C${cx.toFixed(2)} ${prevY.toFixed(2)} ${cx.toFixed(2)} ${y.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`
  }

  const area = `${line} L${width} ${height} L0 ${height} Z`

  return { line, area }
}

export function Sparkline({ points, color = '#2B59FF', height = 62, className }: SparklineProps) {
  const gradientId = useId()
  const width = 240
  const viewHeight = 64
  const { line, area } = buildPath(points, width, viewHeight)

  if (!line) {
    return null
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${viewHeight}`}
      preserveAspectRatio="none"
      className={cn('block w-[calc(100%+44px)] -mx-[22px] mt-auto mb-0', className)}
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" />
    </svg>
  )
}
