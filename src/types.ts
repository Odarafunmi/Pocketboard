export type Tool =
  | 'select'
  | 'object-select'
  | 'hand'
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'text'
  | 'image'
  | 'star'
  | 'line'
  | 'pen'
  | 'brush'
  | 'corner'
  | 'zoom'
  | 'crop'

export type LayerType = 'rectangle' | 'ellipse' | 'polygon' | 'text' | 'image' | 'star' | 'line' | 'path' | 'brush'

export interface Point {
  x: number
  y: number
}

export interface GradientStop {
  offset: number
  color: string
}

export interface GradientFill {
  type: 'linear' | 'radial'
  angle: number
  stops: GradientStop[]
}

export type MaskType = 'none' | 'ellipse' | 'rounded' | 'star'
export type MaskBrushMode = 'hide' | 'restore'
export type ShapeKind =
  | 'regular' | 'diamond' | 'arrow' | 'heart' | 'starburst' | 'sunburst'
  | 'explosion' | 'lightning' | 'cloud' | 'button' | 'tag' | 'badge' | 'frame'
  | 'callout' | 'quote-bubble' | 'speech-bubble' | 'pie' | 'donut' | 'megaphone'
  | 'ribbon' | 'banner' | 'rhombus' | 'trapezoid' | 'stamp' | 'stamp-rectangle' | 'seal'
  | 'certificate' | 'label' | 'gear' | 'map-pin' | 'shield'

export interface MaskBrushStroke {
  points: Point[]
  size: number
  mode: MaskBrushMode
}

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
  fillType?: 'solid' | 'linear' | 'radial'
  gradient?: GradientFill
  stroke: string
  strokeWidth: number
  radius?: number
  sides?: number
  shapeKind?: ShapeKind
  burstInset?: number
  points?: Point[]
  closed?: boolean
  smoothing?: number
  text?: string
  fontSize?: number
  textScaleX?: number
  textWrap?: boolean
  fontWeight?: number
  fontFamily?: string
  letterSpacing?: number
  lineHeight?: number
  textAlign?: 'left' | 'center' | 'right'
  src?: string
  mask?: MaskType
  imageOffsetX?: number
  imageOffsetY?: number
  imageScale?: number
  maskStrokes?: MaskBrushStroke[]
  flipX?: boolean
  flipY?: boolean
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay'
}

export interface DesignDocument {
  width: number
  height: number
  unit: 'px' | 'mm' | 'cm' | 'in'
  dpi: number
  background: string
  presetName: string
}

export interface ArtboardSnapshot {
  id: string
  name: string
  document: DesignDocument
  layers: DesignLayer[]
}

export interface CanvasGuide {
  id: string
  axis: 'x' | 'y'
  position: number
}

export type View = 'editor' | 'home' | 'new'
export type Theme = 'light' | 'dark'
export type MobileSheet = 'layers' | 'properties' | 'shapes' | 'artboards' | 'mask' | 'more' | null
export type ExportFormat = 'PNG' | 'JPG' | 'SVG' | 'PDF' | 'PROJECT'
