import type { DesignLayer, LayerType, ShapeKind } from './types'

type Preset = { label: string; type: LayerType; preset?: Partial<DesignLayer> }
export type ShapeCategory = { name: string; shapes: Preset[] }
const shape = (label: string, shapeKind: ShapeKind, extras: Partial<DesignLayer> = {}): Preset => ({
  label, type: 'polygon', preset: { name: label, shapeKind, ...extras },
})

export const shapeCategories: ShapeCategory[] = [
  { name: 'Basic shapes', shapes: [
    { label: 'Rectangle', type: 'rectangle' }, { label: 'Ellipse', type: 'ellipse' },
    shape('Triangle', 'regular', { sides: 3 }), shape('Polygon', 'regular', { sides: 6 }),
    { label: 'Star', type: 'star' }, { label: 'Line', type: 'line' },
  ] },
  { name: 'Decorative shapes', shapes: [
    shape('Starburst', 'starburst', { sides: 12, burstInset: 45 }),
    shape('Sunburst', 'sunburst', { sides: 16, burstInset: 25 }),
    shape('Explosion', 'explosion'), shape('Lightning bolt', 'lightning'), shape('Cloud', 'cloud'),
  ] },
  { name: 'UI/UX shapes', shapes: [
    shape('Button', 'button'), shape('Tag', 'tag'), shape('Badge', 'badge'), shape('Frame', 'frame'),
    shape('Callout', 'callout'), shape('Quote bubble', 'quote-bubble'), shape('Speech bubble', 'speech-bubble'),
  ] },
  { name: 'Infographic/chart shapes', shapes: [
    shape('Pie chart', 'pie'), shape('Donut chart', 'donut'), shape('Megaphone', 'megaphone'),
    shape('Ribbon', 'ribbon'), shape('Banner', 'banner'),
  ] },
  { name: 'Geometric/abstract shapes', shapes: [
    shape('Heart', 'heart', { fill: '#FF5C47' }), shape('Diamond', 'diamond', { sides: 4 }),
    shape('Concave polygon', 'starburst', { sides: 6, burstInset: 35 }),
    shape('Rhombus', 'rhombus'), shape('Trapezoid', 'trapezoid'),
  ] },
  { name: 'Stamp/approval shapes', shapes: [
    shape('Stamp', 'stamp'), shape('Rectangular stamp', 'stamp-rectangle'), shape('Seal', 'seal'), shape('Certificate', 'certificate'),
    shape('Label', 'label'), shape('Gear', 'gear'),
  ] },
  { name: 'Pointer/indicator shapes', shapes: [
    shape('Arrow', 'arrow'), shape('Map pin', 'map-pin'), shape('Shield', 'shield'),
  ] },
]

/** Returns a path in artboard coordinates, or null for regular polygon variants. */
export function presetShapePath(layer: DesignLayer): string | null {
  const { x, y, width: w, height: h, shapeKind: kind } = layer
  const p = (a: number, b: number) => `${x + a * w} ${y + b * h}`
  const poly = (points: [number, number][]) => `M ${points.map(([a, b]) => p(a, b)).join(' L ')} Z`
  const circle = (cx: number, cy: number, rx: number, ry: number) => `M ${p(cx + rx, cy)} A ${w * rx} ${h * ry} 0 1 0 ${p(cx - rx, cy)} A ${w * rx} ${h * ry} 0 1 0 ${p(cx + rx, cy)} Z`
  const rectangle = (left: number, top: number, right: number, bottom: number) => poly([[left, top], [right, top], [right, bottom], [left, bottom]])
  const radial = (count: number, radii: number[]) => poly(Array.from({ length: count * radii.length }, (_, i) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / (count * radii.length)
    return [.5 + Math.cos(a) * radii[i % radii.length] * .5, .5 + Math.sin(a) * radii[i % radii.length] * .5] as [number, number]
  }))
  switch (kind) {
    case 'explosion': return radial(8, [1, .55, .82, .48])
    case 'lightning': return poly([[.56, .02], [.17, .55], [.43, .55], [.32, .98], [.84, .39], [.56, .39], [.72, .02]])
    case 'cloud': return `M ${p(.2,.82)} C ${p(-.06,.82)} ${p(-.02,.46)} ${p(.21,.43)} C ${p(.18,.16)} ${p(.54,.07)} ${p(.67,.32)} C ${p(.93,.22)} ${p(1.07,.48)} ${p(.93,.64)} C ${p(1.03,.76)} ${p(.91,.84)} ${p(.78,.82)} Z`
    case 'button': return `M ${p(.12,.16)} L ${p(.88,.16)} Q ${p(.99,.16)} ${p(.99,.3)} L ${p(.99,.7)} Q ${p(.99,.84)} ${p(.88,.84)} L ${p(.12,.84)} Q ${p(.01,.84)} ${p(.01,.7)} L ${p(.01,.3)} Q ${p(.01,.16)} ${p(.12,.16)} Z`
    case 'tag': return `${poly([[.03,.5],[.32,.15],[.94,.15],[.94,.85],[.32,.85]])} ${circle(.26,.5,.055,.055)}`
    case 'badge': return `M ${p(.5,.02)} L ${p(.88,.16)} L ${p(.86,.58)} Q ${p(.82,.81)} ${p(.5,.98)} Q ${p(.18,.81)} ${p(.14,.58)} L ${p(.12,.16)} Z`
    case 'frame': return `${rectangle(.02,.02,.98,.98)} ${rectangle(.13,.13,.87,.87)}`
    case 'callout': return poly([[.03,.05],[.97,.05],[.97,.68],[.6,.68],[.39,.96],[.42,.68],[.03,.68]])
    case 'quote-bubble': return `M ${p(.14,.08)} L ${p(.86,.08)} Q ${p(.98,.08)} ${p(.98,.22)} L ${p(.98,.63)} Q ${p(.98,.76)} ${p(.84,.76)} L ${p(.49,.76)} L ${p(.22,.96)} L ${p(.27,.76)} L ${p(.14,.76)} Q ${p(.02,.76)} ${p(.02,.63)} L ${p(.02,.22)} Q ${p(.02,.08)} ${p(.14,.08)} Z`
    case 'speech-bubble': return `M ${p(.5,.06)} C ${p(.77,.06)} ${p(.98,.22)} ${p(.98,.43)} C ${p(.98,.64)} ${p(.8,.8)} ${p(.53,.8)} L ${p(.23,.96)} L ${p(.29,.74)} C ${p(.12,.67)} ${p(.02,.56)} ${p(.02,.43)} C ${p(.02,.22)} ${p(.23,.06)} ${p(.5,.06)} Z`
    case 'pie': return `M ${p(.5,.5)} L ${p(.5,.02)} A ${w*.48} ${h*.48} 0 1 0 ${p(.98,.5)} Z`
    case 'donut': return `${circle(.5,.5,.48,.48)} ${circle(.5,.5,.23,.23)}`
    case 'megaphone': return `M ${p(.04,.37)} L ${p(.27,.37)} L ${p(.78,.08)} L ${p(.78,.78)} L ${p(.28,.57)} L ${p(.38,.9)} L ${p(.25,.9)} L ${p(.16,.62)} L ${p(.04,.62)} Z ${rectangle(.85,.24,.96,.64)}`
    case 'ribbon': return poly([[.02,.17],[.98,.17],[.98,.74],[.7,.74],[.7,.98],[.5,.84],[.3,.98],[.3,.74],[.02,.74]])
    case 'banner': return poly([[.02,.14],[.98,.14],[.85,.5],[.98,.86],[.02,.86],[.15,.5]])
    case 'rhombus': return poly([[.28,.07],[.98,.07],[.72,.93],[.02,.93]])
    case 'trapezoid': return poly([[.24,.08],[.76,.08],[.98,.92],[.02,.92]])
    case 'stamp': return radial(16, [1, .9])
    case 'stamp-rectangle': {
      // Inward scallops keep the stamp edge visible at any width or height.
      const steps = 8
      const depth = Math.min(Math.abs(w), Math.abs(h)) * .07
      const dx = depth / (Math.abs(w) || 1)
      const dy = depth / (Math.abs(h) || 1)
      let path = `M ${p(0, 0)}`
      for (let i = 0; i < steps; i += 1) path += ` Q ${p((i + .5) / steps, dy)} ${p((i + 1) / steps, 0)}`
      for (let i = 0; i < steps; i += 1) path += ` Q ${p(1 - dx, (i + .5) / steps)} ${p(1, (i + 1) / steps)}`
      for (let i = 0; i < steps; i += 1) path += ` Q ${p(1 - (i + .5) / steps, 1 - dy)} ${p(1 - (i + 1) / steps, 1)}`
      for (let i = 0; i < steps; i += 1) path += ` Q ${p(dx, 1 - (i + .5) / steps)} ${p(0, 1 - (i + 1) / steps)}`
      return `${path} Z`
    }
    case 'seal': return radial(12, [1, .84])
    case 'certificate': return `${rectangle(.05,.04,.95,.96)} ${rectangle(.13,.12,.87,.88)}`
    case 'label': return poly([[.05,.13],[.83,.13],[.97,.5],[.83,.87],[.05,.87]])
    case 'gear': return radial(10, [.75, 1, 1, .75]) + ' ' + circle(.5,.5,.2,.2)
    case 'map-pin': return `M ${p(.5,.98)} C ${p(.42,.86)} ${p(.08,.57)} ${p(.08,.36)} C ${p(.08,-.08)} ${p(.92,-.08)} ${p(.92,.36)} C ${p(.92,.57)} ${p(.58,.86)} ${p(.5,.98)} Z ${circle(.5,.35,.14,.14)}`
    case 'shield': return `M ${p(.5,.03)} L ${p(.91,.18)} L ${p(.87,.57)} Q ${p(.83,.8)} ${p(.5,.97)} Q ${p(.17,.8)} ${p(.13,.57)} L ${p(.09,.18)} Z`
    default: return null
  }
}
