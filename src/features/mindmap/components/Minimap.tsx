import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Layout } from '../lib/layout'
import type { MindMap } from '../lib/types'
import type { View } from '../lib/view'

const W = 180
const H = 116
const PAD = 8

type Props = {
  map: MindMap
  layout: Layout
  view: View
  size: { w: number; h: number }
  setView: (update: (view: View) => View) => void
}

/** Overview in the corner: all nodes + the visible area; click or drag to move there. */
export function Minimap({ map, layout, view, size, setView }: Props) {
  const viewport = { x: -view.x / view.k, y: -view.y / view.k, w: size.w / view.k, h: size.h / view.k }
  const minX = Math.min(layout.bounds.minX, viewport.x)
  const minY = Math.min(layout.bounds.minY, viewport.y)
  const maxX = Math.max(layout.bounds.maxX, viewport.x + viewport.w)
  const maxY = Math.max(layout.bounds.maxY, viewport.y + viewport.h)
  const scale = Math.min((W - PAD * 2) / Math.max(1, maxX - minX), (H - PAD * 2) / Math.max(1, maxY - minY))
  const offsetX = PAD + ((W - PAD * 2) - (maxX - minX) * scale) / 2
  const offsetY = PAD + ((H - PAD * 2) - (maxY - minY) * scale) / 2
  const sx = (x: number) => offsetX + (x - minX) * scale
  const sy = (y: number) => offsetY + (y - minY) * scale

  function moveTo(event: ReactPointerEvent<SVGSVGElement> | PointerEvent, rect: DOMRect) {
    const worldX = (event.clientX - rect.left - offsetX) / scale + minX
    const worldY = (event.clientY - rect.top - offsetY) / scale + minY
    setView((current) => ({ ...current, x: size.w / 2 - worldX * current.k, y: size.h / 2 - worldY * current.k }))
  }

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    event.stopPropagation()
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    moveTo(event, rect)
    const move = (e: PointerEvent) => moveTo(e, rect)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div data-canvas-ui className="absolute right-3 bottom-3 overflow-hidden max-sm:hidden rounded-[12px] border border-[var(--border)] bg-[var(--card)]/95 shadow-[0_8px_24px_-12px_rgba(14,21,37,0.35)] backdrop-blur">
      <svg width={W} height={H} onPointerDown={onPointerDown} className="block cursor-pointer" role="img" aria-label="Minimap">
        {layout.order.map((id) => {
          const box = layout.boxes.get(id)!
          return (
            <rect
              key={id}
              x={sx(box.x)}
              y={sy(box.y)}
              width={Math.max(2, box.w * scale)}
              height={Math.max(2, box.h * scale)}
              rx={2}
              fill={box.color}
              fillOpacity={id === map.rootId ? 0.9 : 0.45}
            />
          )
        })}
        <rect
          x={sx(viewport.x)}
          y={sy(viewport.y)}
          width={viewport.w * scale}
          height={viewport.h * scale}
          fill="var(--primary)"
          fillOpacity={0.08}
          stroke="var(--primary)"
          strokeWidth={1.5}
          rx={3}
        />
      </svg>
    </div>
  )
}
