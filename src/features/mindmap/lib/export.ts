import { computeLayout, edgePath, nodeFont, type Layout, type NodeBox } from './layout'
import { floatingIds, outline } from './tree'
import type { MindMap, MindNode } from './types'

const PAD = 48

/** Mix a hex colour with white (t = share of the colour). */
export function tint(hex: string, t: number) {
  const value = hex.replace('#', '')
  const channel = (index: number) => parseInt(value.slice(index, index + 2), 16)
  const mix = (c: number) => Math.round(c * t + 255 * (1 - t))
  return `rgb(${mix(channel(0))}, ${mix(channel(2))}, ${mix(channel(4))})`
}

export function nodeRadius(node: MindNode, box: NodeBox) {
  if (node.shape === 'pill') return box.h / 2
  if (node.shape === 'rect') return 4
  return box.depth === 0 ? 16 : 11
}

/** Colours of a node in a light export (the app itself uses CSS colour-mix for both themes). */
function exportStyle(node: MindNode, box: NodeBox) {
  if (node.shape === 'outline') return { fill: '#FFFFFF', stroke: box.color, text: box.depth === 0 ? box.color : '#0E1525', strokeWidth: 2 }
  if (box.floating) return { fill: '#FFFFFF', stroke: tint(box.color, 0.7), text: '#0E1525', strokeWidth: 1.5 }
  if (box.depth === 0) return { fill: box.color, stroke: box.color, text: '#FFFFFF', strokeWidth: 1 }
  return { fill: tint(box.color, 0.13), stroke: tint(box.color, 0.45), text: '#0E1525', strokeWidth: 1 }
}

function lineHeight(box: NodeBox) {
  return box.depth === 0 ? 24 : 20
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!)
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function fileBase(map: MindMap) {
  return (map.title || 'mind-map').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 60) || 'mind-map'
}

function edges(map: MindMap, layout: Layout) {
  const list: Array<{ parent: NodeBox; child: NodeBox }> = []
  for (const id of layout.order) {
    const node = map.nodes[id]
    const parent = node.parentId ? layout.boxes.get(node.parentId) : undefined
    const child = layout.boxes.get(id)
    if (parent && child) list.push({ parent, child })
  }
  return list
}

export function exportSvg(map: MindMap) {
  const layout = computeLayout(map)
  const { minX, minY, maxX, maxY } = layout.bounds
  const width = Math.ceil(maxX - minX + PAD * 2)
  const height = Math.ceil(maxY - minY + PAD * 2)
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Onest, Inter, system-ui, sans-serif">`,
    `<rect width="100%" height="100%" fill="#FFFFFF"/>`,
    `<g transform="translate(${PAD - minX} ${PAD - minY})">`,
  ]
  for (const { parent, child } of edges(map, layout)) {
    parts.push(`<path d="${edgePath(parent, child, map.edgeStyle)}" fill="none" stroke="${child.color}" stroke-opacity="0.75" stroke-width="${child.depth === 1 ? 3 : 2}" stroke-linecap="round"/>`)
  }
  for (const id of layout.order) {
    const box = layout.boxes.get(id)!
    const node = map.nodes[id]
    const style = exportStyle(node, box)
    const weight = box.depth === 0 ? 700 : box.depth === 1 ? 600 : 500
    const size = box.depth === 0 ? 17 : box.depth === 1 ? 14.5 : 13.5
    parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${nodeRadius(node, box)}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}"/>`)
    const top = box.y + box.h / 2 - (box.lines.length * lineHeight(box)) / 2 + lineHeight(box) / 2
    box.lines.forEach((line, index) => {
      parts.push(`<text x="${box.x + box.w / 2}" y="${top + index * lineHeight(box)}" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="${weight}" fill="${style.text}">${escapeXml(line)}</text>`)
    })
  }
  parts.push('</g></svg>')
  download(new Blob([parts.join('')], { type: 'image/svg+xml' }), `${fileBase(map)}.svg`)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/** PNG is drawn with the canvas API, so the app's own (already loaded) font is used. */
export async function exportPng(map: MindMap) {
  const layout = computeLayout(map)
  const { minX, minY, maxX, maxY } = layout.bounds
  const width = Math.ceil(maxX - minX + PAD * 2)
  const height = Math.ceil(maxY - minY + PAD * 2)
  const scale = Math.min(2, 8000 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(scale, scale)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)
  ctx.translate(PAD - minX, PAD - minY)

  for (const { parent, child } of edges(map, layout)) {
    ctx.strokeStyle = child.color
    ctx.globalAlpha = 0.75
    ctx.lineWidth = child.depth === 1 ? 3 : 2
    ctx.lineCap = 'round'
    ctx.stroke(new Path2D(edgePath(parent, child, map.edgeStyle)))
  }
  ctx.globalAlpha = 1
  for (const id of layout.order) {
    const box = layout.boxes.get(id)!
    const node = map.nodes[id]
    const style = exportStyle(node, box)
    roundRect(ctx, box.x, box.y, box.w, box.h, nodeRadius(node, box))
    ctx.fillStyle = style.fill
    ctx.fill()
    ctx.lineWidth = style.strokeWidth
    ctx.strokeStyle = style.stroke
    ctx.stroke()
    ctx.font = nodeFont(box.depth)
    ctx.fillStyle = style.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const top = box.y + box.h / 2 - (box.lines.length * lineHeight(box)) / 2 + lineHeight(box) / 2
    box.lines.forEach((line, index) => ctx.fillText(line, box.x + box.w / 2, top + index * lineHeight(box)))
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (blob) download(blob, `${fileBase(map)}.png`)
}

export function exportMarkdown(map: MindMap) {
  const root = map.nodes[map.rootId]
  const body = root.children.flatMap((child) => outline(map, child))
  const free = floatingIds(map).flatMap((id) => outline(map, id))
  if (free.length) body.push('', '## —', '', ...free)
  const text = [`# ${root.text}`, '', ...(root.note ? [root.note, ''] : []), ...body, ''].join('\n')
  download(new Blob([text], { type: 'text/markdown' }), `${fileBase(map)}.md`)
}

export function exportJson(map: MindMap) {
  download(new Blob([JSON.stringify({ format: 'cims-mindmap', version: 1, ...map }, null, 2)], { type: 'application/json' }), `${fileBase(map)}.mindmap.json`)
}
