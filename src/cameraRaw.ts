import type { CameraRawSettings } from './types'
export const DEFAULT_CAMERA_RAW: CameraRawSettings = { brightness: 0, exposure: 0, vibrance: 0, sharpness: 0, shadows: 25, midtones: 50, highlights: 75 }
const bounded = (value: number, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
/** Filter primitives are shared by canvas, preview and SVG/raster export. */
export function cameraRawMarkup(settings: CameraRawSettings) {
  const brightness = bounded(settings.brightness, 0, -100, 100) / 100
  const exposure = bounded(settings.exposure, 0, -2, 2)
  const saturation = Math.max(0, 1 + bounded(settings.vibrance, 0, -100, 100) / 100)
  const sharpness = bounded(settings.sharpness, 0, 0, 100) / 100
  const curve = [0, bounded(settings.shadows, 25, 0, 100) / 100, bounded(settings.midtones, 50, 0, 100) / 100, bounded(settings.highlights, 75, 0, 100) / 100, 1].join(' ')
  const gain = 2 ** exposure
  const sharp = sharpness ? `<feConvolveMatrix order="3" kernelMatrix="0 ${-sharpness} 0 ${-sharpness} ${1 + 4 * sharpness} ${-sharpness} 0 ${-sharpness} 0" edgeMode="duplicate" preserveAlpha="true"/>` : ''
  return `<feComponentTransfer><feFuncR type="linear" slope="${gain}" intercept="${brightness}"/><feFuncG type="linear" slope="${gain}" intercept="${brightness}"/><feFuncB type="linear" slope="${gain}" intercept="${brightness}"/></feComponentTransfer><feComponentTransfer><feFuncR type="table" tableValues="${curve}"/><feFuncG type="table" tableValues="${curve}"/><feFuncB type="table" tableValues="${curve}"/></feComponentTransfer><feColorMatrix type="saturate" values="${saturation}"/>${sharp}`
}
