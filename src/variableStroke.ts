import type { Point } from './types'

export interface WidthPoint { t: number; width: number }

function geometry(data: string) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', data)
  const length = path.getTotalLength()
  return { path, length }
}

export function widthAt(points: WidthPoint[], t: number, fallback: number) {
  const sorted = [...points].sort((a, b) => a.t - b.t)
  const stops = [...(sorted[0]?.t === 0 ? [] : [{ t: 0, width: fallback }]), ...sorted, ...(sorted[sorted.length - 1]?.t === 1 ? [] : [{ t: 1, width: fallback }])]
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].t) {
      const a = stops[i - 1], b = stops[i]
      const f = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t)
      return a.width + (b.width - a.width) * f
    }
  }
  return fallback
}

export function nearestStrokePoint(data: string, point: Point): { t: number; point: Point } | null {
  try {
    const { path, length } = geometry(data)
    if (!length) return null
    let bestT = 0, bestDistance = Infinity
    for (let i = 0; i <= 250; i++) {
      const t = i / 250, sample = path.getPointAtLength(t * length)
      const distance = (sample.x - point.x) ** 2 + (sample.y - point.y) ** 2
      if (distance < bestDistance) { bestDistance = distance; bestT = t }
    }
    const result = path.getPointAtLength(bestT * length)
    return { t: bestT, point: { x: result.x, y: result.y } }
  } catch { return null }
}

export function strokePoint(data: string, t: number): Point | null {
  try { const { path, length } = geometry(data); const p = path.getPointAtLength(length * t); return { x: p.x, y: p.y } } catch { return null }
}

/** Build a scalable outline from a sampled line or open Bézier centreline. */
export function variableStrokePath(data: string, widths: WidthPoint[], base: number, dash: 'solid' | 'dashed' | 'dotted' = 'solid') {
  try {
    const { path, length } = geometry(data)
    if (!length) return ''
    const unit = Math.max(base, 1)
    const dashSize = unit * 4, gap = unit * 2
    const segments: [number, number][] = []
    if (dash === 'solid') segments.push([0, length])
    else if (dash === 'dotted') {
      // Dots are round caps centered at regular intervals, like the ordinary stroke.
      const dots: string[] = []
      for (let distance = 0; distance <= length && dots.length < 10000; distance += gap) {
        const p = path.getPointAtLength(distance), radius = Math.max(0, widthAt(widths, distance / length, base)) / 2
        if (radius) dots.push(`M ${(p.x - radius).toFixed(2)} ${p.y.toFixed(2)} a ${radius.toFixed(2)} ${radius.toFixed(2)} 0 1 0 ${(2 * radius).toFixed(2)} 0 a ${radius.toFixed(2)} ${radius.toFixed(2)} 0 1 0 ${(-2 * radius).toFixed(2)} 0 Z`)
      }
      return dots.join(' ')
    } else for (let start = 0; start < length && segments.length < 10000; start += dashSize + gap) segments.push([start, Math.min(length, start + dashSize)])
    return segments.map(([start, end]) => {
      const count = Math.max(1, Math.min(500, Math.ceil((end - start) / 3)))
      const left: Point[] = [], right: Point[] = []
      for (let i = 0; i <= count; i++) {
        const distance = start + (end - start) * i / count
        const p = path.getPointAtLength(distance)
        const before = path.getPointAtLength(Math.max(0, distance - .1)), after = path.getPointAtLength(Math.min(length, distance + .1))
        const dx = after.x - before.x, dy = after.y - before.y, norm = Math.hypot(dx, dy) || 1
        const half = Math.max(0, widthAt(widths, distance / length, base)) / 2
        left.push({ x: p.x - dy / norm * half, y: p.y + dx / norm * half })
        right.push({ x: p.x + dy / norm * half, y: p.y - dx / norm * half })
      }
      return `M ${[...left, ...right.reverse()].map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L ')} Z`
    }).join(' ')
  } catch { return '' }
}
