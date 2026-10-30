import type { DesignLayer } from './types'

let context: CanvasRenderingContext2D | null | undefined

/** Wrap without changing the stored text, so editing and exports retain its content. */
export function textLineDetails(layer: DesignLayer): { text: string; last: boolean }[] {
  // Existing documents used unwrapped SVG text; preserve their layout until resized.
  if (!layer.textWrap) return (layer.text || '').split('\n').map((text) => ({ text, last: true }))
  if (context === undefined) context = document.createElement('canvas').getContext('2d')
  const size = layer.fontSize || 32
  const width = Math.max(1, layer.width / (layer.textScaleX || 1))
  if (context) context.font = `${layer.fontStyle === 'italic' ? 'italic' : 'normal'} ${layer.fontWeight || 400} ${size}px "${(layer.fontFamily || 'Inter').replace(/["\\]/g, '')}"`
  const measure = (value: string) => (context?.measureText(value).width ?? value.length * size * .6) + Math.max(0, [...value].length - 1) * (layer.letterSpacing || 0)
  const result: { text: string; last: boolean }[] = []
  for (const paragraph of (layer.text || '').split('\n')) {
    let line = ''
    for (const word of paragraph.split(/(\s+)/).filter(Boolean)) {
      if (line && measure(line + word) > width && word.trim()) {
        result.push({ text: line.trimEnd(), last: false })
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
          result.push({ text: line.trimEnd(), last: false })
          line = ''
        }
        line += character
      }
    }
    result.push({ text: line.trimEnd(), last: true })
  }
  return result.length ? result : [{ text: '', last: true }]
}

export function textLines(layer: DesignLayer): string[] {
  return textLineDetails(layer).map((line) => line.text)
}

/** Distribute the extra width between words, retaining normal glyph spacing. */
export function justifiedWords(layer: DesignLayer, text: string): { text: string; offset: number }[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return []
  if (context === undefined) context = document.createElement('canvas').getContext('2d')
  const size = layer.fontSize || 32
  if (context) context.font = `${layer.fontStyle === 'italic' ? 'italic' : 'normal'} ${layer.fontWeight || 400} ${size}px "${(layer.fontFamily || 'Inter').replace(/["\\]/g, '')}"`
  const widths = words.map((word) => (context?.measureText(word).width ?? word.length * size * .6) + Math.max(0, [...word].length - 1) * (layer.letterSpacing || 0))
  const width = Math.max(1, layer.width / (layer.textScaleX || 1))
  const gap = Math.max(0, (width - widths.reduce((sum, item) => sum + item, 0)) / (words.length - 1))
  let offset = 0
  return words.map((word, index) => { const result = { text: word, offset }; offset += widths[index] + gap; return result })
}
