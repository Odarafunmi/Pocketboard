import type { DesignLayer } from './types'

let context: CanvasRenderingContext2D | null | undefined

/** Wrap without changing the stored text, so editing and exports retain its content. */
export function textLines(layer: DesignLayer): string[] {
  // Existing documents used unwrapped SVG text; preserve their layout until resized.
  if (!layer.textWrap) return (layer.text || '').split('\n')
  if (context === undefined) context = document.createElement('canvas').getContext('2d')
  const size = layer.fontSize || 32
  const width = Math.max(1, layer.width / (layer.textScaleX || 1))
  if (context) context.font = `${layer.fontWeight || 400} ${size}px "${(layer.fontFamily || 'Inter').replace(/["\\]/g, '')}"`
  const measure = (value: string) => (context?.measureText(value).width ?? value.length * size * .6) + Math.max(0, [...value].length - 1) * (layer.letterSpacing || 0)
  const result: string[] = []
  for (const paragraph of (layer.text || '').split('\n')) {
    let line = ''
    for (const word of paragraph.split(/(\s+)/).filter(Boolean)) {
      if (line && measure(line + word) > width && word.trim()) {
        result.push(line.trimEnd())
        line = ''
      }
      if (!line && !word.trim()) continue
      if (measure(line + word) <= width || !word.trim()) {
        line += word
        continue
      }
      // Break words that cannot fit on a line, without splitting surrogate pairs.
      for (const character of word) {
        if (line && measure(line + character) > width) {
          result.push(line.trimEnd())
          line = ''
        }
        line += character
      }
    }
    result.push(line.trimEnd())
  }
  return result.length ? result : ['']
}
