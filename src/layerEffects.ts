import type { DesignLayer, FxKind, LayerEffect } from './types'

export const effectLabels: Record<FxKind, string> = { dropShadow: 'Drop shadow', innerGlow: 'Inner glow', outerGlow: 'Outer glow', bevel: 'Bevel' }
export const effectKinds: FxKind[] = ['dropShadow', 'innerGlow', 'outerGlow', 'bevel']
export function defaultEffect(kind: FxKind): LayerEffect {
  return { enabled: false, color: kind === 'dropShadow' ? '#000000' : '#ffffff', opacity: kind === 'dropShadow' ? 60 : 70, size: kind === 'bevel' ? 5 : 12, angle: 45, distance: 8 }
}
const number = (value: number, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
const color = (value: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'
export function hasEffects(layer: DesignLayer) { return effectKinds.some((kind) => layer.effects?.[kind]?.enabled) }
export function effectBounds(layer: DesignLayer) {
  const extent = Math.hypot(layer.width, layer.height) + 600
  return { x: layer.x + layer.width / 2 - extent, y: layer.y + layer.height / 2 - extent, width: extent * 2, height: extent * 2 }
}
/** SVG filter primitives, shared by the canvas and SVG/raster export. Values are sanitized before markup is constructed. */
export function effectMarkup(layer: DesignLayer) {
  const fx = layer.effects || {}
  const fragments: string[] = [], behind: string[] = [], above: string[] = []
  const values = (item: LayerEffect) => ({ size: number(item.size, 12, 0, 100), opacity: number(item.opacity, 70, 0, 100) / 100, color: color(item.color), angle: number(item.angle, 45, -360, 360), distance: number(item.distance, 8, 0, 200) })
  if (fx.dropShadow?.enabled) {
    const v = values(fx.dropShadow), angle = v.angle * Math.PI / 180
    fragments.push(`<feGaussianBlur in="SourceAlpha" stdDeviation="${v.size / 2}" result="shadowBlur"/><feOffset in="shadowBlur" dx="${Math.cos(angle) * v.distance}" dy="${Math.sin(angle) * v.distance}" result="shadowOffset"/><feFlood flood-color="${v.color}" flood-opacity="${v.opacity}" result="shadowColor"/><feComposite in="shadowColor" in2="shadowOffset" operator="in" result="shadow"/>`); behind.push('shadow')
  }
  if (fx.outerGlow?.enabled) {
    const v = values(fx.outerGlow)
    fragments.push(`<feGaussianBlur in="SourceAlpha" stdDeviation="${v.size / 2}" result="outerBlur"/><feFlood flood-color="${v.color}" flood-opacity="${v.opacity}" result="outerColor"/><feComposite in="outerColor" in2="outerBlur" operator="in" result="outer"/>`); behind.push('outer')
  }
  if (fx.innerGlow?.enabled) {
    const v = values(fx.innerGlow)
    fragments.push(`<feGaussianBlur in="SourceAlpha" stdDeviation="${v.size / 2}" result="innerBlur"/><feComposite in="SourceAlpha" in2="innerBlur" operator="out" result="innerEdge"/><feFlood flood-color="${v.color}" flood-opacity="${v.opacity}" result="innerColor"/><feComposite in="innerColor" in2="innerEdge" operator="in" result="inner"/>`); above.push('inner')
  }
  if (fx.bevel?.enabled) {
    const v = values(fx.bevel)
    fragments.push(`<feGaussianBlur in="SourceAlpha" stdDeviation="${Math.max(.1, v.size / 3)}" result="bevelBlur"/><feSpecularLighting in="bevelBlur" surfaceScale="${v.size}" specularConstant="${v.opacity}" specularExponent="20" lighting-color="${v.color}" result="bevelLight"><feDistantLight azimuth="${v.angle}" elevation="45"/></feSpecularLighting><feComposite in="bevelLight" in2="SourceAlpha" operator="in" result="bevel"/>`); above.push('bevel')
  }
  return fragments.join('') + `<feMerge>${[...behind, 'SourceGraphic', ...above].map((name) => `<feMergeNode in="${name}"/>`).join('')}</feMerge>`
}
