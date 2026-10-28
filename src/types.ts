export type Tool = 'select' | 'hand' | 'rectangle' | 'ellipse' | 'text' | 'image' | 'star' | 'line'

export type LayerType = 'rectangle' | 'ellipse' | 'text' | 'image' | 'star' | 'line'

export interface DesignLayer {
  id: string
  name: string
  type: LayerType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
  fill: string
  stroke: string
  strokeWidth: number
  radius?: number
  text?: string
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  letterSpacing?: number
  lineHeight?: number
  textAlign?: 'left' | 'center' | 'right'
  src?: string
}

export interface DesignDocument {
  width: number
  height: number
  unit: 'px' | 'mm' | 'cm' | 'in'
  dpi: number
  background: string
  presetName: string
}

export type View = 'editor' | 'home' | 'new'
export type Theme = 'light' | 'dark'
export type MobileSheet = 'layers' | 'properties' | 'shapes' | 'more' | null
export type ExportFormat = 'PNG' | 'JPG' | 'SVG' | 'PDF' | 'PROJECT'
