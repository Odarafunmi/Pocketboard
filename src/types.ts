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
  | 'paint-brush'
  | 'corner'
  | 'zoom'
  | 'crop'
  | 'polygon-mask'
  | 'wand-mask'
  | 'knife'
  | 'width'

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
  /** Per-stroke opacity and per-dab flow, from 0 to 1. Missing values are 1 for older projects. */
  opacity?: number
  flow?: number
  /** Opaque inner radius relative to the brush radius; omitted strokes stay hard. */
  hardness?: number
}

export type BlurType = 'gaussian' | 'motion' | 'radial' | 'path'
export interface LayerBlur { type: BlurType; amount: number; angle: number; curvature: number; enabled: boolean }

export type MaskSelection = { mode: 'keep' | 'hide'; feather: number } & ({ kind: 'polygon'; points: Point[] } | { kind: 'wand'; image: string })

export interface FontAsset { data: string; unicodeRange?: string }
export interface StoredFont { id: string; label: string; assets: FontAsset[] }

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
  fillType?: 'none' | 'solid' | 'linear' | 'radial'
  gradient?: GradientFill
  stroke: string
  strokeWidth: number
  strokeEnabled?: boolean
  strokeDash?: 'solid' | 'dashed' | 'dotted'
  widthPoints?: { t: number; width: number }[]
  radius?: number
  sides?: number
  shapeKind?: ShapeKind
  burstInset?: number
  points?: Point[]
  compoundPolygons?: Point[][][]
  isEmpty?: boolean
  paintStrokes?: (MaskBrushStroke & { color: string })[]
  penHandles?: Point[]
  closed?: boolean
  smoothing?: number
  text?: string
  fontSize?: number
  textScaleX?: number
  textWrap?: boolean
  fontWeight?: number
  fontStyle?: 'normal' | 'italic'
  underline?: boolean
  fontFamily?: string
  fontLabel?: string
  fontAssets?: FontAsset[]
  letterSpacing?: number
  lineHeight?: number
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  src?: string
  mask?: MaskType
  imageOffsetX?: number
  imageOffsetY?: number
  imageScale?: number
  maskCreated?: boolean
  clipToBelow?: boolean
  maskStrokes?: MaskBrushStroke[]
  maskSelections?: MaskSelection[]
  flipX?: boolean
  flipY?: boolean
  blur?: LayerBlur
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
  slice?: boolean
  artboardId?: string
}

export type View = 'editor' | 'home' | 'new'
export type Theme = 'light' | 'dark'
export type MobileSheet = 'layers' | 'properties' | 'shapes' | 'artboards' | 'mask' | 'more' | 'mouse' | null
export type ExportFormat = 'PNG' | 'JPG' | 'SVG' | 'PDF' | 'PROJECT'
