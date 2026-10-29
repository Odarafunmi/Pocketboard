import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Brush,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Crop,
  Diamond,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  Frame,
  Grid3X3,
  GripVertical,
  Hand,
  Heart,
  Hexagon,
  Image as ImageIcon,
  Layers3,
  LayoutGrid,
  Link2,
  Lock,
  Maximize2,
  Menu,
  Minus,
  Monitor,
  Moon,
  MousePointer2,
  Move,
  Palette,
  PenTool,
  Pipette,
  Plus,
  Redo2,
  RotateCw,
  Ruler,
  ScanSearch,
  Save,
  Search,
  Settings2,
  Share2,
  Shapes,
  SlidersHorizontal,
  Smartphone,
  Spline,
  Sparkles,
  Square,
  Star,
  Sun,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { emptyDocumentLayers, presets, sampleDocument, sampleLayers } from './data'
import { textLines } from './textLayout'
import { extractImagePalette } from './imagePalette'
import { magicWandMask } from './selectionMask'
import { presetShapePath, shapeCategories } from './shapePresets'
import type {
  ArtboardSnapshot,
  BlurType,
  CanvasGuide,
  DesignDocument,
  DesignLayer,
  ExportFormat,
  GradientFill,
  LayerType,
  MaskBrushMode,
  MaskBrushStroke,
  MaskSelection,
  MobileSheet,
  Point,
  Theme,
  Tool,
  View,
} from './types'

type MouseButtonAction = 'default' | 'pan' | 'none'
type MouseSettings = { left: MouseButtonAction; middle: MouseButtonAction; right: MouseButtonAction; wheel: 'zoom' | 'pan' | 'none' }
const DEFAULT_MOUSE: MouseSettings = { left: 'default', middle: 'pan', right: 'default', wheel: 'zoom' }
function readMouseSettings(): MouseSettings {
  try {
    const saved = JSON.parse(localStorage.getItem('pocketboard-mouse-settings') || '{}')
    const button = (value: unknown, fallback: MouseButtonAction): MouseButtonAction => value === 'default' || value === 'pan' || value === 'none' ? value : fallback
    return { left: button(saved.left, 'default'), middle: button(saved.middle, 'pan'), right: button(saved.right, 'default'), wheel: saved.wheel === 'zoom' || saved.wheel === 'pan' || saved.wheel === 'none' ? saved.wheel : 'zoom' }
  } catch { return { ...DEFAULT_MOUSE } }
}

const ACCENT = '#5B4BF0'
const GUIDE_COLOR = '#FF2D87'
const RULER_GUIDE_COLOR = '#00B8D9'
const DOCUMENT_COLOURS = ['#18181B', '#FFFFFF', '#5B4BF0', '#173ED1', '#FF5C47', '#FFB800', '#12A150', '#F24E9D']
const DEFAULT_GRADIENT: GradientFill = {
  type: 'linear',
  angle: 45,
  stops: [{ offset: 0, color: '#5B4BF0' }, { offset: 1, color: '#FF5C47' }],
}

const cloneLayers = (layers: DesignLayer[]) => layers.map((layer) => ({
  ...layer,
  points: layer.points?.map((point) => ({ ...point })),
  maskStrokes: layer.maskStrokes?.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) })),
  maskSelections: layer.maskSelections?.map((selection) => selection.kind === 'polygon' ? { ...selection, points: selection.points.map((point) => ({ ...point })) } : { ...selection }),
  gradient: layer.gradient ? { ...layer.gradient, stops: layer.gradient.stops.map((stop) => ({ ...stop })) } : undefined,
}))
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round = (value: number) => Math.round(value)
const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const closestEventElement = (target: EventTarget | null, selector: string) => target instanceof Element ? target.closest(selector) : null
const isTextEditorTarget = (target: EventTarget | null) => Boolean(closestEventElement(target, '.text-editor-overlay'))

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

function App() {
  const prefersDark = useMedia('(prefers-color-scheme: dark)')
  const isCompact = useMedia('(max-width: 599px), (max-height: 560px) and (max-width: 1023px)')
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('pocketboard-theme') as Theme | null
    return stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  })
  const [view, setView] = useState<View>(() => {
    if (window.location.hash === '#editor') return 'editor'
    if (window.location.hash === '#new') return 'new'
    return 'home'
  })
  const [documentMeta, setDocumentMeta] = useState<DesignDocument>(() => {
    try {
      const stored = localStorage.getItem('pocketboard-document-meta')
      return stored ? JSON.parse(stored) : sampleDocument
    } catch {
      return sampleDocument
    }
  })
  const [layers, setLayers] = useState<DesignLayer[]>(() => {
    try {
      const stored = localStorage.getItem('pocketboard-layers')
      return stored ? JSON.parse(stored) : cloneLayers(sampleLayers)
    } catch {
      return cloneLayers(sampleLayers)
    }
  })
  const [projectName, setProjectName] = useState(() => localStorage.getItem('pocketboard-project-name') || 'Objects & Space')
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const stored = localStorage.getItem('pocketboard-layers')
    return stored ? null : 'objects-title'
  })
  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [maskBrushMode, setMaskBrushMode] = useState<MaskBrushMode>('hide')
  const [maskBrushSize, setMaskBrushSize] = useState(72)
  const [selectionMode, setSelectionMode] = useState<'keep' | 'hide'>('keep')
  const [selectionTolerance, setSelectionTolerance] = useState(32)
  const [selectionFeather, setSelectionFeather] = useState(0)
  const [artboards, setArtboards] = useState<ArtboardSnapshot[]>(() => {
    try {
      const stored = localStorage.getItem('pocketboard-artboards')
      if (stored) return JSON.parse(stored)
    } catch { /* use the current document below */ }
    return [{ id: 'artboard-1', name: 'Artboard 1', document: { ...documentMeta }, layers: cloneLayers(layers) }]
  })
  const [activeArtboardId, setActiveArtboardId] = useState(() => localStorage.getItem('pocketboard-active-artboard') || 'artboard-1')
  const [gridVisible, setGridVisible] = useState(() => localStorage.getItem('pocketboard-grid') === 'true')
  const [gridSize, setGridSize] = useState(() => Number(localStorage.getItem('pocketboard-grid-size')) || 80)
  const [guidesVisible, setGuidesVisible] = useState(() => localStorage.getItem('pocketboard-guides-visible') === 'true')
  const [canvasGuides, setCanvasGuides] = useState<CanvasGuide[]>(() => {
    try { return JSON.parse(localStorage.getItem('pocketboard-guides') || '[]') }
    catch { return [] }
  })
  const [past, setPast] = useState<DesignLayer[][]>([])
  const [future, setFuture] = useState<DesignLayer[][]>([])
  const [zoom, setZoom] = useState(68)
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null)
  const [mouseSettings, setMouseSettings] = useState<MouseSettings>(readMouseSettings)
  const changeMouseSettings = (settings: MouseSettings) => {
    setMouseSettings(settings)
    try { localStorage.setItem('pocketboard-mouse-settings', JSON.stringify(settings)) } catch { /* Settings remain active for this session. */ }
  }
  const [exportOpen, setExportOpen] = useState(false)
  const [savingState, setSavingState] = useState<'Saving' | 'Saved' | 'Not saved'>('Saved')
  const [imagePalette, setImagePalette] = useState<{ name: string; colors: string[] } | null>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('pocketboard-image-palette') || 'null')
      return stored && typeof stored.name === 'string' && Array.isArray(stored.colors) && stored.colors.every((color: unknown) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) ? stored : null
    } catch { return null }
  })
  const [extractingPalette, setExtractingPalette] = useState(false)
  const paletteRequestRef = useRef(0)
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const saveTimerRef = useRef<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [colorPick, setColorPick] = useState<{ apply: (color: string) => void; layerId: string | null; artboardId: string; tool: Tool; reopen: boolean } | null>(null)
  const colorPickRef = useRef<typeof colorPick>(null)
  const colorPickBusyRef = useRef(false)
  const [renaming, setRenaming] = useState(false)
  const artboardRef = useRef<SVGSVGElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const clipboardRef = useRef<DesignLayer | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const layersRef = useRef(layers)
  const activeArtboardRef = useRef(activeArtboardId)
  activeArtboardRef.current = activeArtboardId
  const textEditSnapshotRef = useRef<DesignLayer[] | null>(null)

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    if (editingTextId && (editingTextId !== selectedId || activeTool !== 'select' || !layers.some((layer) => layer.id === editingTextId))) {
      const snapshot = textEditSnapshotRef.current
      if (snapshot && JSON.stringify(snapshot) !== JSON.stringify(layersRef.current)) {
        setPast((items) => [...items.slice(-99), snapshot])
        setFuture([])
      }
      textEditSnapshotRef.current = null
      setEditingTextId(null)
    }
  }, [activeTool, editingTextId, layers, selectedId])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('pocketboard-theme', theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'dark' ? '#151517' : '#F4F4F5')
  }, [theme])

  useEffect(() => {
    if (!localStorage.getItem('pocketboard-theme')) {
      setTheme(prefersDark ? 'dark' : 'light')
    }
  }, [prefersDark])

  const persistDocument = useCallback(() => {
    try {
      const currentLayers = layersRef.current
      localStorage.setItem('pocketboard-layers', JSON.stringify(currentLayers))
      localStorage.setItem('pocketboard-document-meta', JSON.stringify(documentMeta))
      localStorage.setItem('pocketboard-project-name', projectName)
      localStorage.setItem('pocketboard-active-artboard', activeArtboardId)
      localStorage.setItem('pocketboard-artboards', JSON.stringify(artboards.map((artboard) => artboard.id === activeArtboardId
        ? { ...artboard, document: documentMeta, layers: currentLayers }
        : artboard)))
      localStorage.setItem('pocketboard-grid', String(gridVisible))
      localStorage.setItem('pocketboard-grid-size', String(gridSize))
      localStorage.setItem('pocketboard-guides-visible', String(guidesVisible))
      localStorage.setItem('pocketboard-guides', JSON.stringify(canvasGuides))
      setSavingState('Saved')
      return true
    } catch {
      setSavingState('Not saved')
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      setToast('Device storage is full. Export a project backup.')
      return false
    }
  }, [documentMeta, projectName, activeArtboardId, artboards, gridVisible, gridSize, guidesVisible, canvasGuides])

  useEffect(() => {
    setSavingState('Saving')
    saveTimerRef.current = window.setTimeout(() => { persistDocument(); saveTimerRef.current = null }, 500)
    return () => { if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current) }
  }, [layers, persistDocument])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1600)
  }, [])

  const saveNow = useCallback(() => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = null
    if (persistDocument()) showToast('Saved on this device')
  }, [persistDocument, showToast])

  useEffect(() => {
    const onSaveShortcut = (event: KeyboardEvent) => {
      if (view !== 'editor' || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      event.stopPropagation()
      saveNow()
    }
    window.addEventListener('keydown', onSaveShortcut, true)
    return () => window.removeEventListener('keydown', onSaveShortcut, true)
  }, [view, saveNow])

  const extractSelectedPalette = async () => {
    if (colorPickRef.current) cancelColorPick(false)
    const image = layersRef.current.find((layer) => layer.id === selectedId && layer.type === 'image')
    if (!image?.src || extractingPalette) return
    const request = ++paletteRequestRef.current
    const board = activeArtboardId
    setExtractingPalette(true)
    try {
      const colors = await extractImagePalette(image.src)
      if (request !== paletteRequestRef.current || selectedIdRef.current !== image.id || activeArtboardRef.current !== board) return
      const palette = { name: image.name, colors }
      try { localStorage.setItem('pocketboard-image-palette', JSON.stringify(palette)) }
      catch { showToast('Palette could not be saved on this device'); return }
      setImagePalette(palette)
      if (isCompact) setMobileSheet('properties')
      showToast('Image palette extracted')
    } catch {
      if (request === paletteRequestRef.current && selectedIdRef.current === image.id && activeArtboardRef.current === board) showToast('Unable to extract colours from this image')
    } finally { if (request === paletteRequestRef.current) setExtractingPalette(false) }
  }

  const cancelColorPick = useCallback((reopen = true) => {
    const current = colorPickRef.current
    colorPickRef.current = null
    colorPickBusyRef.current = false
    setColorPick(null)
    if (reopen && current?.reopen) setMobileSheet('properties')
  }, [])

  const startColorPick = (apply: (color: string) => void) => {
    const target = { apply, layerId: selectedId, artboardId: activeArtboardId, tool: activeTool, reopen: mobileSheet === 'properties' }
    colorPickRef.current = target
    setColorPick(target)
    setMobileSheet(null)
    finishTextEditing()
    window.requestAnimationFrame(() => artboardRef.current?.focus({ preventScroll: true }))
  }

  useEffect(() => {
    const target = colorPickRef.current
    if (target && (target.layerId !== selectedId || target.artboardId !== activeArtboardId || target.tool !== activeTool || view !== 'editor')) cancelColorPick(false)
  }, [selectedId, activeArtboardId, activeTool, view, cancelColorPick])

  useEffect(() => {
    if (!colorPick) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancelColorPick() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [colorPick, cancelColorPick])

  const pickCanvasColor = async (point: Point) => {
    const target = colorPickRef.current
    if (!target || colorPickBusyRef.current) return
    colorPickBusyRef.current = true
    try {
      const color = await sampleArtboardColor(cloneLayers(layersRef.current), documentMeta, point)
      if (colorPickRef.current !== target) return
      target.apply(color)
      cancelColorPick()
    } catch {
      if (colorPickRef.current === target) {
        cancelColorPick()
        showToast('Unable to sample this canvas. Check image access and try again.')
      }
    } finally { if (colorPickRef.current === target) colorPickBusyRef.current = false }
  }

  const navigate = (nextView: View) => {
    setView(nextView)
    const hash = nextView === 'home' ? '' : `#${nextView}`
    window.history.replaceState(null, '', `${window.location.pathname}${hash}`)
    setMobileSheet(null)
  }

  const openArtboardManager = () => {
    setToast(null)
    setMobileSheet('artboards')
  }

  const switchArtboard = (id: string) => {
    if (id === activeArtboardId) return
    const target = artboards.find((artboard) => artboard.id === id)
    if (!target) return
    setArtboards((items) => items.map((artboard) => artboard.id === activeArtboardId
      ? { ...artboard, document: { ...documentMeta }, layers: cloneLayers(layersRef.current) }
      : artboard))
    setActiveArtboardId(id)
    setDocumentMeta({ ...target.document })
    setLayers(cloneLayers(target.layers))
    setSelectedId(null)
    setPast([])
    setFuture([])
    setActiveTool('select')
  }

  const addArtboard = () => {
    const nextNumber = artboards.reduce((highest, artboard) => {
      const match = artboard.name.match(/^Artboard (\d+)$/)
      return match ? Math.max(highest, Number(match[1])) : highest
    }, 0) + 1
    const next: ArtboardSnapshot = {
      id: makeId(),
      name: `Artboard ${nextNumber}`,
      document: { ...documentMeta, background: '#FFFFFF', presetName: 'Custom artboard' },
      layers: [],
    }
    setArtboards((items) => [
      ...items.map((artboard) => artboard.id === activeArtboardId
        ? { ...artboard, document: { ...documentMeta }, layers: cloneLayers(layersRef.current) }
        : artboard),
      next,
    ])
    setActiveArtboardId(next.id)
    setDocumentMeta({ ...next.document })
    setLayers([])
    setSelectedId(null)
    setPast([])
    setFuture([])
    setActiveTool('select')
    showToast(`${next.name} added`)
  }

  const deleteArtboard = (id = activeArtboardId) => {
    if (artboards.length <= 1) {
      showToast('A design needs at least one artboard.')
      return
    }
    const index = artboards.findIndex((artboard) => artboard.id === id)
    if (index < 0) return
    const remaining = artboards.filter((artboard) => artboard.id !== id)
    if (id !== activeArtboardId) {
      setArtboards(remaining)
      showToast('Artboard deleted')
      return
    }
    const target = remaining[Math.max(0, index - 1)] || remaining[0]
    setArtboards(remaining)
    setActiveArtboardId(target.id)
    setDocumentMeta({ ...target.document })
    setLayers(cloneLayers(target.layers))
    setSelectedId(null)
    setPast([])
    setFuture([])
    setActiveTool('select')
    showToast('Artboard deleted')
  }

  const commitLayers = useCallback((nextLayers: DesignLayer[], message?: string) => {
    const snapshot = cloneLayers(layersRef.current)
    setPast((items) => [...items.slice(-99), snapshot])
    setFuture([])
    layersRef.current = nextLayers
    setLayers(nextLayers)
    if (message) showToast(message)
  }, [showToast])

  const updateLayer = useCallback((id: string, patch: Partial<DesignLayer>, record = true) => {
    const current = layersRef.current
    const next = current.map((layer) => layer.id === id ? { ...layer, ...patch } : layer)
    if (record) commitLayers(next)
    else {
      layersRef.current = next
      setLayers(next)
    }
  }, [commitLayers])

  const beginTextEditing = useCallback((id: string) => {
    const layer = layersRef.current.find((item) => item.id === id)
    if (!layer || layer.type !== 'text' || layer.locked) return
    if (editingTextId !== id) textEditSnapshotRef.current = cloneLayers(layersRef.current)
    setSelectedId(id)
    setActiveTool('select')
    setMobileSheet(null)
    setEditingTextId(id)
  }, [editingTextId])

  const updateTextEditing = useCallback((id: string, patch: Partial<DesignLayer>) => {
    updateLayer(id, patch, false)
  }, [updateLayer])

  const finishTextEditing = useCallback(() => {
    const snapshot = textEditSnapshotRef.current
    if (snapshot) {
      const changed = JSON.stringify(snapshot) !== JSON.stringify(layersRef.current)
      if (changed) {
        setPast((items) => [...items.slice(-99), snapshot])
        setFuture([])
      }
    }
    textEditSnapshotRef.current = null
    setEditingTextId(null)
  }, [])

  const addMaskStroke = useCallback((id: string, stroke: MaskBrushStroke) => {
    const current = layersRef.current
    const target = current.find((layer) => layer.id === id)
    if (!target || target.locked) return
    commitLayers(current.map((layer) => layer.id === id
      ? { ...layer, maskStrokes: [...(layer.maskStrokes || []), stroke] }
      : layer))
  }, [commitLayers])

  const addMaskSelection = useCallback((id: string, selection: MaskSelection, source: DesignLayer) => {
    const current = layersRef.current
    const target = current.find((layer) => layer.id === id)
    if (!target || target.locked || target.src !== source.src || target.imageScale !== source.imageScale || target.imageOffsetX !== source.imageOffsetX || target.imageOffsetY !== source.imageOffsetY || target.width !== source.width || target.height !== source.height) {
      showToast('Image changed. Make the selection again.')
      return
    }
    commitLayers(current.map((layer) => layer.id === id ? { ...layer, maskSelections: [...(layer.maskSelections || []), selection] } : layer), 'Mask applied')
  }, [commitLayers, showToast])

  const activateSelection = (tool: 'polygon-mask' | 'wand-mask') => {
    const target = layersRef.current.find((layer) => layer.id === selectedId)
    if (!target || target.type !== 'image') { showToast('Select an image to mask.'); return }
    if (target.locked) { showToast('Unlock the image before masking.'); return }
    finishTextEditing()
    setActiveTool(tool)
    setMobileSheet(null)
  }

  const clearPaintMask = useCallback((id: string) => {
    const current = layersRef.current
    const target = current.find((layer) => layer.id === id)
    if (!target?.maskStrokes?.length) return
    commitLayers(current.map((layer) => layer.id === id ? { ...layer, maskStrokes: [] } : layer), 'Mask cleared')
  }, [commitLayers])

  const activateMaskBrush = useCallback(() => {
    const target = layersRef.current.find((layer) => layer.id === selectedId)
    if (!target) {
      setActiveTool('object-select')
      showToast('Select an object to mask.')
      return
    }
    if (target.locked) {
      showToast('Unlock the object before masking.')
      return
    }
    finishTextEditing()
    setMaskBrushMode('hide')
    setActiveTool('brush')
    setMobileSheet(null)
  }, [finishTextEditing, selectedId, showToast])

  const undo = useCallback(() => {
    if (!past.length) return
    const previous = cloneLayers(past[past.length - 1])
    const current = cloneLayers(layersRef.current)
    setFuture((items) => [current, ...items].slice(0, 100))
    setPast((items) => items.slice(0, -1))
    layersRef.current = previous
    setLayers(previous)
  }, [past])

  const redo = useCallback(() => {
    if (!future.length) return
    const next = cloneLayers(future[0])
    const current = cloneLayers(layersRef.current)
    setPast((items) => [...items.slice(-99), current])
    setFuture((items) => items.slice(1))
    layersRef.current = next
    setLayers(next)
  }, [future])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    const layer = layersRef.current.find((item) => item.id === selectedId)
    if (!layer || layer.locked) return
    commitLayers(layersRef.current.filter((item) => item.id !== selectedId), 'Layer deleted')
    setSelectedId(null)
    setEditingTextId(null)
  }, [commitLayers, selectedId])

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return
    const layer = layersRef.current.find((item) => item.id === selectedId)
    if (!layer) return
    const duplicate = { ...layer, id: makeId(), name: `${layer.name} copy`, x: layer.x + 24, y: layer.y + 24 }
    commitLayers([...layersRef.current, duplicate], 'Layer duplicated')
    setSelectedId(duplicate.id)
  }, [commitLayers, selectedId])

  const reorderSelected = useCallback((direction: 'up' | 'down') => {
    if (!selectedId) return
    const current = layersRef.current
    const index = current.findIndex((item) => item.id === selectedId)
    const target = direction === 'up' ? index + 1 : index - 1
    if (index < 0 || target < 0 || target >= current.length) return
    const next = [...current]
    ;[next[index], next[target]] = [next[target], next[index]]
    commitLayers(next)
  }, [commitLayers, selectedId])

  const reorderLayersFromPanel = useCallback((topToBottomIds: string[]) => {
    const current = layersRef.current
    if (topToBottomIds.length !== current.length || new Set(topToBottomIds).size !== current.length) return
    const byId = new Map(current.map((layer) => [layer.id, layer]))
    const next = topToBottomIds.map((id) => byId.get(id)).filter((layer): layer is DesignLayer => Boolean(layer)).reverse()
    if (next.length !== current.length || next.every((layer, index) => layer.id === current[index].id)) return
    commitLayers(next, 'Layer order updated')
  }, [commitLayers])

  const alignSelected = useCallback((alignment: 'left' | 'h-center' | 'right' | 'top' | 'v-center' | 'bottom') => {
    if (!selectedId) return
    const layer = layersRef.current.find((item) => item.id === selectedId)
    if (!layer || layer.locked) return
    const patch: Partial<DesignLayer> = {}
    if (alignment === 'left') patch.x = 0
    if (alignment === 'h-center') patch.x = (documentMeta.width - layer.width) / 2
    if (alignment === 'right') patch.x = documentMeta.width - layer.width
    if (alignment === 'top') patch.y = 0
    if (alignment === 'v-center') patch.y = (documentMeta.height - layer.height) / 2
    if (alignment === 'bottom') patch.y = documentMeta.height - layer.height
    updateLayer(selectedId, patch)
    showToast('Aligned to artboard')
  }, [documentMeta.height, documentMeta.width, selectedId, showToast, updateLayer])

  const toggleGuides = () => {
    setGuidesVisible((visible) => {
      if (!visible && canvasGuides.length === 0) {
        setCanvasGuides([
          { id: makeId(), axis: 'x', position: documentMeta.width / 2 },
          { id: makeId(), axis: 'y', position: documentMeta.height / 2 },
        ])
      }
      return !visible
    })
  }

  const addGuide = (axis: 'x' | 'y') => {
    setGuidesVisible(true)
    setCanvasGuides((guides) => [...guides, {
      id: makeId(),
      axis,
      position: axis === 'x' ? documentMeta.width / 2 : documentMeta.height / 2,
    }])
  }

  const addLayer = useCallback((type: LayerType, point?: { x: number; y: number }, preset?: Partial<DesignLayer>) => {
    const count = layersRef.current.length
    const centerX = point?.x ?? documentMeta.width / 2
    const centerY = point?.y ?? documentMeta.height / 2
    const names: Record<LayerType, string> = {
      rectangle: 'Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', text: 'Text', image: 'Image',
      star: 'Star', line: 'Line', path: 'Path', brush: 'Brush stroke',
    }
    const base: DesignLayer = {
      id: makeId(),
      name: names[type],
      type,
      x: centerX - 125 + (count % 3) * 8,
      y: centerY - 90 + (count % 3) * 8,
      width: type === 'text' ? 360 : type === 'line' ? 300 : 250,
      height: type === 'text' ? 72 : type === 'line' ? 0 : 180,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fill: type === 'text' ? '#18181B' : type === 'star' ? '#FF5C47' : '#5B4BF0',
      fillType: 'solid',
      stroke: type === 'line' ? '#18181B' : 'transparent',
      strokeWidth: type === 'line' ? 4 : 0,
      radius: type === 'rectangle' ? 16 : 0,
      sides: type === 'polygon' ? 6 : undefined,
      shapeKind: type === 'polygon' ? 'regular' : undefined,
      text: type === 'text' ? 'Type something' : undefined,
      textWrap: type === 'text' ? true : undefined,
      fontSize: type === 'text' ? 56 : undefined,
      fontWeight: type === 'text' ? 600 : undefined,
      fontFamily: type === 'text' ? 'Inter' : undefined,
      letterSpacing: type === 'text' ? -1 : undefined,
      lineHeight: type === 'text' ? 1.1 : undefined,
      ...preset,
    }
    commitLayers([...layersRef.current, base])
    setSelectedId(base.id)
    setActiveTool('select')
    if (isCompact) setMobileSheet(null)
    return base.id
  }, [commitLayers, documentMeta.height, documentMeta.width, isCompact])

  const addDrawnPath = useCallback((rawPoints: Point[], type: 'path' | 'brush', closed = false) => {
    if (rawPoints.length < 2) return
    const minX = Math.min(...rawPoints.map((point) => point.x))
    const minY = Math.min(...rawPoints.map((point) => point.y))
    const maxX = Math.max(...rawPoints.map((point) => point.x))
    const maxY = Math.max(...rawPoints.map((point) => point.y))
    const width = Math.max(maxX - minX, 2)
    const height = Math.max(maxY - minY, 2)
    const layer: DesignLayer = {
      id: makeId(),
      name: type === 'brush' ? 'Brush stroke' : closed ? 'Closed path' : 'Path',
      type,
      x: minX,
      y: minY,
      width,
      height,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fill: type === 'path' && closed ? '#5B4BF0' : 'transparent',
      fillType: 'solid',
      stroke: '#18181B',
      strokeWidth: type === 'brush' ? 16 : 4,
      radius: 0,
      points: rawPoints.map((point) => ({ x: (point.x - minX) / width, y: (point.y - minY) / height })),
      closed,
      smoothing: type === 'brush' ? 0.55 : 0,
    }
    commitLayers([...layersRef.current, layer], type === 'brush' ? undefined : 'Path created')
    setSelectedId(layer.id)
  }, [commitLayers])

  const importImages = async (files: File[], point?: Point) => {
    const targetArtboard = activeArtboardId
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (!images.length) { showToast('Choose an image file'); return }
    const read = (file: File) => new Promise<DesignLayer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Read failed'))
      reader.onload = () => {
        const src = String(reader.result)
        const image = new Image()
        image.onerror = () => reject(new Error('Invalid image'))
        image.onload = () => {
          const scale = Math.min(documentMeta.width * .5 / image.naturalWidth, documentMeta.height * .5 / image.naturalHeight, 1)
          const width = Math.max(1, image.naturalWidth * scale)
          const height = Math.max(1, image.naturalHeight * scale)
          resolve({
            id: makeId(), name: file.name.replace(/\.[^/.]+$/, '') || 'Image', type: 'image',
            x: (point?.x ?? documentMeta.width / 2) - width / 2,
            y: (point?.y ?? documentMeta.height / 2) - height / 2,
            width, height, rotation: 0, opacity: 1, visible: true, locked: false,
            fill: '#E8E8EA', fillType: 'solid', stroke: 'transparent', strokeWidth: 0, radius: 0,
            src, mask: 'none', imageOffsetX: 0, imageOffsetY: 0, imageScale: 1,
          })
        }
        image.src = src
      }
      reader.readAsDataURL(file)
    })
    const results = await Promise.allSettled(images.map(read))
    if (targetArtboard !== activeArtboardRef.current) { showToast('Import cancelled after switching artboards'); return }
    const added = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
    if (added.length) {
      commitLayers([...layersRef.current, ...added], added.length === 1 ? 'Image added' : `${added.length} images added`)
      setSelectedId(added[added.length - 1].id)
      setActiveTool('select')
      setMobileSheet(null)
    }
    if (added.length !== files.length) showToast('Some files could not be imported')
  }

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length) void importImages(files)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      const command = event.metaKey || event.ctrlKey
      if (editing) return
      if (command && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setView('new')
        setMobileSheet(null)
        window.history.replaceState(null, '', `${window.location.pathname}#new`)
      } else if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (command && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        duplicateSelected()
      } else if (command && event.key.toLowerCase() === 'c' && selectedId) {
        const layer = layersRef.current.find((item) => item.id === selectedId)
        if (layer) clipboardRef.current = { ...layer }
      } else if (command && event.key.toLowerCase() === 'v' && clipboardRef.current) {
        event.preventDefault()
        const pasted = { ...clipboardRef.current, id: makeId(), name: `${clipboardRef.current.name} copy`, x: clipboardRef.current.x + 24, y: clipboardRef.current.y + 24 }
        commitLayers([...layersRef.current, pasted])
        setSelectedId(pasted.id)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault()
        deleteSelected()
      } else if (event.key === 'Escape') {
        setMobileSheet(null)
        setExportOpen(false)
        if (activeTool !== 'select') setActiveTool('select')
        else setSelectedId(null)
      } else if (selectedId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        const layer = layersRef.current.find((item) => item.id === selectedId)
        if (!layer || layer.locked) return
        const step = event.shiftKey ? 10 : 1
        const patch: Partial<DesignLayer> = {}
        if (event.key === 'ArrowLeft') patch.x = layer.x - step
        if (event.key === 'ArrowRight') patch.x = layer.x + step
        if (event.key === 'ArrowUp') patch.y = layer.y - step
        if (event.key === 'ArrowDown') patch.y = layer.y + step
        updateLayer(selectedId, patch)
      } else if (event.key.toLowerCase() === 'v') setActiveTool('select')
      else if (event.key.toLowerCase() === 'q') setActiveTool('object-select')
      else if (event.key.toLowerCase() === 'h') setActiveTool('hand')
      else if (event.key.toLowerCase() === 'r') setActiveTool('rectangle')
      else if (event.key.toLowerCase() === 't') setActiveTool('text')
      else if (event.key.toLowerCase() === 'p') setActiveTool('pen')
      else if (event.key.toLowerCase() === 'b') activateMaskBrush()
      else if (event.key.toLowerCase() === 'z') setActiveTool('zoom')
      else if (event.key.toLowerCase() === 'u') setActiveTool('polygon')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTool, activateMaskBrush, commitLayers, deleteSelected, duplicateSelected, redo, selectedId, undo, updateLayer])

  const createDesign = (meta: DesignDocument, name: string) => {
    const toPx = (value: number) => {
      if (meta.unit === 'px') return value
      if (meta.unit === 'mm') return value * meta.dpi / 25.4
      if (meta.unit === 'cm') return value * meta.dpi / 2.54
      return value * meta.dpi
    }
    const nextMeta = { ...meta, width: round(toPx(meta.width)), height: round(toPx(meta.height)), unit: 'px' as const }
    const artboardId = makeId()
    setDocumentMeta(nextMeta)
    setProjectName(name || 'Untitled design')
    setLayers(emptyDocumentLayers())
    setArtboards([{ id: artboardId, name: 'Artboard 1', document: nextMeta, layers: [] }])
    setActiveArtboardId(artboardId)
    setPast([])
    setFuture([])
    setSelectedId(null)
    setZoom(68)
    navigate('editor')
    showToast('New design created')
  }

  const shareDesign = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: projectName, text: `Created in Pocketboard: ${projectName}` })
        showToast('Design shared')
      } else {
        await navigator.clipboard.writeText(window.location.href)
        showToast('Design link copied')
      }
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') showToast('Sharing is not available in this browser.')
    }
  }

  const openSample = () => {
    const artboardId = makeId()
    setDocumentMeta(sampleDocument)
    setProjectName('Objects & Space')
    setLayers(cloneLayers(sampleLayers))
    setArtboards([{ id: artboardId, name: 'Artboard 1', document: sampleDocument, layers: cloneLayers(sampleLayers) }])
    setActiveArtboardId(artboardId)
    setPast([])
    setFuture([])
    setSelectedId('objects-title')
    navigate('editor')
  }

  const importProject = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result)) as { name?: string; document?: DesignDocument; layers?: DesignLayer[]; artboards?: ArtboardSnapshot[] }
        if (!payload.document || !Array.isArray(payload.layers)) throw new Error('Invalid project')
        const importedArtboards = Array.isArray(payload.artboards) && payload.artboards.length
          ? payload.artboards
          : [{ id: makeId(), name: 'Artboard 1', document: payload.document, layers: payload.layers }]
        setDocumentMeta(payload.document)
        setProjectName(payload.name || file.name.replace(/\.[^/.]+$/, '') || 'Imported design')
        setLayers(cloneLayers(payload.layers))
        setArtboards(importedArtboards.map((artboard) => ({ ...artboard, document: { ...artboard.document }, layers: cloneLayers(artboard.layers) })))
        setActiveArtboardId(importedArtboards[0].id)
        setPast([])
        setFuture([])
        setSelectedId(null)
        navigate('editor')
        showToast('Project imported')
      } catch {
        showToast('Import failed. Choose a valid Pocketboard project file.')
      }
    }
    reader.readAsText(file)
  }

  if (view === 'home') {
    return (
      <>
        <HomeScreen
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          onNew={() => navigate('new')}
          onImport={importProject}
          onOpenSample={openSample}
          onOpenCurrent={() => navigate('editor')}
          currentName={projectName}
          hasCurrent={layers.length > 0 && projectName !== 'Objects & Space'}
        />
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </>
    )
  }

  if (view === 'new') {
    return (
      <NewDesignScreen
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        onBack={() => navigate('home')}
        onCreate={createDesign}
      />
    )
  }

  const selected = layers.find((layer) => layer.id === selectedId) || null
  const handleMobileToolAction = (action: MobileToolAction) => {
    if (action === 'select' || action === 'mask-done') {
      finishTextEditing()
      setActiveTool('select')
    } else if (action === 'object-select') {
      finishTextEditing()
      setActiveTool('object-select')
    } else if (action === 'mask-brush') activateMaskBrush()
    else if (action === 'shapes') setMobileSheet('shapes')
    else if (action === 'text') { setSelectedId(null); setActiveTool('text') }
    else if (action === 'image') imageInputRef.current?.click()
    else if (action === 'extract-palette') { setMobileSheet('properties'); void extractSelectedPalette() }
    else if (action === 'layers') setMobileSheet('layers')
    else if (action === 'more') setMobileSheet('more')
    else if (action === 'properties' || action === 'align' || action === 'arrange') setMobileSheet('properties')
    else if (action === 'edit-text' && selected) beginTextEditing(selected.id)
    else if (action === 'finish-text') finishTextEditing()
    else if (action === 'corners') setActiveTool('corner')
    else if (action === 'duplicate') duplicateSelected()
    else if (action === 'delete') deleteSelected()
    else if (action === 'crop' && selected?.type === 'image') {
      if ((selected.imageScale || 1) <= 1) updateLayer(selected.id, { imageScale: 1.15 })
      setActiveTool('crop')
    } else if (action === 'shape-mask' && selected?.type === 'image') setMobileSheet('mask')
    else if (action === 'mask-hide') setMaskBrushMode('hide')
    else if (action === 'mask-restore') setMaskBrushMode('restore')
    else if (action === 'mask-smaller') setMaskBrushSize((size) => clamp(round(size * .75), 8, 320))
    else if (action === 'mask-larger') setMaskBrushSize((size) => clamp(round(size * 1.3), 8, 320))
    else if (action === 'mask-clear' && selected) clearPaintMask(selected.id)
  }
  const syncedArtboards = artboards.map((artboard) => artboard.id === activeArtboardId ? { ...artboard, document: documentMeta, layers } : artboard)
  const exportArtboards = [...syncedArtboards.filter((artboard) => artboard.id === activeArtboardId), ...syncedArtboards.filter((artboard) => artboard.id !== activeArtboardId)]

  return (
    <div className="app-shell editor-app"
      onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setDraggingFiles(false)
        void importImages(Array.from(event.dataTransfer.files))
      }}>
      <TopBar
        projectName={projectName}
        setProjectName={setProjectName}
        renaming={renaming}
        setRenaming={setRenaming}
        savingState={savingState}
        onSave={saveNow}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={undo}
        onRedo={redo}
        onHome={() => navigate('home')}
        onNew={() => navigate('new')}
        onExport={() => setExportOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        onShare={shareDesign}
      />

      <EditorMenu
        onNew={() => navigate('new')}
        onSave={saveNow}
        onImport={() => imageInputRef.current?.click()}
        onExport={() => setExportOpen(true)}
        onUndo={undo} onRedo={redo} canUndo={past.length > 0} canRedo={future.length > 0}
        onDuplicate={duplicateSelected} onDelete={deleteSelected} hasSelection={Boolean(selected)}
        onDeselect={() => { finishTextEditing(); setSelectedId(null); setActiveTool('select') }}
        onSelectTool={() => { finishTextEditing(); setActiveTool('select') }}
        onObjectSelect={() => { finishTextEditing(); setActiveTool('object-select') }}
        onGrid={() => setGridVisible((visible) => !visible)} gridVisible={gridVisible}
        onGuides={toggleGuides} guidesVisible={guidesVisible}
        onMouseSettings={() => setMobileSheet('mouse')}
        onZoomIn={() => setZoom((value) => clamp(value + 15, 5, 6400))}
        onZoomOut={() => setZoom((value) => clamp(value - 15, 5, 6400))}
        onBrowseShapes={() => setMobileSheet('shapes')}
        onInsertStarburst={() => addLayer('polygon', undefined, { name: 'Starburst', shapeKind: 'starburst', sides: 12, burstInset: 45 })}
        onInsertSunburst={() => addLayer('polygon', undefined, { name: 'Sunburst', shapeKind: 'sunburst', sides: 16, burstInset: 25 })}
      />

      <div className="editor-body">
        <ToolRail
          activeTool={activeTool}
          onTool={(tool) => {
            if (tool === 'image') imageInputRef.current?.click()
            else if (tool === 'brush') activateMaskBrush()
            else if (tool === 'polygon-mask' || tool === 'wand-mask') activateSelection(tool)
            else {
              finishTextEditing()
              setActiveTool(tool)
            }
          }}
          onGrid={() => {
            setGridVisible((visible) => !visible)
            showToast(gridVisible ? 'Layout grid hidden' : 'Layout grid shown')
          }}
          onGuides={toggleGuides}
          onAddArtboard={addArtboard}
        />

        <aside className="layers-panel desktop-panel" aria-label="Layers panel">
          <LayersPanel
            layers={layers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onToggleVisible={(layer) => updateLayer(layer.id, { visible: !layer.visible })}
            onToggleLock={(layer) => updateLayer(layer.id, { locked: !layer.locked })}
            onToggleBlur={(layer) => layer.blur && updateLayer(layer.id, { blur: { ...layer.blur, enabled: !layer.blur.enabled } })}
            onAdd={() => addLayer('rectangle')}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onMoveUp={() => reorderSelected('up')}
            onMoveDown={() => reorderSelected('down')}
            onReorder={reorderLayersFromPanel}
          />
        </aside>

        <main className={`workspace tool-${activeTool} ${guidesVisible ? 'with-rulers' : ''}`} aria-label="Design canvas"
          onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDraggingFiles(true) } }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingFiles(false) }}
          onDrop={(event) => {
            if (!event.dataTransfer.types.includes('Files')) return
            event.preventDefault()
            event.stopPropagation()
            setDraggingFiles(false)
            const rect = artboardRef.current?.getBoundingClientRect()
            const point = rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
              ? { x: (event.clientX - rect.left) * documentMeta.width / rect.width, y: (event.clientY - rect.top) * documentMeta.height / rect.height }
              : undefined
            void importImages(Array.from(event.dataTransfer.files), point)
          }}>
          {draggingFiles && <div className="import-drop-hint">Drop images to import</div>}
          {colorPick && <div className="color-pick-banner" role="status"><span>Tap the artboard to pick a colour</span><button onClick={() => cancelColorPick()}>Cancel</button></div>}
          <ArtboardBar
            artboards={syncedArtboards}
            activeId={activeArtboardId}
            documentMeta={documentMeta}
            compact={isCompact}
            onSwitch={switchArtboard}
            onManage={openArtboardManager}
            onAdd={addArtboard}
            onDelete={() => deleteArtboard()}
          />
          <Canvas
            artboardRef={artboardRef}
            documentMeta={documentMeta}
            layers={layers}
            selected={selected}
            activeTool={activeTool}
            zoom={zoom}
            mouseSettings={mouseSettings}
            gridVisible={gridVisible}
            gridSize={gridSize}
            guidesVisible={guidesVisible}
            userGuides={canvasGuides}
            editingTextId={editingTextId}
            maskBrushMode={maskBrushMode}
            maskBrushSize={maskBrushSize}
            selectionMode={selectionMode} onSelectionMode={setSelectionMode}
            selectionTolerance={selectionTolerance} onSelectionTolerance={setSelectionTolerance}
            selectionFeather={selectionFeather} onSelectionFeather={setSelectionFeather}
            onApplyMaskSelection={addMaskSelection} onSelectionError={showToast} onFinishSelection={() => setActiveTool('select')}
            pickingColor={Boolean(colorPick)}
            onPickColor={pickCanvasColor}
            onSelect={(id) => {
              if (id !== editingTextId) finishTextEditing()
              setSelectedId(id)
              if (id === null && ['object-select', 'corner', 'crop', 'brush'].includes(activeTool)) setActiveTool('select')
            }}
            onAddLayer={addLayer}
            onAddPath={addDrawnPath}
            onAddMaskStroke={addMaskStroke}
            onBeginTextEdit={beginTextEditing}
            onCommitText={updateTextEditing}
            onFinishTextEdit={finishTextEditing}
            onOpenArtboards={openArtboardManager}
            onZoom={(delta) => setZoom((value) => clamp(value + delta, 5, 6400))}
            onSetZoom={(value) => setZoom(clamp(value, 5, 6400))}
            onUpdateGuide={(id, position) => setCanvasGuides((guides) => guides.map((guide) => guide.id === id ? { ...guide, position } : guide))}
            onDeleteGuide={(id) => setCanvasGuides((guides) => guides.filter((guide) => guide.id !== id))}
            onUpdateLive={(id, patch) => updateLayer(id, patch, false)}
            onCommitSnapshot={(snapshot) => {
              setPast((items) => [...items.slice(-99), cloneLayers(snapshot)])
              setFuture([])
            }}
          />

          {selected && (
            <ContextBar
              selected={selected}
              activeTool={activeTool}
              maskBrushMode={maskBrushMode}
              maskBrushSize={maskBrushSize}
              onOpenProperties={() => setMobileSheet('properties')}
              onOpenMask={() => setMobileSheet('mask')}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onDoneTool={() => setActiveTool('select')}
              onUpdate={(patch) => updateLayer(selected.id, patch)}
              onMaskMode={setMaskBrushMode}
              onMaskSize={(size) => setMaskBrushSize(clamp(size, 8, 320))}
              onClearMask={() => clearPaintMask(selected.id)}
            />
          )}

          <ZoomControl
            zoom={zoom}
            onZoomOut={() => setZoom((value) => clamp(value - (value >= 800 ? 400 : value >= 200 ? 50 : 10), 5, 6400))}
            onZoomIn={() => setZoom((value) => clamp(value + (value >= 800 ? 400 : value >= 200 ? 50 : 10), 5, 6400))}
            onFit={() => setZoom(68)}
          />
        </main>

        <aside className="properties-panel desktop-panel" aria-label="Properties panel" onPointerDownCapture={() => { if (colorPick) cancelColorPick(false) }} onKeyDownCapture={() => { if (colorPick) cancelColorPick(false) }}>
          <PropertiesPanel
            selected={selected}
            documentMeta={documentMeta}
            onUpdate={(patch) => selected && updateLayer(selected.id, patch)}
            onPickColor={startColorPick}
            imagePalette={imagePalette}
            extractingPalette={extractingPalette}
            onExtractPalette={() => void extractSelectedPalette()}
            onUpdateDocument={(patch) => setDocumentMeta((current) => ({ ...current, ...patch }))}
            onDelete={deleteSelected}
            onDuplicate={duplicateSelected}
            onMoveUp={() => reorderSelected('up')}
            onMoveDown={() => reorderSelected('down')}
            onAlign={alignSelected}
            activeTool={activeTool}
            onActivateTool={setActiveTool}
            onStartCrop={() => {
              if (selected?.type === 'image' && (selected.imageScale || 1) <= 1) updateLayer(selected.id, { imageScale: 1.15 })
              setActiveTool('crop')
            }}
            onReplaceImage={() => imageInputRef.current?.click()}
            gridVisible={gridVisible}
            gridSize={gridSize}
            guidesVisible={guidesVisible}
            guides={canvasGuides}
            onToggleGrid={() => setGridVisible((visible) => !visible)}
            onGridSize={(size) => setGridSize(clamp(size, 4, 500))}
            onToggleGuides={toggleGuides}
            onAddGuide={addGuide}
            onClearGuides={() => setCanvasGuides([])}
          />
        </aside>
      </div>

      <MobileToolbar
        activeTool={activeTool}
        selected={selected}
        editingText={Boolean(editingTextId)}
        maskBrushMode={maskBrushMode}
        onAction={handleMobileToolAction}
      />

      {mobileSheet && (
        <MobileSheetView title={mobileSheet === 'layers' ? 'Layers' : mobileSheet === 'properties' ? 'Properties' : mobileSheet === 'shapes' ? 'Add shape' : mobileSheet === 'artboards' ? 'Artboards' : mobileSheet === 'mask' ? 'Crop and mask' : mobileSheet === 'mouse' ? 'Mouse settings' : 'More'} onClose={() => setMobileSheet(null)}>
          {mobileSheet === 'mouse' && <MouseSettingsPanel settings={mouseSettings} onChange={changeMouseSettings} />}
          {mobileSheet === 'layers' && (
            <LayersPanel
              layers={layers}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setMobileSheet(null) }}
              onToggleVisible={(layer) => updateLayer(layer.id, { visible: !layer.visible })}
              onToggleLock={(layer) => updateLayer(layer.id, { locked: !layer.locked })}
              onToggleBlur={(layer) => layer.blur && updateLayer(layer.id, { blur: { ...layer.blur, enabled: !layer.blur.enabled } })}
              onAdd={() => addLayer('rectangle')}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onMoveUp={() => reorderSelected('up')}
              onMoveDown={() => reorderSelected('down')}
              onReorder={reorderLayersFromPanel}
              insideSheet
            />
          )}
          {mobileSheet === 'properties' && (
            <PropertiesPanel
              selected={selected}
              documentMeta={documentMeta}
              onUpdate={(patch) => selected && updateLayer(selected.id, patch)}
              onPickColor={startColorPick}
              imagePalette={imagePalette}
              extractingPalette={extractingPalette}
              onExtractPalette={() => void extractSelectedPalette()}
              onUpdateDocument={(patch) => setDocumentMeta((current) => ({ ...current, ...patch }))}
              onDelete={deleteSelected}
              onDuplicate={duplicateSelected}
              onMoveUp={() => reorderSelected('up')}
              onMoveDown={() => reorderSelected('down')}
              onAlign={alignSelected}
              activeTool={activeTool}
              onActivateTool={(tool) => { setActiveTool(tool); setMobileSheet(null) }}
              onStartCrop={() => {
                if (selected?.type === 'image' && (selected.imageScale || 1) <= 1) updateLayer(selected.id, { imageScale: 1.15 })
                setActiveTool('crop')
                setMobileSheet(null)
              }}
              onReplaceImage={() => imageInputRef.current?.click()}
              gridVisible={gridVisible}
              gridSize={gridSize}
              guidesVisible={guidesVisible}
              guides={canvasGuides}
              onToggleGrid={() => setGridVisible((visible) => !visible)}
              onGridSize={(size) => setGridSize(clamp(size, 4, 500))}
              onToggleGuides={toggleGuides}
              onAddGuide={addGuide}
              onClearGuides={() => setCanvasGuides([])}
              insideSheet
            />
          )}
          {mobileSheet === 'shapes' && <ShapesGrid onAdd={(type, point, preset) => { addLayer(type, point, preset); setMobileSheet(null) }} />}
          {mobileSheet === 'artboards' && (
            <ArtboardManager
              artboards={syncedArtboards}
              activeId={activeArtboardId}
              onSwitch={(id) => { switchArtboard(id); setMobileSheet(null) }}
              onAdd={() => { addArtboard(); setMobileSheet(null) }}
              onDelete={deleteArtboard}
            />
          )}
          {mobileSheet === 'mask' && selected?.type === 'image' && (
            <MaskPanel
              layer={selected}
              onUpdate={(patch) => updateLayer(selected.id, patch)}
              onMoveImage={() => {
                if ((selected.imageScale || 1) <= 1) updateLayer(selected.id, { imageScale: 1.15 })
                setActiveTool('crop')
                setMobileSheet(null)
              }}
              onBrushMask={activateMaskBrush}
              onPolygonMask={() => activateSelection('polygon-mask')}
              onWandMask={() => activateSelection('wand-mask')}
              onClearPaintMask={() => clearPaintMask(selected.id)}
            />
          )}
          {mobileSheet === 'more' && (
            <MoreMenu
              onAction={(action) => {
                if (action === 'new') navigate('new')
                else if (action === 'export') setExportOpen(true)
                else if (action === 'grid') setGridVisible((visible) => !visible)
                else if (action === 'rulers') toggleGuides()
                else if (action === 'artboards') { openArtboardManager(); return }
                else if (action === 'mouse') { setMobileSheet('mouse'); return }
                else if (action === 'settings') { setMobileSheet('properties'); return }
                else if (action === 'brush') { activateMaskBrush(); return }
                else if (action === 'object-select' || action === 'pen' || action === 'zoom' || action === 'corner') setActiveTool(action)
                setMobileSheet(null)
              }}
            />
          )}
        </MobileSheetView>
      )}

      {exportOpen && (
        <ExportDialog
          projectName={projectName}
          documentMeta={documentMeta}
          layers={layers}
          artboards={exportArtboards}
          onClose={() => setExportOpen(false)}
          onSuccess={(message) => { setExportOpen(false); showToast(message) }}
        />
      )}

      <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*" multiple onChange={handleImageUpload} />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

interface TopBarProps {
  projectName: string
  setProjectName: (name: string) => void
  renaming: boolean
  setRenaming: (value: boolean) => void
  savingState: 'Saving' | 'Saved' | 'Not saved'
  onSave: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onHome: () => void
  onNew: () => void
  onExport: () => void
  theme: Theme
  onToggleTheme: () => void
  onShare: () => void
}

function TopBar(props: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-brand-zone">
        <button className="brand-button" onClick={props.onHome} aria-label="Go to home" title="Home">
          <LogoMark />
          <span className="brand-word">Pocketboard</span>
        </button>
        <button className="editor-new-button" onClick={props.onNew} aria-label="Create new design" title="New design · Ctrl N">
          <Plus size={15} />
          <span>New</span>
        </button>
      </div>
      <div className="topbar-document-zone">
        <button className="mobile-back icon-button ghost" onClick={props.onHome} aria-label="Back to home"><ArrowLeft size={21} /></button>
        <div className="document-title-wrap">
          {props.renaming ? (
            <input
              autoFocus
              className="document-title-input"
              value={props.projectName}
              onChange={(event) => props.setProjectName(event.target.value)}
              onBlur={() => props.setRenaming(false)}
              onKeyDown={(event) => event.key === 'Enter' && props.setRenaming(false)}
              aria-label="Project name"
            />
          ) : (
            <button className="document-title" onClick={() => props.setRenaming(true)} title="Rename design">
              <span>{props.projectName}</span><ChevronDown size={14} />
            </button>
          )}
          <span className={`save-status ${props.savingState.toLowerCase().replace(' ', '-')}`}><span className="status-dot" />{props.savingState}</span>
        </div>
        <div className="history-controls">
          <IconButton label="Undo" shortcut="Ctrl Z" onClick={props.onUndo} disabled={!props.canUndo}><Undo2 /></IconButton>
          <IconButton label="Redo" shortcut="Ctrl Shift Z" onClick={props.onRedo} disabled={!props.canRedo}><Redo2 /></IconButton>
        </div>
      </div>
      <div className="topbar-actions">
        <button className="button secondary save-button" aria-label="Save design" title="Save on this device · Ctrl S" onClick={props.onSave}><Save size={17} /><span>Save</span></button>
        <IconButton className="theme-button" label={props.theme === 'light' ? 'Use dark theme' : 'Use light theme'} onClick={props.onToggleTheme}>
          {props.theme === 'light' ? <Moon /> : <Sun />}
        </IconButton>
        <button className="button secondary share-button" onClick={props.onShare}><Share2 size={17} /><span>Share</span></button>
        <button className="button primary export-button" onClick={props.onExport}><Download size={17} /><span>Export</span></button>
      </div>
    </header>
  )
}

type EditorMenuProps = {
  onNew: () => void; onSave: () => void; onImport: () => void; onExport: () => void
  onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean
  onDuplicate: () => void; onDelete: () => void; hasSelection: boolean
  onDeselect: () => void; onSelectTool: () => void; onObjectSelect: () => void
  onGrid: () => void; gridVisible: boolean; onGuides: () => void; guidesVisible: boolean
  onZoomIn: () => void; onZoomOut: () => void; onMouseSettings: () => void
  onBrowseShapes: () => void; onInsertStarburst: () => void; onInsertSunburst: () => void
}

function EditorMenu(props: EditorMenuProps) {
  const [open, setOpen] = useState<string | null>(null)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(null)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  const groups = [
    { name: 'File', items: [
      { label: 'New design', action: props.onNew },
      { label: 'Save', action: props.onSave },
      { label: 'Import from device', action: props.onImport },
      { label: 'Export', action: props.onExport },
    ] },
    { name: 'Edit', items: [
      { label: 'Undo', action: props.onUndo, disabled: !props.canUndo },
      { label: 'Redo', action: props.onRedo, disabled: !props.canRedo },
      { label: 'Duplicate', action: props.onDuplicate, disabled: !props.hasSelection },
      { label: 'Delete', action: props.onDelete, disabled: !props.hasSelection },
    ] },
    { name: 'Select', items: [
      { label: 'Select tool', action: props.onSelectTool },
      { label: 'Object selection', action: props.onObjectSelect },
      { label: 'Deselect', action: props.onDeselect, disabled: !props.hasSelection },
    ] },
    { name: 'Insert', items: [
      { label: 'Browse shapes', action: props.onBrowseShapes },
      { label: 'Starburst', action: props.onInsertStarburst },
      { label: 'Sunburst', action: props.onInsertSunburst },
    ] },
    { name: 'View', items: [
      { label: props.gridVisible ? 'Hide grid' : 'Show grid', action: props.onGrid },
      { label: props.guidesVisible ? 'Hide guides' : 'Show guides', action: props.onGuides },
      { label: 'Zoom in', action: props.onZoomIn },
      { label: 'Zoom out', action: props.onZoomOut },
      { label: 'Mouse settings', action: props.onMouseSettings },
    ] },
  ]
  return <nav className="editor-menu" ref={ref} aria-label="Editor menu" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null)
  }} onKeyDown={(event) => {
    event.stopPropagation()
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(null)
      ref.current?.querySelector<HTMLButtonElement>(`[data-menu-button="${open}"]`)?.focus()
    }
  }}>
    {groups.map((group) => <div className="editor-menu-group" key={group.name}>
      <button className={open === group.name ? 'active' : ''} data-menu-button={group.name} aria-expanded={open === group.name} onClick={() => setOpen(open === group.name ? null : group.name)}>{group.name}</button>
      {open === group.name && <div className="editor-menu-popup" aria-label={`${group.name} options`}>
        {group.items.map((item) => <button key={item.label} disabled={item.disabled} onClick={() => { setOpen(null); item.action() }}>{item.label}</button>)}
      </div>}
    </div>)}
  </nav>
}

function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <span className="logo-cut" />
    </span>
  )
}

function IconButton({ label, shortcut, onClick, disabled, active, className = '', children }: {
  label: string
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <button
      className={`icon-button ghost ${active ? 'active' : ''} ${className}`}
      aria-label={label}
      title={shortcut ? `${label} · ${shortcut}` : label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function ToolRail({ activeTool, onTool, onGrid, onGuides, onAddArtboard }: { activeTool: Tool; onTool: (tool: Tool) => void; onGrid: () => void; onGuides: () => void; onAddArtboard: () => void }) {
  const tools: { id: Tool; label: string; shortcut?: string; icon: ReactNode; divider?: boolean }[] = [
    { id: 'select', label: 'Select', shortcut: 'V', icon: <MousePointer2 /> },
    { id: 'object-select', label: 'Object selection', shortcut: 'Q', icon: <ScanSearch /> },
    { id: 'hand', label: 'Hand tool', shortcut: 'H', icon: <Hand /> },
    { id: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: <Square />, divider: true },
    { id: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: <Circle /> },
    { id: 'polygon', label: 'Polygon', shortcut: 'U', icon: <Hexagon /> },
    { id: 'star', label: 'Star', icon: <Star /> },
    { id: 'line', label: 'Line', shortcut: 'L', icon: <Minus /> },
    { id: 'pen', label: 'Pen tool', shortcut: 'P', icon: <PenTool />, divider: true },
    { id: 'brush', label: 'Mask brush', shortcut: 'B', icon: <Brush /> },
    { id: 'polygon-mask', label: 'Polygonal mask selection', icon: <Hexagon /> },
    { id: 'wand-mask', label: 'Magic wand mask selection', icon: <Sparkles /> },
    { id: 'corner', label: 'Corner tool', icon: <Spline /> },
    { id: 'text', label: 'Text', shortcut: 'T', icon: <Type />, divider: true },
    { id: 'image', label: 'Place image', icon: <ImageIcon /> },
    { id: 'zoom', label: 'Zoom tool', shortcut: 'Z', icon: <ZoomIn />, divider: true },
  ]
  return (
    <nav className="tool-rail" aria-label="Design tools">
      <div className="tool-stack tool-stack-scroll">
        {tools.map((tool) => (
          <div key={tool.id} className={tool.divider ? 'tool-divider-before' : ''}>
            <IconButton label={tool.label} shortcut={tool.shortcut} active={activeTool === tool.id} onClick={() => onTool(tool.id)}>{tool.icon}</IconButton>
          </div>
        ))}
      </div>
      <div className="tool-stack rail-bottom">
        <IconButton label="Add artboard" onClick={onAddArtboard}><Frame /></IconButton>
        <IconButton label="Rulers and guides" onClick={onGuides}><Ruler /></IconButton>
        <IconButton label="Layout grid" onClick={onGrid}><Grid3X3 /></IconButton>
      </div>
    </nav>
  )
}

interface LayersPanelProps {
  layers: DesignLayer[]
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleVisible: (layer: DesignLayer) => void
  onToggleLock: (layer: DesignLayer) => void
  onToggleBlur: (layer: DesignLayer) => void
  onAdd: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onReorder: (topToBottomIds: string[]) => void
  insideSheet?: boolean
}

function LayersPanel(props: LayersPanelProps) {
  const [query, setQuery] = useState('')
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [reorderAnnouncement, setReorderAnnouncement] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const dragOrderRef = useRef<string[] | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => dragCleanupRef.current?.(), [])

  const panelOrder = dragOrder || [...props.layers].reverse().map((layer) => layer.id)
  const byId = new Map(props.layers.map((layer) => [layer.id, layer]))
  const visibleLayers = panelOrder
    .map((id) => byId.get(id))
    .filter((layer): layer is DesignLayer => Boolean(layer))
    .filter((layer) => layer.name.toLowerCase().includes(query.toLowerCase()))

  const announceOrder = (id: string, order: string[]) => {
    const layer = byId.get(id)
    if (layer) setReorderAnnouncement(`${layer.name} moved to position ${order.indexOf(id) + 1} of ${order.length}.`)
  }

  const startReorder = (event: ReactPointerEvent<HTMLButtonElement>, layer: DesignLayer) => {
    event.stopPropagation()
    if (query) return
    event.preventDefault()
    const pointerId = event.pointerId
    const order = [...props.layers].reverse().map((item) => item.id)
    dragOrderRef.current = order
    setDragOrder(order)
    setDraggingId(layer.id)

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      dragCleanupRef.current = null
    }
    const finish = (commit: boolean) => {
      const finalOrder = dragOrderRef.current
      cleanup()
      dragOrderRef.current = null
      setDragOrder(null)
      setDraggingId(null)
      if (commit && finalOrder && finalOrder.some((id, index) => id !== order[index])) {
        props.onReorder(finalOrder)
        announceOrder(layer.id, finalOrder)
      }
    }
    const updateOrderAtPoint = (clientX: number, clientY: number) => {
      const row = (document.elementFromPoint(clientX, clientY) as HTMLElement | null)?.closest<HTMLElement>('.layer-row[data-layer-id]')
      const targetId = row?.dataset.layerId
      const current = dragOrderRef.current
      if (!targetId || !current || !row || !listRef.current?.contains(row) || targetId === layer.id) return
      const from = current.indexOf(layer.id)
      const to = current.indexOf(targetId)
      if (from < 0 || to < 0 || from === to) return
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      dragOrderRef.current = next
      setDragOrder(next)
    }
    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      moveEvent.preventDefault()
      const list = listRef.current
      if (list) {
        const bounds = list.getBoundingClientRect()
        if (moveEvent.clientY < bounds.top + 40) list.scrollTop -= 18
        else if (moveEvent.clientY > bounds.bottom - 40) list.scrollTop += 18
      }
      updateOrderAtPoint(moveEvent.clientX, moveEvent.clientY)
    }
    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      updateOrderAtPoint(upEvent.clientX, upEvent.clientY)
      finish(true)
    }
    const onCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId === pointerId) finish(false)
    }
    dragCleanupRef.current = cleanup
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  const reorderWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>, layer: DesignLayer) => {
    if (query || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    event.stopPropagation()
    const order = [...props.layers].reverse().map((item) => item.id)
    const from = order.indexOf(layer.id)
    const to = from + (event.key === 'ArrowUp' ? -1 : 1)
    if (from < 0 || to < 0 || to >= order.length) return
    ;[order[from], order[to]] = [order[to], order[from]]
    props.onReorder(order)
    announceOrder(layer.id, order)
  }

  return (
    <div className={`panel-inner layers-inner ${props.insideSheet ? 'inside-sheet' : ''}`}>
      {!props.insideSheet && (
        <div className="panel-header">
          <div><h2>Layers</h2><span className="count-badge">{props.layers.length}</span></div>
          <IconButton label="Add layer" onClick={props.onAdd}><Plus /></IconButton>
        </div>
      )}
      <div className="panel-tabs" role="tablist">
        <button className="panel-tab active" role="tab" aria-selected="true">Layers</button>
        <button className="panel-tab" role="tab" aria-selected="false">Assets</button>
      </div>
      <label className="search-field">
        <Search size={15} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search layers" aria-label="Search layers" />
        {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
      </label>
      <div className="layer-order-hint"><GripVertical size={12} /><span>{query ? 'Clear search to reorder' : 'Drag layers to reorder'}</span></div>
      <div ref={listRef} className={`layer-list ${draggingId ? 'is-reordering' : ''}`} role="listbox" aria-label="Canvas layers">
        {visibleLayers.length ? visibleLayers.map((layer) => (
          <div
            key={layer.id}
            role="option"
            aria-selected={props.selectedId === layer.id}
            data-layer-id={layer.id}
            className={`layer-row ${props.selectedId === layer.id ? 'selected' : ''} ${!layer.visible ? 'muted' : ''} ${draggingId === layer.id ? 'dragging' : ''}`}
            onClick={() => props.onSelect(layer.id)}
          >
            <button
              className="row-grip"
              disabled={Boolean(query)}
              aria-label={`Reorder ${layer.name}; drag or use the arrow keys`}
              title={query ? 'Clear search to reorder layers' : `Drag to reorder ${layer.name}`}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => startReorder(event, layer)}
              onKeyDown={(event) => reorderWithKeyboard(event, layer)}
            ><GripVertical size={14} /></button>
            <LayerThumbnail layer={layer} />
            <span className="layer-name">{layer.name}</span>
            {layer.blur && <button className={`row-action blur-toggle ${layer.blur.enabled ? 'is-active' : ''}`} aria-label={`${layer.blur.enabled ? 'Disable' : 'Enable'} blur for ${layer.name}`} aria-pressed={layer.blur.enabled} title={`${layer.blur.enabled ? 'Disable' : 'Enable'} blur`} onClick={(event) => { event.stopPropagation(); props.onToggleBlur(layer) }}><Sparkles size={14} /></button>}
            <button className="row-action" aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`} onClick={(event) => { event.stopPropagation(); props.onToggleVisible(layer) }}>
              {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
            <button className={`row-action ${layer.locked ? 'is-active' : ''}`} aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`} onClick={(event) => { event.stopPropagation(); props.onToggleLock(layer) }}>
              {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>
        )) : (
          <div className="empty-layers"><Layers3 size={28} /><p>{query ? 'No layers match your search.' : 'No layers yet.'}</p><button className="button secondary" onClick={props.onAdd}>Add a shape</button></div>
        )}
      </div>
      <span className="visually-hidden" role="status" aria-live="polite">{reorderAnnouncement}</span>
      <div className="panel-footer-actions">
        <IconButton label="Duplicate" shortcut="Ctrl D" onClick={props.onDuplicate} disabled={!props.selectedId}><Copy /></IconButton>
        <IconButton label="Move layer up" onClick={props.onMoveUp} disabled={!props.selectedId}><ArrowUp /></IconButton>
        <IconButton label="Move layer down" onClick={props.onMoveDown} disabled={!props.selectedId}><ArrowDown /></IconButton>
        <span className="footer-spacer" />
        <IconButton label="Delete layer" onClick={props.onDelete} disabled={!props.selectedId} className="danger-icon"><Trash2 /></IconButton>
      </div>
    </div>
  )
}

function LayerThumbnail({ layer }: { layer: DesignLayer }) {
  if (layer.type === 'text') return <span className="layer-thumbnail icon"><Type size={15} /></span>
  if (layer.type === 'image') return <span className="layer-thumbnail image" style={{ backgroundImage: `url(${layer.src})` }} />
  if (layer.type === 'ellipse') return <span className="layer-thumbnail icon"><Circle size={15} style={{ color: layer.fill }} /></span>
  if (layer.type === 'polygon') return <span className="layer-thumbnail icon"><Hexagon size={15} style={{ color: layer.fill }} /></span>
  if (layer.type === 'star') return <span className="layer-thumbnail icon"><Star size={15} style={{ color: layer.fill }} /></span>
  if (layer.type === 'path') return <span className="layer-thumbnail icon"><PenTool size={15} /></span>
  if (layer.type === 'brush') return <span className="layer-thumbnail icon"><Brush size={15} /></span>
  if (layer.type === 'line') return <span className="layer-thumbnail icon"><Minus size={15} /></span>
  return <span className="layer-thumbnail color" style={{ background: layer.fill }} />
}

interface CanvasProps {
  artboardRef: React.RefObject<SVGSVGElement>
  documentMeta: DesignDocument
  layers: DesignLayer[]
  selected: DesignLayer | null
  activeTool: Tool
  zoom: number
  mouseSettings: MouseSettings
  gridVisible: boolean
  gridSize: number
  guidesVisible: boolean
  userGuides: CanvasGuide[]
  editingTextId: string | null
  maskBrushMode: MaskBrushMode
  maskBrushSize: number
  selectionMode: 'keep' | 'hide'
  onSelectionMode: (mode: 'keep' | 'hide') => void
  selectionTolerance: number
  onSelectionTolerance: (value: number) => void
  selectionFeather: number
  onSelectionFeather: (value: number) => void
  onApplyMaskSelection: (id: string, selection: MaskSelection, source: DesignLayer) => void
  onSelectionError: (message: string) => void
  onFinishSelection: () => void
  pickingColor: boolean
  onPickColor: (point: Point) => void
  onSelect: (id: string | null) => void
  onAddLayer: (type: LayerType, point?: { x: number; y: number }, preset?: Partial<DesignLayer>) => string
  onAddPath: (points: Point[], type: 'path' | 'brush', closed?: boolean) => void
  onAddMaskStroke: (id: string, stroke: MaskBrushStroke) => void
  onBeginTextEdit: (id: string) => void
  onCommitText: (id: string, patch: Partial<DesignLayer>) => void
  onFinishTextEdit: () => void
  onOpenArtboards: () => void
  onZoom: (delta: number) => void
  onSetZoom: (zoom: number) => void
  onUpdateGuide: (id: string, position: number) => void
  onDeleteGuide: (id: string) => void
  onUpdateLive: (id: string, patch: Partial<DesignLayer>) => void
  onCommitSnapshot: (layers: DesignLayer[]) => void
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

type TransformState = {
  mode: 'move' | 'resize' | 'rotate' | 'corner' | 'crop'
  id: string
  pointerId: number
  startClientX: number
  startClientY: number
  original: DesignLayer
  snapshot: DesignLayer[]
  handle?: ResizeHandle
  moved: boolean
}

type SmartGuideState = { x?: number; y?: number }

type PinchState = {
  pointerIds: [number, number]
  startDistance: number
  startZoom: number
  focusX: number
  focusY: number
}

type PendingPinchFocus = {
  clientX: number
  clientY: number
  focusX: number
  focusY: number
}

function Canvas(props: CanvasProps) {
  const onAddPath = props.onAddPath
  const transformRef = useRef<TransformState | null>(null)
  const lastTextTapRef = useRef<{ id: string; time: number; x: number; y: number; pointerType: string } | null>(null)
  const transformCleanupRef = useRef<(() => void) | null>(null)
  const maskStrokeCleanupRef = useRef<(() => void) | null>(null)
  const layersRef = useRef(props.layers)
  const scrollRef = useRef<HTMLDivElement>(null)
  const touchPointersRef = useRef(new Map<number, Point>())
  const mousePanCleanupRef = useRef<(() => void) | null>(null)
  const pinchRef = useRef<PinchState | null>(null)
  const pendingPinchFocusRef = useRef<PendingPinchFocus | null>(null)
  const zoomRef = useRef(props.zoom)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null)
  const longPressPointerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const cancelLongPressRef = useRef<(() => void) | null>(null)
  const [smartGuides, setSmartGuides] = useState<SmartGuideState>({})
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [isPinching, setIsPinching] = useState(false)
  const [wheelZooming, setWheelZooming] = useState(false)
  const wheelZoomTimerRef = useRef<number | null>(null)
  const pickGestureRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const selectionGestureRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const selectionRequestRef = useRef(0)
  const [selectionPoints, setSelectionPoints] = useState<Point[]>([])
  const [selectionBusy, setSelectionBusy] = useState(false)
  useEffect(() => { selectionRequestRef.current++; setSelectionPoints([]); setSelectionBusy(false) }, [props.activeTool, props.selected?.id])
  const [pickCursor, setPickCursor] = useState<Point>({ x: props.documentMeta.width / 2, y: props.documentMeta.height / 2 })
  useEffect(() => {
    if (props.pickingColor) {
      lastTextTapRef.current = null
      setPickCursor({ x: props.documentMeta.width / 2, y: props.documentMeta.height / 2 })
    }
  }, [props.pickingColor, props.documentMeta.width, props.documentMeta.height])
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const draftPointsRef = useRef<Point[]>([])
  zoomRef.current = props.zoom
  useEffect(() => { layersRef.current = props.layers }, [props.layers])
  useEffect(() => { draftPointsRef.current = draftPoints }, [draftPoints])
  useEffect(() => { setDraftPoints([]) }, [props.activeTool])
  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => () => {
    transformCleanupRef.current?.()
    maskStrokeCleanupRef.current?.()
    cancelLongPressRef.current?.()
    mousePanCleanupRef.current?.()
    if (wheelZoomTimerRef.current !== null) window.clearTimeout(wheelZoomTimerRef.current)
  }, [])
  useLayoutEffect(() => {
    const pending = pendingPinchFocusRef.current
    const scroller = scrollRef.current
    const svg = props.artboardRef.current
    if (!pending || !scroller || !svg) return
    const rect = svg.getBoundingClientRect()
    const focusClientX = rect.left + pending.focusX * rect.width
    const focusClientY = rect.top + pending.focusY * rect.height
    scroller.scrollLeft += focusClientX - pending.clientX
    scroller.scrollTop += focusClientY - pending.clientY
    pendingPinchFocusRef.current = null
  }, [props.artboardRef, props.zoom])

  const wheelAction = props.mouseSettings.wheel
  const artboardRef = props.artboardRef
  const onSetZoom = props.onSetZoom
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const onWheel = (event: WheelEvent) => {
      if (isTextEditorTarget(event.target)) return
      if (wheelAction === 'none') { event.preventDefault(); return }
      if (wheelAction === 'pan') {
        event.preventDefault()
        const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientHeight : 1
        scroller.scrollBy({ left: event.deltaX * factor, top: event.deltaY * factor })
        return
      }
      const svg = artboardRef.current
      if (!svg || !event.deltaY) return
      event.preventDefault()
      const rect = svg.getBoundingClientRect()
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientHeight : 1
      const next = clamp(zoomRef.current * Math.exp(-clamp(event.deltaY * factor, -500, 500) * 0.0015), 5, 6400)
      if (next === zoomRef.current) return
      pendingPinchFocusRef.current = { clientX: event.clientX, clientY: event.clientY, focusX: (event.clientX - rect.left) / Math.max(1, rect.width), focusY: (event.clientY - rect.top) / Math.max(1, rect.height) }
      zoomRef.current = next
      setWheelZooming(true)
      if (wheelZoomTimerRef.current !== null) window.clearTimeout(wheelZoomTimerRef.current)
      wheelZoomTimerRef.current = window.setTimeout(() => setWheelZooming(false), 150)
      onSetZoom(next)
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [artboardRef, wheelAction, onSetZoom])

  const pointerToCanvas = useCallback((clientX: number, clientY: number) => {
    const svg = props.artboardRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: clamp((clientX - rect.left) * props.documentMeta.width / rect.width, 0, props.documentMeta.width),
      y: clamp((clientY - rect.top) * props.documentMeta.height / rect.height, 0, props.documentMeta.height),
    }
  }, [props.artboardRef, props.documentMeta.height, props.documentMeta.width])

  const beginTextEditingWithFocus = (id: string) => {
    // Keep the state change and focus inside the initiating pointer event. Mobile
    // Safari only opens its software keyboard for focus caused by that gesture.
    flushSync(() => props.onBeginTextEdit(id))
    const textarea = props.artboardRef.current?.querySelector<HTMLTextAreaElement>('.text-editor-overlay textarea')
    textarea?.focus({ preventScroll: true })
  }

  const finishPenPath = useCallback((closed = false) => {
    const points = draftPointsRef.current
    if (points.length >= 2) onAddPath(points, 'path', closed)
    setDraftPoints([])
  }, [onAddPath])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (props.activeTool !== 'pen') return
      if (event.key === 'Enter' && draftPointsRef.current.length >= 2) {
        event.preventDefault()
        finishPenPath(false)
      }
      if (event.key === 'Escape') setDraftPoints([])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [finishPenPath, props.activeTool])

  const snapMove = (layer: DesignLayer, x: number, y: number, rect: DOMRect) => {
    let nextX = x
    let nextY = y
    const guides: SmartGuideState = {}
    const thresholdX = 6 * props.documentMeta.width / rect.width
    const thresholdY = 6 * props.documentMeta.height / rect.height

    if (props.gridVisible && props.gridSize > 0) {
      nextX = Math.round(nextX / props.gridSize) * props.gridSize
      nextY = Math.round(nextY / props.gridSize) * props.gridSize
    }

    const xTargets = [0, props.documentMeta.width / 2, props.documentMeta.width]
    const yTargets = [0, props.documentMeta.height / 2, props.documentMeta.height]
    layersRef.current.filter((item) => item.id !== layer.id && item.visible).forEach((item) => {
      xTargets.push(item.x, item.x + item.width / 2, item.x + item.width)
      yTargets.push(item.y, item.y + item.height / 2, item.y + item.height)
    })
    if (props.guidesVisible) {
      props.userGuides.forEach((guide) => {
        if (guide.axis === 'x') xTargets.push(guide.position)
        else yTargets.push(guide.position)
      })
    }

    const ownX = [nextX, nextX + layer.width / 2, nextX + layer.width]
    const ownY = [nextY, nextY + layer.height / 2, nextY + layer.height]
    let bestX = thresholdX + 1
    let bestY = thresholdY + 1
    xTargets.forEach((target) => ownX.forEach((value) => {
      const distance = Math.abs(target - value)
      if (distance < bestX && distance <= thresholdX) {
        bestX = distance
        nextX += target - value
        guides.x = target
        ownX.splice(0, ownX.length, nextX, nextX + layer.width / 2, nextX + layer.width)
      }
    }))
    yTargets.forEach((target) => ownY.forEach((value) => {
      const distance = Math.abs(target - value)
      if (distance < bestY && distance <= thresholdY) {
        bestY = distance
        nextY += target - value
        guides.y = target
        ownY.splice(0, ownY.length, nextY, nextY + layer.height / 2, nextY + layer.height)
      }
    }))
    setSmartGuides(guides)
    return { x: nextX, y: nextY }
  }

  const onCanvasPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && !isTextEditorTarget(event.target)) {
      const action = event.button === 0 ? props.mouseSettings.left : event.button === 1 ? props.mouseSettings.middle : event.button === 2 ? props.mouseSettings.right : 'default'
      if (action === 'pan') {
        event.preventDefault()
        event.stopPropagation()
        mousePanCleanupRef.current?.()
        const scroller = event.currentTarget
        const startX = event.clientX, startY = event.clientY
        const left = scroller.scrollLeft, top = scroller.scrollTop, pointerId = event.pointerId
        const move = (next: PointerEvent) => {
          if (next.pointerId !== pointerId) return
          scroller.scrollLeft = left - (next.clientX - startX)
          scroller.scrollTop = top - (next.clientY - startY)
        }
        const cleanup = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', finish)
          mousePanCleanupRef.current = null
        }
        const finish = (next: PointerEvent) => { if (next.pointerId === pointerId) cleanup() }
        mousePanCleanupRef.current = cleanup
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', finish)
        window.addEventListener('pointercancel', finish)
        return
      }
      if (action === 'none' || event.button !== 0) {
        if (action === 'none') event.preventDefault()
        event.stopPropagation()
      }
      return
    }
    if (event.pointerType !== 'touch' || isTextEditorTarget(event.target)) return
    const pointers = touchPointersRef.current
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer capture is best-effort on older mobile browsers */ }

    if (pointers.size < 2 || pinchRef.current) return
    pickGestureRef.current = null
    selectionGestureRef.current = null
    const entries = [...pointers.entries()].slice(0, 2) as [[number, Point], [number, Point]]
    const [[firstId, first], [secondId, second]] = entries
    const svg = props.artboardRef.current
    if (!svg) return

    lastTextTapRef.current = null
    transformCleanupRef.current?.()
    maskStrokeCleanupRef.current?.()
    cancelLongPressRef.current?.()
    setSmartGuides({})
    const rect = svg.getBoundingClientRect()
    const midpointX = (first.x + second.x) / 2
    const midpointY = (first.y + second.y) / 2
    pinchRef.current = {
      pointerIds: [firstId, secondId],
      startDistance: Math.max(8, Math.hypot(second.x - first.x, second.y - first.y)),
      startZoom: zoomRef.current,
      focusX: (midpointX - rect.left) / Math.max(1, rect.width),
      focusY: (midpointY - rect.top) / Math.max(1, rect.height),
    }
    setIsPinching(true)
    for (const pointerId of [firstId, secondId]) {
      try { event.currentTarget.setPointerCapture(pointerId) } catch { /* continue without capture */ }
    }
    event.preventDefault()
  }

  const onCanvasPointerMoveCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || !touchPointersRef.current.has(event.pointerId)) return
    touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const pinch = pinchRef.current
    if (!pinch || !pinch.pointerIds.includes(event.pointerId)) return
    const first = touchPointersRef.current.get(pinch.pointerIds[0])
    const second = touchPointersRef.current.get(pinch.pointerIds[1])
    if (!first || !second) return

    const distance = Math.max(8, Math.hypot(second.x - first.x, second.y - first.y))
    const midpointX = (first.x + second.x) / 2
    const midpointY = (first.y + second.y) / 2
    const nextZoom = clamp(pinch.startZoom * distance / pinch.startDistance, 5, 6400)
    pendingPinchFocusRef.current = {
      clientX: midpointX,
      clientY: midpointY,
      focusX: pinch.focusX,
      focusY: pinch.focusY,
    }
    props.onSetZoom(nextZoom)
    event.preventDefault()
  }

  const onCanvasSurfacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    props.onSelect(null)
  }

  const normalizedSelectionPoint = (point: Point, layer: DesignLayer) => {
    const cx = layer.x + layer.width / 2, cy = layer.y + layer.height / 2
    const angle = -layer.rotation * Math.PI / 180
    const dx = point.x - cx, dy = point.y - cy
    let x = cx + dx * Math.cos(angle) - dy * Math.sin(angle)
    let y = cy + dx * Math.sin(angle) + dy * Math.cos(angle)
    if (layer.flipX) x = 2 * cx - x
    if (layer.flipY) y = 2 * cy - y
    return { x: (x - layer.x) / Math.max(1, layer.width), y: (y - layer.y) / Math.max(1, layer.height) }
  }

  const applyPolygonSelection = () => {
    const layer = props.selected
    if (!layer || layer.type !== 'image' || layer.locked || selectionPoints.length < 3) return
    props.onApplyMaskSelection(layer.id, { kind: 'polygon', points: selectionPoints, mode: props.selectionMode, feather: props.selectionFeather }, layer)
    setSelectionPoints([])
    props.onFinishSelection()
  }

  const selectAt = (point: Point) => {
    const layer = props.selected
    if (!layer || layer.type !== 'image' || layer.locked || selectionBusy) return
    const local = normalizedSelectionPoint(point, layer)
    if (props.activeTool === 'polygon-mask') { setSelectionPoints((points) => [...points, local]); return }
    if (props.activeTool !== 'wand-mask') return
    if (local.x < 0 || local.x > 1 || local.y < 0 || local.y > 1) { props.onSelectionError('Tap inside the selected image.'); return }
    const request = ++selectionRequestRef.current
    setSelectionBusy(true)
    void magicWandMask(layer, local, props.selectionTolerance, props.selectionMode).then((image) => {
      if (request !== selectionRequestRef.current) return
      props.onApplyMaskSelection(layer.id, { kind: 'wand', image, mode: props.selectionMode, feather: props.selectionFeather }, layer)
      props.onFinishSelection()
    }).catch(() => { if (request === selectionRequestRef.current) props.onSelectionError('Could not read this image for the magic wand.') }).finally(() => { if (request === selectionRequestRef.current) setSelectionBusy(false) })
  }

  const finishCanvasPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const selectionGesture = selectionGestureRef.current
    if (selectionGesture?.pointerId === event.pointerId) {
      selectionGestureRef.current = null
      if (event.type === 'pointerup' && !pinchRef.current && Math.hypot(event.clientX - selectionGesture.x, event.clientY - selectionGesture.y) < 10) selectAt(pointerToCanvas(event.clientX, event.clientY))
    }
    const gesture = pickGestureRef.current
    if (gesture?.pointerId === event.pointerId) {
      pickGestureRef.current = null
      const rect = props.artboardRef.current?.getBoundingClientRect()
      if (props.pickingColor && event.type === 'pointerup' && !pinchRef.current && rect && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 10 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        props.onPickColor(pointerToCanvas(event.clientX, event.clientY))
      }
    }
    if (event.pointerType !== 'touch') return
    touchPointersRef.current.delete(event.pointerId)
    if (pinchRef.current?.pointerIds.includes(event.pointerId)) {
      pinchRef.current = null
      setIsPinching(false)
    }
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    } catch { /* the browser may already have released it */ }
  }

  const startTransform = (event: ReactPointerEvent, layer: DesignLayer, mode: TransformState['mode'], handle?: TransformState['handle']) => {
    const allowed = (props.activeTool === 'select' && ['move', 'resize', 'rotate'].includes(mode))
      || (props.activeTool === 'corner' && mode === 'corner')
      || (props.activeTool === 'crop' && mode === 'crop')
    if (layer.locked || !allowed || pinchRef.current || (event.pointerType === 'touch' && touchPointersRef.current.size > 1)) return
    event.stopPropagation()
    event.preventDefault()
    transformCleanupRef.current?.()
    props.onSelect(layer.id)
    const pointerId = event.pointerId
    const captureTarget = event.currentTarget as Element
    try { captureTarget.setPointerCapture(pointerId) } catch { /* window listeners remain as a fallback */ }
    transformRef.current = {
      mode, id: layer.id, pointerId, startClientX: event.clientX, startClientY: event.clientY,
      original: { ...layer }, snapshot: cloneLayers(layersRef.current), handle, moved: false,
    }

    const onMove = (moveEvent: PointerEvent) => {
      const state = transformRef.current
      const svg = props.artboardRef.current
      if (!state || state.pointerId !== moveEvent.pointerId || !svg || pinchRef.current) return
      moveEvent.preventDefault()
      const rect = svg.getBoundingClientRect()
      const dx = (moveEvent.clientX - state.startClientX) * props.documentMeta.width / rect.width
      const dy = (moveEvent.clientY - state.startClientY) * props.documentMeta.height / rect.height
      state.moved = state.moved || Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5
      if (state.mode === 'move') {
        const position = snapMove(state.original, state.original.x + dx, state.original.y + dy, rect)
        props.onUpdateLive(state.id, {
          x: clamp(position.x, -state.original.width + 10, props.documentMeta.width - 10),
          y: clamp(position.y, -state.original.height + 10, props.documentMeta.height - 10),
        })
      } else if (state.mode === 'resize') {
        const original = state.original
        const handle = state.handle || 'se'
        const minimumWidth = 20
        const minimumHeight = original.type === 'line' ? 0 : 20
        const angle = original.rotation * Math.PI / 180
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const localDx = dx * cos + dy * sin
        const localDy = -dx * sin + dy * cos
        let width = original.width
        let height = original.height
        const isCorner = handle.length === 2
        const preserveProportions = isCorner && original.type !== 'line' && original.width > 0 && original.height > 0

        if (preserveProportions) {
          const horizontalDirection = handle.includes('e') ? 1 : -1
          const verticalDirection = handle.includes('s') ? 1 : -1
          const vectorX = horizontalDirection * original.width
          const vectorY = verticalDirection * original.height
          const scaleFromPointer = 1 + (localDx * vectorX + localDy * vectorY) / (vectorX * vectorX + vectorY * vectorY)
          const minimumScale = Math.max(minimumWidth / original.width, minimumHeight / original.height)
          const scale = Math.max(minimumScale, scaleFromPointer)
          width = original.width * scale
          height = original.height * scale
        } else {
          if (handle.includes('e')) width = Math.max(minimumWidth, original.width + localDx)
          if (handle.includes('w')) width = Math.max(minimumWidth, original.width - localDx)
          if (handle.includes('s')) height = Math.max(minimumHeight, original.height + localDy)
          if (handle.includes('n')) height = Math.max(minimumHeight, original.height - localDy)
        }

        if (original.type === 'text' && !isCorner && (handle === 'e' || handle === 'w')) {
          const lineHeight = (original.fontSize || 32) * (original.lineHeight || 1.2)
          height = Math.max(lineHeight, textLines({ ...original, width, textWrap: true }).length * lineHeight)
        }

        const shiftX = handle.includes('e')
          ? (width - original.width) / 2
          : handle.includes('w') ? -(width - original.width) / 2 : 0
        const shiftY = original.type === 'text' && !isCorner && (handle === 'e' || handle === 'w')
          ? (height - original.height) / 2
          : handle.includes('s')
          ? (height - original.height) / 2
          : handle.includes('n') ? -(height - original.height) / 2 : 0
        const worldShiftX = shiftX * cos - shiftY * sin
        const worldShiftY = shiftX * sin + shiftY * cos
        const originalCenterX = original.x + original.width / 2
        const originalCenterY = original.y + original.height / 2
        props.onUpdateLive(state.id, {
          x: originalCenterX + worldShiftX - width / 2,
          y: originalCenterY + worldShiftY - height / 2,
          width,
          height,
          ...(original.type === 'text' && !isCorner && (handle === 'e' || handle === 'w') ? { textWrap: true } : {}),
          ...(original.type === 'text' && isCorner && original.height > 0 ? {
            fontSize: (original.fontSize || 32) * height / original.height,
            ...(original.letterSpacing !== undefined ? { letterSpacing: original.letterSpacing * height / original.height } : {}),
          } : {}),
        })
      } else if (state.mode === 'rotate') {
        const point = pointerToCanvas(moveEvent.clientX, moveEvent.clientY)
        const cx = state.original.x + state.original.width / 2
        const cy = state.original.y + state.original.height / 2
        const angle = Math.atan2(point.y - cy, point.x - cx) * 180 / Math.PI + 90
        props.onUpdateLive(state.id, { rotation: Math.round(angle * 10) / 10 })
      } else if (state.mode === 'corner') {
        const maximum = Math.min(state.original.width, Math.max(state.original.height, 20)) / 2
        props.onUpdateLive(state.id, { radius: clamp((state.original.radius || 0) + dx, 0, maximum) })
      } else if (state.mode === 'crop') {
        const scale = state.original.imageScale || 1
        const maxX = state.original.width * Math.max(0, scale - 1) / 2
        const maxY = state.original.height * Math.max(0, scale - 1) / 2
        props.onUpdateLive(state.id, {
          imageOffsetX: clamp((state.original.imageOffsetX || 0) + dx, -maxX, maxX),
          imageOffsetY: clamp((state.original.imageOffsetY || 0) + dy, -maxY, maxY),
        })
      }
    }

    let finished = false
    function finish(commit: boolean) {
      if (finished) return
      finished = true
      const state = transformRef.current
      if (state?.pointerId === pointerId) {
        if (state.moved && commit) props.onCommitSnapshot(state.snapshot)
        else if (state.moved) props.onUpdateLive(state.id, state.original)
        lastTextTapRef.current = commit && !state.moved && state.mode === 'move' && state.original.type === 'text'
          ? { id: state.id, time: Date.now(), x: state.startClientX, y: state.startClientY, pointerType: event.pointerType }
          : null
        transformRef.current = null
      }
      setSmartGuides({})
      try {
        if (captureTarget.hasPointerCapture(pointerId)) captureTarget.releasePointerCapture(pointerId)
      } catch { /* the pointer may already be released */ }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      if (transformCleanupRef.current === cancelTransform) transformCleanupRef.current = null
    }
    function onUp(upEvent: PointerEvent) {
      if (upEvent.pointerId === pointerId) finish(true)
    }
    function onCancel(cancelEvent: PointerEvent) {
      if (cancelEvent.pointerId === pointerId) finish(false)
    }
    function cancelTransform() { finish(false) }
    transformCleanupRef.current = cancelTransform
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  const startMaskStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    const layer = props.selected
    if (!layer || layer.locked || pinchRef.current) return
    event.preventDefault()
    maskStrokeCleanupRef.current?.()
    const pointerId = event.pointerId
    const captureTarget = event.currentTarget
    try { captureTarget.setPointerCapture(pointerId) } catch { /* window listeners remain as a fallback */ }
    const points = [pointerToCanvas(event.clientX, event.clientY)]
    setDraftPoints(points)

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId || pinchRef.current) return
      moveEvent.preventDefault()
      const point = pointerToCanvas(moveEvent.clientX, moveEvent.clientY)
      const previous = points[points.length - 1]
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < 2) return
      points.push(point)
      setDraftPoints([...points])
    }
    let finished = false
    const finish = (commit: boolean) => {
      if (finished) return
      finished = true
      if (commit && points.length > 1) {
        const angle = -layer.rotation * Math.PI / 180
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const cx = layer.x + layer.width / 2
        const cy = layer.y + layer.height / 2
        const normalized = points.map((point) => {
          const dx = point.x - cx
          const dy = point.y - cy
          const rotatedX = cx + dx * cos - dy * sin
          const rotatedY = cy + dx * sin + dy * cos
          const localX = layer.flipX ? cx * 2 - rotatedX : rotatedX
          const localY = layer.flipY ? cy * 2 - rotatedY : rotatedY
          return {
            x: (localX - layer.x) / Math.max(1, layer.width),
            y: (localY - layer.y) / Math.max(1, layer.height),
          }
        })
        props.onAddMaskStroke(layer.id, {
          points: normalized,
          size: props.maskBrushSize / Math.max(1, Math.max(layer.width, layer.height)),
          mode: props.maskBrushMode,
        })
      }
      setDraftPoints([])
      try {
        if (captureTarget.hasPointerCapture(pointerId)) captureTarget.releasePointerCapture(pointerId)
      } catch { /* the pointer may already be released */ }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      maskStrokeCleanupRef.current = null
    }
    const onUp = (upEvent: PointerEvent) => { if (upEvent.pointerId === pointerId) finish(true) }
    const onCancel = (cancelEvent: PointerEvent) => { if (cancelEvent.pointerId === pointerId) finish(false) }
    const onCancelStroke = () => finish(false)
    maskStrokeCleanupRef.current = onCancelStroke
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  const startGuideDrag = (event: ReactPointerEvent, guide: CanvasGuide) => {
    event.stopPropagation()
    event.preventDefault()
    const onMove = (moveEvent: PointerEvent) => {
      const point = pointerToCanvas(moveEvent.clientX, moveEvent.clientY)
      props.onUpdateGuide(guide.id, guide.axis === 'x' ? point.x : point.y)
    }
    const onUp = (upEvent: PointerEvent) => {
      const svg = props.artboardRef.current
      const rect = svg?.getBoundingClientRect()
      if (rect && (upEvent.clientX < rect.left - 20 || upEvent.clientX > rect.right + 20 || upEvent.clientY < rect.top - 20 || upEvent.clientY > rect.bottom + 20)) {
        props.onDeleteGuide(guide.id)
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startArtboardLongPress = (event: ReactPointerEvent<SVGSVGElement>) => {
    const isObjectInteraction = Boolean(closestEventElement(event.target, 'g[data-layer], .selection-overlay'))
    if (event.pointerType !== 'touch' || isTextEditorTarget(event.target) || isObjectInteraction || pinchRef.current || touchPointersRef.current.size > 1 || !['select', 'hand'].includes(props.activeTool)) return
    longPressStartRef.current = { x: event.clientX, y: event.clientY }
    longPressPointerRef.current = event.pointerId
    longPressTriggeredRef.current = false
    const cleanup = () => {
      if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
      longPressStartRef.current = null
      longPressPointerRef.current = null
      longPressTriggeredRef.current = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      if (cancelLongPressRef.current === cleanup) cancelLongPressRef.current = null
    }
    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== longPressPointerRef.current) return
      const start = longPressStartRef.current
      if (start && Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) > 10) cleanup()
    }
    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== longPressPointerRef.current) return
      const shouldOpen = longPressTriggeredRef.current
      if (shouldOpen) {
        upEvent.preventDefault()
        transformCleanupRef.current?.()
      }
      cleanup()
      if (shouldOpen) {
        // Pointer capture can retarget the synthetic click to the newly opened scrim.
        // Consume that click so a completed long-press leaves the manager open.
        const pointerId = upEvent.pointerId
        const suppressSyntheticClick = (clickEvent: MouseEvent) => {
          const clickPointerId = 'pointerId' in clickEvent ? Number(clickEvent.pointerId) : pointerId
          if (clickPointerId !== pointerId) return
          clickEvent.preventDefault()
          clickEvent.stopImmediatePropagation()
          window.removeEventListener('click', suppressSyntheticClick, true)
        }
        window.addEventListener('click', suppressSyntheticClick, true)
        window.setTimeout(() => {
          props.onOpenArtboards()
          window.setTimeout(() => window.removeEventListener('click', suppressSyntheticClick, true), 250)
        }, 0)
      }
    }
    const onCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId === longPressPointerRef.current) cleanup()
    }
    cancelLongPressRef.current = cleanup
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      longPressTriggeredRef.current = true
      if (navigator.vibrate) navigator.vibrate(12)
    }, 550)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  const onLayerPointerDown = (event: ReactPointerEvent<SVGGElement>, layer: DesignLayer) => {
    if (props.activeTool === 'select' && layer.type === 'text' && !layer.locked && !pinchRef.current && (event.pointerType !== 'touch' || touchPointersRef.current.size === 1)) {
      const previous = lastTextTapRef.current
      if (previous && previous.pointerType === event.pointerType && previous.id === layer.id && Date.now() - previous.time < 400 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 30) {
        lastTextTapRef.current = null
        event.stopPropagation()
        event.preventDefault()
        beginTextEditingWithFocus(layer.id)
        return
      }
    }
    if (props.activeTool === 'select') startTransform(event, layer, 'move')
    else if (props.activeTool === 'object-select') {
      event.stopPropagation()
      event.preventDefault()
      props.onSelect(layer.id)
    } else if (props.activeTool === 'corner' && (layer.type === 'rectangle' || (layer.type === 'polygon' && ((layer.shapeKind || 'regular') === 'regular' || layer.shapeKind === 'diamond' || layer.shapeKind === 'starburst')))) {
      event.stopPropagation()
      props.onSelect(layer.id)
    } else if (props.activeTool === 'crop' && layer.type === 'image') {
      startTransform(event, layer, 'crop')
    }
  }

  const onLayerDoubleClick = (event: ReactMouseEvent<SVGGElement>, layer: DesignLayer) => {
    if (layer.type !== 'text' || layer.locked) return
    event.stopPropagation()
    event.preventDefault()
    beginTextEditingWithFocus(layer.id)
  }

  const onBackgroundPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    lastTextTapRef.current = null
    if (pinchRef.current || (event.pointerType === 'touch' && touchPointersRef.current.size > 1)) {
      event.preventDefault()
      return
    }
    if (props.activeTool === 'brush') {
      startMaskStroke(event)
      return
    }
    if (props.activeTool === 'zoom') {
      event.preventDefault()
      const step = props.zoom >= 800 ? 400 : props.zoom >= 200 ? 50 : 15
      props.onZoom(event.altKey ? -step : step)
      return
    }
    if (props.activeTool === 'pen') {
      event.preventDefault()
      const point = pointerToCanvas(event.clientX, event.clientY)
      const existing = draftPointsRef.current
      const svg = props.artboardRef.current
      const rect = svg?.getBoundingClientRect()
      const closeThreshold = rect ? 12 * props.documentMeta.width / rect.width : 20
      if (existing.length >= 3 && Math.hypot(point.x - existing[0].x, point.y - existing[0].y) <= closeThreshold) {
        finishPenPath(true)
      } else if (event.detail >= 2 && existing.length >= 1) {
        props.onAddPath([...existing, point], 'path', false)
        setDraftPoints([])
      } else {
        setDraftPoints((points) => [...points, point])
      }
      return
    }
    if (props.activeTool === 'text') {
      event.preventDefault()
      event.stopPropagation()
      const point = pointerToCanvas(event.clientX, event.clientY)
      props.onAddLayer('text', point)
      return
    }
    if (['rectangle', 'ellipse', 'polygon', 'star', 'line'].includes(props.activeTool)) {
      const point = pointerToCanvas(event.clientX, event.clientY)
      props.onAddLayer(props.activeTool as LayerType, point)
      return
    }
    const target = event.target as SVGElement
    if (target.dataset.layer) return
    if (props.activeTool === 'select' || props.activeTool === 'object-select' || props.activeTool === 'corner' || props.activeTool === 'crop') props.onSelect(null)
  }

  const aspect = props.documentMeta.width / props.documentMeta.height
  const zoomRatio = props.zoom / 68
  const compactLandscape = viewport.width > viewport.height && viewport.width <= 1023 && viewport.height <= 560
  const compactLayout = viewport.width < 600 || compactLandscape
  const sideWidth = compactLayout ? 0 : viewport.width > 1120 ? 590 : viewport.width > 900 ? 544 : 270
  const canvasWidth = viewport.width - sideWidth
  const compactVerticalSpace = compactLandscape ? 178 : 292
  const fitWidth = Math.max(120, Math.min(510, (viewport.height - (compactLayout ? compactVerticalSpace : 200)) * aspect, compactLayout ? viewport.width - 42 : canvasWidth - 96))
  const fitHeight = fitWidth / aspect
  const overflow = Math.max(props.documentMeta.width, props.documentMeta.height, ...props.layers.map((layer) => Math.max(Math.abs(layer.x), Math.abs(layer.y)) + Math.hypot(layer.width, layer.height) + Math.abs(layer.strokeWidth))) * 2 + 100
  const outsidePath = `M ${-overflow} ${-overflow} H ${props.documentMeta.width + overflow} V ${props.documentMeta.height + overflow} H ${-overflow} Z M 0 0 H ${props.documentMeta.width} V ${props.documentMeta.height} H 0 Z`
  const visibleLayers = props.layers.filter((layer) => layer.visible)
  const renderLayers = () => visibleLayers.map((layer) => (
    <LayerElement key={layer.id} layer={layer} editing={props.editingTextId === layer.id}
      onPointerDown={(event) => onLayerPointerDown(event, layer)} onDoubleClick={(event) => onLayerDoubleClick(event, layer)} />
  ))
  return (
    <>
    <div
      ref={scrollRef}
      className={`canvas-scroll ${isPinching || wheelZooming ? 'is-pinching' : ''} ${props.pickingColor ? 'is-picking-color' : ''}`}
      onPointerDownCapture={onCanvasPointerDownCapture}
      onContextMenu={(event) => { if (props.mouseSettings.right !== 'default') event.preventDefault() }}
      onPointerDown={onCanvasSurfacePointerDown}
      onPointerMoveCapture={onCanvasPointerMoveCapture}
      onPointerUpCapture={finishCanvasPointer}
      onPointerCancelCapture={finishCanvasPointer}
    >
      <div className="artboard-zoom-space" style={{ width: fitWidth * zoomRatio, height: fitHeight * zoomRatio }}>
      <div className="artboard-scale" style={{ width: fitWidth, height: fitHeight, transform: `scale(${zoomRatio})`, '--zoom-ratio': zoomRatio, '--artboard-aspect': aspect } as CSSProperties}>
        {props.guidesVisible && <><div className="canvas-ruler ruler-horizontal"><span>0</span><span>{round(props.documentMeta.width / 2)}</span><span>{props.documentMeta.width}</span></div><div className="canvas-ruler ruler-vertical"><span>0</span><span>{round(props.documentMeta.height / 2)}</span><span>{props.documentMeta.height}</span></div></>}
        <svg
          ref={props.artboardRef}
          className="artboard"
          viewBox={`0 0 ${props.documentMeta.width} ${props.documentMeta.height}`}
          role={props.pickingColor || ['polygon-mask', 'wand-mask'].includes(props.activeTool) ? 'application' : 'img'}
          tabIndex={props.pickingColor || ['polygon-mask', 'wand-mask'].includes(props.activeTool) ? 0 : undefined}
          aria-label={['polygon-mask', 'wand-mask'].includes(props.activeTool) ? 'Mask selection. Use arrow keys to move the cursor and Enter to select.' : props.pickingColor ? 'Colour picker. Use arrow keys to move and Enter to pick. Press Escape to cancel.' : `Artboard, ${props.documentMeta.width} by ${props.documentMeta.height} pixels. Long-press to manage artboards.`}
          onKeyDown={(event) => {
            const selectionActive = props.activeTool === 'polygon-mask' || props.activeTool === 'wand-mask'
            if (!props.pickingColor && !selectionActive) return
            const step = event.shiftKey ? 10 : 1
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); if (selectionActive) selectAt(pickCursor); else props.onPickColor(pickCursor); return }
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
            event.preventDefault()
            event.stopPropagation()
            setPickCursor((point) => ({
              x: clamp(point.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), 0, props.documentMeta.width - 1),
              y: clamp(point.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0), 0, props.documentMeta.height - 1),
            }))
          }}
          onPointerDownCapture={(event) => {
            if (props.activeTool === 'polygon-mask' || props.activeTool === 'wand-mask') {
              if (pinchRef.current || (event.pointerType === 'touch' && touchPointersRef.current.size > 1)) return
              event.preventDefault(); event.stopPropagation()
              selectionGestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
              try { scrollRef.current?.setPointerCapture(event.pointerId) } catch { /* best effort */ }
              return
            }
            if (!props.pickingColor) { startArtboardLongPress(event); return }
            if (pinchRef.current || (event.pointerType === 'touch' && touchPointersRef.current.size > 1)) return
            event.preventDefault()
            event.stopPropagation()
            pickGestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
          }}
          onPointerDown={onBackgroundPointerDown}
        >
          <rect width={props.documentMeta.width} height={props.documentMeta.height} fill={props.documentMeta.background} data-artboard-background="true" />
          <defs>
            <pattern id="canvas-grid-pattern" width={props.gridSize} height={props.gridSize} patternUnits="userSpaceOnUse">
              <path d={`M ${props.gridSize} 0 L 0 0 0 ${props.gridSize}`} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </pattern>
            <clipPath id="artboard-inside"><rect width={props.documentMeta.width} height={props.documentMeta.height} /></clipPath>
            <clipPath id="artboard-outside"><path d={outsidePath} clipRule="evenodd" /></clipPath>
            {props.layers.map((layer) => <LayerDefinition key={layer.id} layer={layer} />)}
          </defs>
          <g className="outside-artboard" clipPath="url(#artboard-outside)" opacity="0.48">{renderLayers()}</g>
          <g clipPath="url(#artboard-inside)">{renderLayers()}</g>
          {(props.pickingColor || ['polygon-mask', 'wand-mask'].includes(props.activeTool)) && <circle cx={pickCursor.x} cy={pickCursor.y} r={8 * props.documentMeta.width / Math.max(1, fitWidth * zoomRatio)} fill="none" stroke="#5B4BF0" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          {props.gridVisible && <rect className="canvas-grid-overlay" width={props.documentMeta.width} height={props.documentMeta.height} fill="url(#canvas-grid-pattern)" pointerEvents="none" />}
          {props.guidesVisible && props.userGuides.map((guide) => guide.axis === 'x'
            ? <line key={guide.id} className="user-guide guide-x" x1={guide.position} x2={guide.position} y1="0" y2={props.documentMeta.height} stroke={RULER_GUIDE_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke" onPointerDown={(event) => startGuideDrag(event, guide)} />
            : <line key={guide.id} className="user-guide guide-y" y1={guide.position} y2={guide.position} x1="0" x2={props.documentMeta.width} stroke={RULER_GUIDE_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke" onPointerDown={(event) => startGuideDrag(event, guide)} />)}
          {smartGuides.x !== undefined && <line className="smart-guide" x1={smartGuides.x} x2={smartGuides.x} y1="0" y2={props.documentMeta.height} stroke={GUIDE_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          {smartGuides.y !== undefined && <line className="smart-guide" y1={smartGuides.y} y2={smartGuides.y} x1="0" x2={props.documentMeta.width} stroke={GUIDE_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          {props.activeTool === 'polygon-mask' && props.selected && selectionPoints.length > 0 && <g transform={layerTransform(props.selected)} pointerEvents="none">
            <polyline points={selectionPoints.map((point) => `${props.selected!.x + point.x * props.selected!.width},${props.selected!.y + point.y * props.selected!.height}`).join(' ')} fill="none" stroke={ACCENT} strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
            {selectionPoints.map((point, index) => <circle key={index} cx={props.selected!.x + point.x * props.selected!.width} cy={props.selected!.y + point.y * props.selected!.height} r={5 * props.documentMeta.width / Math.max(1, fitWidth * zoomRatio)} fill="white" stroke={ACCENT} vectorEffect="non-scaling-stroke" />)}
          </g>}
          {draftPoints.length > 0 && props.activeTool === 'brush' && <path className="mask-brush-preview" d={smoothPath(draftPoints, .55)} fill="none" stroke={props.maskBrushMode === 'hide' ? '#FF2D87' : '#12A150'} strokeWidth={props.maskBrushSize} strokeLinecap="round" strokeLinejoin="round" opacity=".58" pointerEvents="none" />}
          {draftPoints.length > 0 && props.activeTool === 'pen' && <g className="pen-draft" pointerEvents="none"><polyline points={draftPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" />{draftPoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={index === 0 && draftPoints.length >= 3 ? 9 : 6} fill="white" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}</g>}
          {props.selected?.visible && props.editingTextId !== props.selected.id && (
            <SelectionOverlay
              layer={props.selected}
              mode={props.activeTool}
              handleScale={props.documentMeta.width / Math.max(1, fitWidth * zoomRatio)}
              onResize={(event, handle) => startTransform(event, props.selected!, 'resize', handle)}
              onRotate={(event) => startTransform(event, props.selected!, 'rotate')}
              onCorner={(event) => startTransform(event, props.selected!, 'corner')}
              onCrop={(event) => startTransform(event, props.selected!, 'crop')}
            />
          )}
          {props.editingTextId && props.selected?.id === props.editingTextId && props.selected.type === 'text' && (
            <TextEditorOverlay
              key={props.selected.id}
              layer={props.selected}
              onUpdate={(patch) => props.onCommitText(props.selected!.id, patch)}
              onFinish={props.onFinishTextEdit}
            />
          )}
        </svg>
        {props.activeTool === 'pen' && <div className="canvas-tool-tip"><PenTool size={14} /> Click to add points · click the first point to close · Enter to finish</div>}
        {props.activeTool === 'object-select' && <div className="canvas-tool-tip"><ScanSearch size={14} /> Tap an object to select it for masking</div>}
        {props.activeTool === 'brush' && <div className="canvas-tool-tip"><Brush size={14} /> {props.maskBrushMode === 'hide' ? 'Brush to hide parts of the selected object' : 'Brush to restore hidden parts'}</div>}
        {props.activeTool === 'zoom' && <div className="canvas-tool-tip"><ZoomIn size={14} /> Click to zoom in · Alt-click to zoom out</div>}
      </div>
      </div>
    </div>
    {(props.activeTool === 'polygon-mask' || props.activeTool === 'wand-mask') && <div className="selection-tool-controls" aria-label="Mask selection controls">
      <span>{props.activeTool === 'polygon-mask' ? 'Tap points around the object' : 'Tap a colour in the image'}</span>
      <label>Action <select aria-label="Selection mask action" value={props.selectionMode} onChange={(event) => props.onSelectionMode(event.target.value as 'keep' | 'hide')}><option value="keep">Keep selection</option><option value="hide">Mask selection out</option></select></label>
      {props.activeTool === 'wand-mask' && <label>Tolerance <input aria-label="Magic wand tolerance" type="number" min="0" max="255" value={props.selectionTolerance} onChange={(event) => props.onSelectionTolerance(clamp(Number(event.target.value), 0, 255))} /></label>}
      <label>Feather <input aria-label="Selection feather" type="number" min="0" max="20" value={props.selectionFeather} onChange={(event) => props.onSelectionFeather(clamp(Number(event.target.value), 0, 20))} /></label>
      {props.activeTool === 'polygon-mask' && <button className="button primary" disabled={selectionPoints.length < 3} onClick={applyPolygonSelection}>Apply selection</button>}
      <button className="button secondary" onClick={props.onFinishSelection}>{selectionBusy ? 'Cancel processing' : 'Cancel'}</button>
      {selectionBusy && <span role="status">Selecting…</span>}
    </div>}
    </>
  )
}

function LayerDefinition({ layer }: { layer: DesignLayer }) {
  const mask = layer.mask || 'none'
  return (
    <>
      {layer.fillType && layer.fillType !== 'solid' && layer.gradient && (
        layer.gradient.type === 'linear'
          ? <linearGradient id={`gradient-${layer.id}`} x1="0" y1="0.5" x2="1" y2="0.5" gradientTransform={`rotate(${layer.gradient.angle} .5 .5)`}>{layer.gradient.stops.map((stop, index) => <stop key={index} offset={`${stop.offset * 100}%`} stopColor={stop.color} />)}</linearGradient>
          : <radialGradient id={`gradient-${layer.id}`} cx="50%" cy="50%" r="70%">{layer.gradient.stops.map((stop, index) => <stop key={index} offset={`${stop.offset * 100}%`} stopColor={stop.color} />)}</radialGradient>
      )}
      {layer.type === 'image' && <clipPath id={`clip-${layer.id}`}>
        {mask === 'ellipse'
          ? <ellipse cx={layer.x + layer.width / 2} cy={layer.y + layer.height / 2} rx={layer.width / 2} ry={layer.height / 2} />
          : mask === 'star'
            ? <polygon points={starPoints(layer.x + layer.width / 2, layer.y + layer.height / 2, Math.min(layer.width, layer.height) / 2, Math.min(layer.width, layer.height) / 4.3)} />
            : <rect x={layer.x} y={layer.y} width={layer.width} height={layer.height} rx={mask === 'rounded' ? Math.min(layer.width, layer.height) * .16 : layer.radius || 0} />}
      </clipPath>}
      {layer.maskSelections?.map((selection, index) => <g key={index}>
        {selection.feather > 0 && <filter id={`selection-feather-${layer.id}-${index}`} filterUnits="userSpaceOnUse" {...selectionFeatherBounds(layer, selection.feather)}><feGaussianBlur stdDeviation={selection.feather} /></filter>}
        <mask id={`selection-mask-${layer.id}-${index}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x={layer.x} y={layer.y} width={layer.width} height={layer.height}>
          <rect x={layer.x} y={layer.y} width={layer.width} height={layer.height} fill={selection.mode === 'keep' ? 'black' : 'white'} />
          {selection.kind === 'polygon'
            ? <polygon points={selection.points.map((point) => `${layer.x + point.x * layer.width},${layer.y + point.y * layer.height}`).join(' ')} fill={selection.mode === 'keep' ? 'white' : 'black'} filter={selection.feather ? `url(#selection-feather-${layer.id}-${index})` : undefined} />
            : <image href={selection.image} x={layer.x} y={layer.y} width={layer.width} height={layer.height} preserveAspectRatio="none" filter={selection.feather ? `url(#selection-feather-${layer.id}-${index})` : undefined} />}
        </mask>
      </g>)}
      {layer.blur?.enabled && layer.blur.type === 'gaussian' && <filter id={`blur-${layer.id}`} filterUnits="userSpaceOnUse" {...gaussianBounds(layer)} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={layer.blur.amount} /></filter>}
      {Boolean(layer.maskStrokes?.length || layer.maskSelections?.length) && (
        <mask id={`paint-mask-${layer.id}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x={layer.x - layer.width} y={layer.y - Math.max(layer.height, layer.width)} width={layer.width * 3} height={Math.max(layer.height, layer.width) * 3}>
          {(layer.maskSelections || []).reduce<ReactNode>((node, _selection, index) => <g mask={`url(#selection-mask-${layer.id}-${index})`}>{node}</g>, <rect x={layer.x - layer.width} y={layer.y - Math.max(layer.height, layer.width)} width={layer.width * 3} height={Math.max(layer.height, layer.width) * 3} fill="white" />)}
          {layer.maskStrokes?.map((stroke, index) => (
            <path key={index} d={smoothPath(maskStrokePoints(layer, stroke), .55)} fill="none" stroke={stroke.mode === 'hide' ? 'black' : 'white'} strokeWidth={maskStrokeWidth(layer, stroke)} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </mask>
      )}
    </>
  )
}

function layerFill(layer: DesignLayer) {
  return layer.fillType && layer.fillType !== 'solid' && layer.gradient ? `url(#gradient-${layer.id})` : layer.fill
}

function maskStrokePoints(layer: DesignLayer, stroke: MaskBrushStroke) {
  return stroke.points.map((point) => ({ x: layer.x + point.x * layer.width, y: layer.y + point.y * Math.max(1, layer.height) }))
}

function maskStrokeWidth(layer: DesignLayer, stroke: MaskBrushStroke) {
  return stroke.size * Math.max(1, Math.max(layer.width, layer.height))
}

function layerTransform(layer: DesignLayer) {
  const cx = layer.x + layer.width / 2
  const cy = layer.y + layer.height / 2
  const flip = layer.flipX || layer.flipY
    ? ` translate(${cx} ${cy}) scale(${layer.flipX ? -1 : 1} ${layer.flipY ? -1 : 1}) translate(${-cx} ${-cy})`
    : ''
  return `rotate(${layer.rotation} ${cx} ${cy})${flip}`
}

function selectionFeatherBounds(layer: DesignLayer, feather: number) {
  const pad = feather * 4 + 2
  return { x: layer.x - pad, y: layer.y - pad, width: layer.width + pad * 2, height: layer.height + pad * 2 }
}

function gaussianBounds(layer: DesignLayer) {
  const extent = Math.hypot(layer.width, layer.height) / 2 + Math.abs(layer.strokeWidth) + (layer.blur?.amount || 0) * 4 + 2
  return { x: layer.x + layer.width / 2 - extent, y: layer.y + layer.height / 2 - extent, width: extent * 2, height: extent * 2 }
}

// A weighted set of translated or scaled samples approximates a shutter exposure.
// These transforms are shared by the editor, exports and the canvas eyedropper.
function blurSamples(layer: DesignLayer): { transform: string; opacity: number }[] {
  const blur = layer.blur
  if (!blur?.enabled || blur.type === 'gaussian' || blur.amount <= 0) return []
  const count = 17
  const angle = blur.angle * Math.PI / 180
  const cx = layer.x + layer.width / 2, cy = layer.y + layer.height / 2
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1) - .5
    if (blur.type === 'radial') {
      const scale = Math.max(.05, 1 + t * blur.amount / 100)
      return { transform: `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`, opacity: 1 / count }
    }
    const along = t * blur.amount
    const bend = blur.type === 'path' ? (t * t - .25) * blur.amount * blur.curvature / 100 : 0
    const x = along * Math.cos(angle) - bend * Math.sin(angle)
    const y = along * Math.sin(angle) + bend * Math.cos(angle)
    return { transform: `translate(${x} ${y})`, opacity: 1 / count }
  })
}

function LayerElement({ layer, editing, onPointerDown, onDoubleClick }: {
  layer: DesignLayer
  editing?: boolean
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void
  onDoubleClick: (event: ReactMouseEvent<SVGGElement>) => void
}) {
  const cx = layer.x + layer.width / 2
  const cy = layer.y + layer.height / 2
  const transform = layerTransform(layer)
  const common = { opacity: editing ? 0 : layer.opacity, 'data-layer': layer.id }
  const fill = layerFill(layer)
  let content: ReactNode
  if (layer.type === 'rectangle') {
    content = <rect {...common} x={layer.x} y={layer.y} width={layer.width} height={layer.height} rx={layer.radius || 0} fill={fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
  } else if (layer.type === 'ellipse') {
    content = <ellipse {...common} cx={cx} cy={cy} rx={layer.width / 2} ry={layer.height / 2} fill={fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
  } else if (layer.type === 'polygon') {
    content = <path {...common} d={polygonLayerPath(layer)} fillRule="evenodd" fill={fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} strokeLinejoin="round" />
  } else if (layer.type === 'image') {
    const scale = layer.imageScale || 1
    const imageWidth = layer.width * scale
    const imageHeight = layer.height * scale
    const imageX = layer.x - (imageWidth - layer.width) / 2 + (layer.imageOffsetX || 0)
    const imageY = layer.y - (imageHeight - layer.height) / 2 + (layer.imageOffsetY || 0)
    content = <image {...common} href={layer.src} x={imageX} y={imageY} width={imageWidth} height={imageHeight} preserveAspectRatio="xMidYMid slice" clipPath={`url(#clip-${layer.id})`} />
  } else if (layer.type === 'line') {
    content = <line {...common} x1={layer.x} y1={layer.y} x2={layer.x + layer.width} y2={layer.y + layer.height} stroke={layer.stroke} strokeWidth={Math.max(layer.strokeWidth, 2)} strokeLinecap="round" />
  } else if (layer.type === 'star') {
    content = <polygon {...common} points={starPoints(cx, cy, Math.min(layer.width, layer.height) / 2, Math.min(layer.width, layer.height) / 4.3)} fill={fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
  } else if (layer.type === 'path' || layer.type === 'brush') {
    const points = layerPoints(layer)
    content = <path {...common} d={layer.type === 'brush' ? smoothPath(points, layer.smoothing || .5) : pointPath(points, Boolean(layer.closed))} fill={layer.closed ? fill : 'none'} stroke={layer.stroke} strokeWidth={Math.max(layer.strokeWidth, 1)} strokeLinecap="round" strokeLinejoin="round" />
  } else {
    const lines = textLines(layer)
    const fontSize = layer.fontSize || 32
    const x = layer.textAlign === 'center' ? layer.x + layer.width / 2 : layer.textAlign === 'right' ? layer.x + layer.width : layer.x
    const anchor = layer.textAlign === 'center' ? 'middle' : layer.textAlign === 'right' ? 'end' : 'start'
    content = (
      <text {...common} xmlSpace="preserve" x={x} y={layer.y + fontSize * 0.84} transform={`translate(${x} 0) scale(${layer.textScaleX || 1} 1) translate(${-x} 0)`} fill={fill} fontFamily={layer.fontFamily || 'Inter'} fontSize={fontSize} fontWeight={layer.fontWeight || 400} letterSpacing={layer.letterSpacing || 0} textAnchor={anchor}>
        {lines.map((line, index) => <tspan key={index} x={x} dy={index === 0 ? 0 : fontSize * (layer.lineHeight || 1.2)}>{line}</tspan>)}
      </text>
    )
  }
  const source = <g transform={transform} mask={layer.maskStrokes?.length || layer.maskSelections?.length ? `url(#paint-mask-${layer.id})` : undefined}>{content}</g>
  const samples = blurSamples(layer)
  return <g
    onPointerDown={onPointerDown}
    onDoubleClick={onDoubleClick}
    data-layer={layer.id}
    style={{ cursor: layer.locked ? 'not-allowed' : undefined, mixBlendMode: layer.blendMode || 'normal', isolation: 'isolate' }}
  >{layer.blur?.enabled && layer.blur.type === 'gaussian'
    ? <g filter={`url(#blur-${layer.id})`}>{source}</g>
    : samples.length ? samples.map((sample, index) => <g key={index} transform={sample.transform} opacity={sample.opacity} style={{ mixBlendMode: 'plus-lighter' }}>{source}</g>) : source}</g>
}

function TextEditorOverlay({ layer, onUpdate, onFinish }: {
  layer: DesignLayer
  onUpdate: (patch: Partial<DesignLayer>) => void
  onFinish: () => void
}) {
  const [value, setValue] = useState(layer.text || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus({ preventScroll: true })
    if (textarea.value === 'Type something') textarea.setSelectionRange(0, textarea.value.length)
    else textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [])

  const fontSize = layer.fontSize || 32
  const transform = layerTransform(layer)
  const updateValue = (text: string) => {
    setValue(text)
    const lines = textLines({ ...layer, text }).length
    const height = Math.max(layer.height, lines * fontSize * (layer.lineHeight || 1.2))
    onUpdate({ text, height })
  }
  return (
    <foreignObject className="text-editor-overlay" x={layer.x} y={layer.y} width={Math.max(layer.width, 40)} height={Math.max(layer.height, fontSize * 1.2)} transform={transform}>
      <div className="text-editor-surface">
        <textarea
          ref={textareaRef}
          value={value}
          data-text-editor="true"
          aria-label={`Edit ${layer.name}`}
          inputMode="text"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          style={{
            color: layer.fill,
            fontFamily: layer.fontFamily || 'Inter',
            fontSize: `${fontSize}px`,
            fontWeight: layer.fontWeight || 400,
            letterSpacing: `${layer.letterSpacing || 0}px`,
            lineHeight: layer.lineHeight || 1.2,
            textAlign: layer.textAlign || 'left',
            width: `${100 / (layer.textScaleX || 1)}%`,
            transform: `scaleX(${layer.textScaleX || 1})`,
            transformOrigin: 'left top',
          }}
          onChange={(event) => updateValue(event.target.value)}
          onPointerDown={(event) => {
            event.stopPropagation()
            event.currentTarget.focus({ preventScroll: true })
          }}
          onPointerUp={(event) => event.stopPropagation()}
          onTouchStart={(event) => {
            event.stopPropagation()
            event.currentTarget.focus({ preventScroll: true })
          }}
          onTouchEnd={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onBlur={onFinish}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
              event.preventDefault()
              onFinish()
            }
          }}
        />
      </div>
    </foreignObject>
  )
}

function layerPoints(layer: DesignLayer): Point[] {
  return (layer.points || []).map((point) => ({ x: layer.x + point.x * layer.width, y: layer.y + point.y * layer.height }))
}

function pointPath(points: Point[], closed: boolean) {
  if (!points.length) return ''
  return `M ${points.map((point) => `${point.x} ${point.y}`).join(' L ')}${closed ? ' Z' : ''}`
}

function smoothPath(points: Point[], smoothing: number) {
  if (!points.length) return ''
  if (points.length < 3 || smoothing <= 0) return pointPath(points, false)
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const midX = current.x + (next.x - current.x) * .5
    const midY = current.y + (next.y - current.y) * .5
    path += ` Q ${current.x} ${current.y} ${midX} ${midY}`
  }
  const last = points[points.length - 1]
  return `${path} L ${last.x} ${last.y}`
}

function regularPolygonVertices(cx: number, cy: number, radiusX: number, radiusY: number, sides: number, offset = -Math.PI / 2): Point[] {
  return Array.from({ length: Math.max(3, sides) }, (_, index) => {
    const angle = offset + index * Math.PI * 2 / Math.max(3, sides)
    return { x: cx + Math.cos(angle) * radiusX, y: cy + Math.sin(angle) * radiusY }
  })
}

function roundedPolygonPath(points: Point[], radius: number) {
  if (!points.length) return ''
  if (radius <= 0) return pointPath(points, true)
  const segments = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]
    const previousDistance = Math.hypot(previous.x - point.x, previous.y - point.y)
    const nextDistance = Math.hypot(next.x - point.x, next.y - point.y)
    const amount = Math.min(radius, previousDistance * .35, nextDistance * .35)
    return {
      point,
      before: { x: point.x + (previous.x - point.x) / (previousDistance || 1) * amount, y: point.y + (previous.y - point.y) / (previousDistance || 1) * amount },
      after: { x: point.x + (next.x - point.x) / (nextDistance || 1) * amount, y: point.y + (next.y - point.y) / (nextDistance || 1) * amount },
    }
  })
  let path = `M ${segments[0].before.x} ${segments[0].before.y} Q ${segments[0].point.x} ${segments[0].point.y} ${segments[0].after.x} ${segments[0].after.y}`
  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index]
    path += ` L ${segment.before.x} ${segment.before.y} Q ${segment.point.x} ${segment.point.y} ${segment.after.x} ${segment.after.y}`
  }
  return `${path} Z`
}

function polygonLayerPath(layer: DesignLayer) {
  const presetPath = presetShapePath(layer)
  if (presetPath !== null) return presetPath
  const cx = layer.x + layer.width / 2
  const cy = layer.y + layer.height / 2
  if (layer.shapeKind === 'arrow') {
    return pointPath([
      { x: layer.x, y: layer.y + layer.height * .3 }, { x: layer.x + layer.width * .58, y: layer.y + layer.height * .3 },
      { x: layer.x + layer.width * .58, y: layer.y }, { x: layer.x + layer.width, y: cy },
      { x: layer.x + layer.width * .58, y: layer.y + layer.height }, { x: layer.x + layer.width * .58, y: layer.y + layer.height * .7 },
      { x: layer.x, y: layer.y + layer.height * .7 },
    ], true)
  }
  if (layer.shapeKind === 'heart') {
    return `M ${cx} ${layer.y + layer.height} C ${layer.x - layer.width * .08} ${layer.y + layer.height * .58}, ${layer.x + layer.width * .05} ${layer.y}, ${layer.x + layer.width * .28} ${layer.y} C ${layer.x + layer.width * .43} ${layer.y}, ${cx} ${layer.y + layer.height * .13}, ${cx} ${layer.y + layer.height * .25} C ${cx} ${layer.y + layer.height * .13}, ${layer.x + layer.width * .57} ${layer.y}, ${layer.x + layer.width * .72} ${layer.y} C ${layer.x + layer.width * .95} ${layer.y}, ${layer.x + layer.width * 1.08} ${layer.y + layer.height * .58}, ${cx} ${layer.y + layer.height} Z`
  }
  if (layer.shapeKind === 'starburst' || layer.shapeKind === 'sunburst') {
    const count = clamp(Math.round(layer.sides || (layer.shapeKind === 'sunburst' ? 16 : 12)), 3, 32)
    const inset = clamp(layer.burstInset ?? (layer.shapeKind === 'sunburst' ? 25 : 45), 5, 90)
    const inner = 1 - inset / 100
    const vertices = Array.from({ length: count * 2 }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / count
      const radius = index % 2 ? inner : 1
      return { x: cx + Math.cos(angle) * layer.width / 2 * radius, y: cy + Math.sin(angle) * layer.height / 2 * radius }
    })
    if (layer.shapeKind === 'starburst') return roundedPolygonPath(vertices, Math.max(0, layer.radius || 0))
    // Each curved edge passes through its recessed midpoint, producing a sunburst.
    let path = `M ${vertices[0].x} ${vertices[0].y}`
    for (let index = 0; index < count; index += 1) {
      const start = vertices[index * 2]
      const valley = vertices[index * 2 + 1]
      const end = vertices[(index * 2 + 2) % vertices.length]
      const controlX = 2 * valley.x - (start.x + end.x) / 2
      const controlY = 2 * valley.y - (start.y + end.y) / 2
      path += ` Q ${controlX} ${controlY} ${end.x} ${end.y}`
    }
    return `${path} Z`
  }
  const offset = layer.shapeKind === 'diamond' ? 0 : -Math.PI / 2
  const vertices = regularPolygonVertices(cx, cy, layer.width / 2, layer.height / 2, layer.shapeKind === 'diamond' ? 4 : layer.sides || 6, offset)
  return roundedPolygonPath(vertices, layer.radius || 0)
}

function starPoints(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + index * Math.PI / 5
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`
  }).join(' ')
}

function SelectionOverlay({ layer, mode, handleScale, onResize, onRotate, onCorner, onCrop }: {
  layer: DesignLayer
  mode: Tool
  handleScale: number
  onResize: (event: ReactPointerEvent, handle: ResizeHandle) => void
  onRotate: (event: ReactPointerEvent) => void
  onCorner: (event: ReactPointerEvent) => void
  onCrop: (event: ReactPointerEvent) => void
}) {
  const height = Math.max(layer.height, 2)
  const cx = layer.x + layer.width / 2
  const cy = layer.y + height / 2
  const transform = `rotate(${layer.rotation} ${cx} ${cy})`
  const handles: { id: ResizeHandle; x: number; y: number; cursor: string; side?: 'horizontal' | 'vertical' }[] = [
    { id: 'n', x: cx, y: layer.y, cursor: 'ns-resize', side: 'horizontal' },
    { id: 'e', x: layer.x + layer.width, y: cy, cursor: 'ew-resize', side: 'vertical' },
    { id: 's', x: cx, y: layer.y + height, cursor: 'ns-resize', side: 'horizontal' },
    { id: 'w', x: layer.x, y: cy, cursor: 'ew-resize', side: 'vertical' },
    { id: 'nw', x: layer.x, y: layer.y, cursor: 'nwse-resize' },
    { id: 'ne', x: layer.x + layer.width, y: layer.y, cursor: 'nesw-resize' },
    { id: 'se', x: layer.x + layer.width, y: layer.y + height, cursor: 'nwse-resize' },
    { id: 'sw', x: layer.x, y: layer.y + height, cursor: 'nesw-resize' },
  ]
  const standard = mode === 'select'
  const cornerMode = mode === 'corner' && (layer.type === 'rectangle' || (layer.type === 'polygon' && ((layer.shapeKind || 'regular') === 'regular' || layer.shapeKind === 'diamond' || layer.shapeKind === 'starburst')))
  const cropMode = mode === 'crop' && layer.type === 'image'
  return (
    <g transform={transform} className={`selection-overlay ${cropMode ? 'crop-selection' : ''}`} aria-hidden="true">
      <rect x={layer.x} y={layer.y} width={layer.width} height={height} fill={cropMode ? 'rgba(91,75,240,.04)' : 'none'} stroke={ACCENT} strokeWidth={cropMode ? '3' : '2'} strokeDasharray={cropMode ? '8 5' : undefined} vectorEffect="non-scaling-stroke" pointerEvents={cropMode ? 'all' : 'none'} onPointerDown={cropMode ? onCrop : undefined} />
      {standard && <>
        <line x1={cx} y1={layer.y} x2={cx} y2={layer.y - 34} stroke={ACCENT} strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        <circle cx={cx} cy={layer.y - 42} r="9" fill="white" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" onPointerDown={onRotate} style={{ cursor: 'grab', pointerEvents: 'all' }} />
        {handles.map((handle) => {
          const width = (handle.side === 'vertical' ? 8 : handle.side === 'horizontal' ? 20 : 10) * handleScale
          const handleHeight = (handle.side === 'vertical' ? 20 : handle.side === 'horizontal' ? 8 : 10) * handleScale
          const hitSize = 44 * handleScale
          return (
            <g key={handle.id} data-resize-handle={handle.id} data-resize-mode={handle.side ? 'side' : 'proportional'} onPointerDown={(event) => onResize(event, handle.id)} style={{ cursor: handle.cursor, pointerEvents: 'all' }}>
              <rect x={handle.x - hitSize / 2} y={handle.y - hitSize / 2} width={hitSize} height={hitSize} fill="transparent" />
              <rect x={handle.x - width / 2} y={handle.y - handleHeight / 2} width={width} height={handleHeight} rx={2.5 * handleScale} fill="white" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </g>
          )
        })}
      </>}
      {cornerMode && <g onPointerDown={onCorner} style={{ cursor: 'ew-resize', pointerEvents: 'all' }}>
        <circle cx={layer.x + clamp(layer.radius || 18, 14, layer.width / 2)} cy={layer.y + clamp(layer.radius || 18, 14, height / 2)} r="22" fill="transparent" />
        <circle cx={layer.x + clamp(layer.radius || 18, 14, layer.width / 2)} cy={layer.y + clamp(layer.radius || 18, 14, height / 2)} r="8" fill="#FFB800" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </g>}
      {!layer.locked && <SizePill x={cx} y={layer.y + height + 28} text={cropMode ? 'Drag to move image' : cornerMode ? `Corner ${round(layer.radius || 0)} px` : `${round(layer.width)} × ${round(layer.height)}`} />}
    </g>
  )
}

function SizePill({ x, y, text }: { x: number; y: number; text: string }) {
  const width = Math.max(82, text.length * 8.5)
  return (
    <g transform={`translate(${x - width / 2} ${y})`}>
      <rect width={width} height="28" rx="8" fill={ACCENT} />
      <text x={width / 2} y="19" textAnchor="middle" fontFamily="Inter" fontSize="14" fontWeight="600" fill="white">{text}</text>
    </g>
  )
}

function ArtboardBar({ artboards, activeId, documentMeta, compact, onSwitch, onManage, onAdd, onDelete }: {
  artboards: ArtboardSnapshot[]
  activeId: string
  documentMeta: DesignDocument
  compact: boolean
  onSwitch: (id: string) => void
  onManage: () => void
  onAdd: () => void
  onDelete: () => void
}) {
  const pressTimerRef = useRef<number | null>(null)
  const pressStartRef = useRef<{ x: number; y: number } | null>(null)
  const pressPointerRef = useRef<number | null>(null)
  const pressTriggeredRef = useRef(false)
  const suppressClickRef = useRef(false)
  const cancelPress = (event?: ReactPointerEvent) => {
    if (event && pressPointerRef.current !== null && event.pointerId !== pressPointerRef.current) return
    if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current)
    pressTimerRef.current = null
    pressStartRef.current = null
    pressPointerRef.current = null
    pressTriggeredRef.current = false
  }
  const startPress = (event: ReactPointerEvent, id: string) => {
    if (!compact || event.pointerType !== 'touch' || id !== activeId) return
    cancelPress()
    pressStartRef.current = { x: event.clientX, y: event.clientY }
    pressPointerRef.current = event.pointerId
    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null
      pressTriggeredRef.current = true
      if (navigator.vibrate) navigator.vibrate(12)
    }, 500)
  }
  const movePress = (event: ReactPointerEvent) => {
    if (event.pointerId !== pressPointerRef.current) return
    const start = pressStartRef.current
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancelPress(event)
  }
  const finishPress = (event: ReactPointerEvent) => {
    if (event.pointerId !== pressPointerRef.current) return
    const shouldOpen = pressTriggeredRef.current
    if (shouldOpen) {
      event.preventDefault()
      suppressClickRef.current = true
    }
    cancelPress()
    if (shouldOpen) {
      window.setTimeout(onManage, 0)
      window.setTimeout(() => { suppressClickRef.current = false }, 400)
    }
  }
  const selectTab = (id: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (compact && id === activeId) onManage()
    else onSwitch(id)
  }
  return (
    <div className="artboard-bar">
      <div className="artboard-tabs" role="tablist" aria-label="Artboards">
        {artboards.map((artboard, index) => <button
          key={artboard.id}
          role="tab"
          aria-selected={artboard.id === activeId}
          className={artboard.id === activeId ? 'active' : ''}
          onPointerDown={(event) => startPress(event, artboard.id)}
          onPointerMove={movePress}
          onPointerUp={finishPress}
          onPointerCancel={cancelPress}
          onPointerLeave={cancelPress}
          onClick={() => selectTab(artboard.id)}
          title={compact && artboard.id === activeId ? 'Open artboards' : `Switch to ${artboard.name}`}
        ><Frame size={13} /><span>{artboard.name || `Artboard ${index + 1}`}</span>{compact && artboard.id === activeId && <small>{artboards.length}</small>} </button>)}
        <button className="add-artboard-tab" onClick={onAdd} aria-label="Add artboard" title="Add artboard"><Plus size={14} /></button>
      </div>
      <div className="artboard-bar-meta"><span>{documentMeta.presetName}</span><small>{documentMeta.width} × {documentMeta.height} px</small>{artboards.length > 1 && <button onClick={onDelete} aria-label="Delete current artboard" title="Delete current artboard"><Trash2 size={13} /></button>}</div>
    </div>
  )
}

function ZoomControl({ zoom, onZoomOut, onZoomIn, onFit }: { zoom: number; onZoomOut: () => void; onZoomIn: () => void; onFit: () => void }) {
  return (
    <div className="zoom-control" aria-label="Zoom controls">
      <IconButton label="Zoom out" onClick={onZoomOut}><ZoomOut /></IconButton>
      <button className="zoom-value" onClick={onFit} title="Fit to screen">{zoom}%</button>
      <IconButton label="Zoom in" onClick={onZoomIn}><ZoomIn /></IconButton>
      <span className="zoom-divider" />
      <IconButton label="Fit to screen" shortcut="Shift 1" onClick={onFit}><Maximize2 /></IconButton>
    </div>
  )
}

function ContextBar({ selected, activeTool, maskBrushMode, maskBrushSize, onOpenProperties, onOpenMask, onDuplicate, onDelete, onDoneTool, onUpdate, onMaskMode, onMaskSize, onClearMask }: {
  selected: DesignLayer
  activeTool: Tool
  maskBrushMode: MaskBrushMode
  maskBrushSize: number
  onOpenProperties: () => void
  onOpenMask: () => void
  onDuplicate: () => void
  onDelete: () => void
  onDoneTool: () => void
  onUpdate: (patch: Partial<DesignLayer>) => void
  onMaskMode: (mode: MaskBrushMode) => void
  onMaskSize: (size: number) => void
  onClearMask: () => void
}) {
  const focusedMode = activeTool === 'crop' || activeTool === 'corner' || activeTool === 'brush'
  if (activeTool === 'brush') {
    return (
      <div className="context-bar focused mask-brush-bar" aria-label="Mask brush controls">
        <button className="context-item context-done" onClick={onDoneTool}><Check size={17} /><span>Done</span></button>
        <button className={`context-item ${maskBrushMode === 'hide' ? 'active' : ''}`} onClick={() => onMaskMode('hide')}><Brush size={17} /><span>Hide</span></button>
        <button className={`context-item ${maskBrushMode === 'restore' ? 'active' : ''}`} onClick={() => onMaskMode('restore')}><Eraser size={17} /><span>Restore</span></button>
        <label className="mask-size-control"><span>Size</span><input type="range" min="8" max="320" value={maskBrushSize} onChange={(event) => onMaskSize(Number(event.target.value))} /><output>{maskBrushSize}</output></label>
        <button className="context-item danger" disabled={!selected.maskStrokes?.length} onClick={onClearMask}><Trash2 size={17} /><span>Clear</span></button>
      </div>
    )
  }
  return (
    <div className={`context-bar ${focusedMode ? 'focused' : ''}`} aria-label="Selection actions">
      {focusedMode && <button className="context-item context-done" onClick={onDoneTool}><Check size={17} /><span>Done</span></button>}
      <button className="context-item" onClick={onOpenProperties}><SlidersHorizontal size={17} /><span>Edit</span></button>
      {selected.type === 'image' && <button className="context-item mask-context-item" onClick={onOpenMask}><Crop size={17} /><span>Crop / mask</span></button>}
      {selected.type !== 'image' && (
        <label className="context-item color-context">
          <span className="mini-swatch" style={{ background: selected.fillType !== 'solid' && selected.gradient ? `linear-gradient(${selected.gradient.angle}deg, ${selected.gradient.stops.map((stop) => stop.color).join(', ')})` : selected.fill }} />
          <span>Fill</span>
          <input type="color" value={normalizeColor(selected.fill)} onChange={(event) => onUpdate({ fill: event.target.value, fillType: 'solid' })} aria-label="Fill colour" />
        </label>
      )}
      <button className="context-item" onClick={onDuplicate}><Copy size={17} /><span>Duplicate</span></button>
      <button className="context-item danger" onClick={onDelete}><Trash2 size={17} /><span>Delete</span></button>
    </div>
  )
}

interface PropertiesPanelProps {
  selected: DesignLayer | null
  documentMeta: DesignDocument
  onUpdate: (patch: Partial<DesignLayer>) => void
  onPickColor: (apply: (color: string) => void) => void
  imagePalette: { name: string; colors: string[] } | null
  extractingPalette: boolean
  onExtractPalette: () => void
  onUpdateDocument: (patch: Partial<DesignDocument>) => void
  onDelete: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onAlign: (alignment: 'left' | 'h-center' | 'right' | 'top' | 'v-center' | 'bottom') => void
  activeTool: Tool
  onActivateTool: (tool: Tool) => void
  onStartCrop: () => void
  onReplaceImage: () => void
  gridVisible: boolean
  gridSize: number
  guidesVisible: boolean
  guides: CanvasGuide[]
  onToggleGrid: () => void
  onGridSize: (size: number) => void
  onToggleGuides: () => void
  onAddGuide: (axis: 'x' | 'y') => void
  onClearGuides: () => void
  insideSheet?: boolean
}

function PropertiesPanel(props: PropertiesPanelProps) {
  const [linked, setLinked] = useState(false)
  if (!props.selected) {
    return (
      <div className={`panel-inner properties-inner ${props.insideSheet ? 'inside-sheet' : ''}`}>
        {!props.insideSheet && <div className="panel-header properties-title"><div><h2>Design</h2></div></div>}
        <PropertySection title="Artboard">
          <div className="dimension-pair">
            <NumberInput label="W" value={props.documentMeta.width} unit="px" onChange={(value) => props.onUpdateDocument({ width: value })} />
            <NumberInput label="H" value={props.documentMeta.height} unit="px" onChange={(value) => props.onUpdateDocument({ height: value })} />
          </div>
          <ColorInput onPickColor={props.onPickColor} label="Background" value={props.documentMeta.background} onChange={(value) => props.onUpdateDocument({ background: value })} />
        </PropertySection>
        <PropertySection title="Canvas">
          <SettingRow icon={<Grid3X3 size={17} />} label="Layout grid" value={props.gridVisible ? 'On' : 'Off'} active={props.gridVisible} onClick={props.onToggleGrid} />
          {props.gridVisible && <NumberInput label="Grid" value={props.gridSize} unit="px" onChange={props.onGridSize} />}
          <SettingRow icon={<Ruler size={17} />} label="Rulers and guides" value={props.guidesVisible ? 'On' : 'Off'} active={props.guidesVisible} onClick={props.onToggleGuides} />
          {props.guidesVisible && <div className="guide-buttons"><button className="button secondary" onClick={() => props.onAddGuide('x')}>Vertical guide</button><button className="button secondary" onClick={() => props.onAddGuide('y')}>Horizontal guide</button></div>}
          {props.guides.length > 0 && <button className="clear-guides" onClick={props.onClearGuides}>Clear {props.guides.length} guide{props.guides.length === 1 ? '' : 's'}</button>}
        </PropertySection>
        <PropertySection title="Document colours">
          <ColourPalette value={props.documentMeta.background} onChange={(background) => props.onUpdateDocument({ background })} />
          {props.imagePalette && <><div className="field-caption">Image palette</div><ColourPalette colors={props.imagePalette.colors} value={props.documentMeta.background} onChange={(background) => props.onUpdateDocument({ background })} /></>}
        </PropertySection>
        <div className="panel-note"><Lock size={16} /><p>Designs and artboards are saved to this device automatically.</p></div>
      </div>
    )
  }

  const layer = props.selected
  return (
    <div className={`panel-inner properties-inner ${props.insideSheet ? 'inside-sheet' : ''}`}>
      {!props.insideSheet && (
        <div className="panel-header properties-title">
          <div className="property-heading-icon"><LayerThumbnail layer={layer} /><div><h2>{layer.type === 'text' ? 'Text' : layer.type === 'image' ? 'Image' : layer.type === 'brush' ? 'Brush' : layer.type === 'path' ? 'Path' : 'Shape'}</h2><span>{layer.name}</span></div></div>
        </div>
      )}
      <div className="quick-arrange">
        <IconButton label="Move layer up" onClick={props.onMoveUp}><ArrowUp /></IconButton>
        <IconButton label="Move layer down" onClick={props.onMoveDown}><ArrowDown /></IconButton>
        <IconButton label="Duplicate" onClick={props.onDuplicate}><Copy /></IconButton>
        <IconButton label={layer.locked ? 'Unlock' : 'Lock'} onClick={() => props.onUpdate({ locked: !layer.locked })}>{layer.locked ? <Lock /> : <Unlock />}</IconButton>
      </div>
      {layer.type === 'image' && (
        <div className="quick-image-tools">
          <button onClick={props.onStartCrop}><Crop size={15} /><span>Move image</span></button>
          <span>Mask</span>
          {(['none', 'rounded', 'ellipse', 'star'] as const).map((mask) => {
            const active = (layer.mask || 'none') === mask
            const label = mask === 'none' ? 'Rectangle' : mask[0].toUpperCase() + mask.slice(1)
            return <button key={mask} className={active ? 'active' : ''} onClick={() => props.onUpdate({ mask })} aria-label={`${label} mask`} aria-pressed={active}>{mask === 'none' ? <Square /> : mask === 'rounded' ? <Spline /> : mask === 'ellipse' ? <Circle /> : <Star />}</button>
          })}
        </div>
      )}
      {layer.type === 'polygon' && (layer.shapeKind === 'stamp' || layer.shapeKind === 'stamp-rectangle') && (
        <PropertySection title="Stamp">
          <div className="stamp-options" aria-label="Stamp shape">
            <button className={layer.shapeKind === 'stamp' ? 'selected' : ''} aria-pressed={layer.shapeKind === 'stamp'} onClick={() => props.onUpdate({ shapeKind: 'stamp' })}>Round</button>
            <button className={layer.shapeKind === 'stamp-rectangle' ? 'selected' : ''} aria-pressed={layer.shapeKind === 'stamp-rectangle'} onClick={() => props.onUpdate({ shapeKind: 'stamp-rectangle' })}>Rectangle</button>
          </div>
          {layer.shapeKind === 'stamp-rectangle' && <button className="button secondary full-button" onClick={() => {
            const size = Math.max(20, layer.width)
            props.onUpdate({ width: size, height: size, x: layer.x + (layer.width - size) / 2, y: layer.y + (layer.height - size) / 2 })
          }}>Make square</button>}
        </PropertySection>
      )}
      {layer.type === 'polygon' && layer.shapeKind !== 'stamp' && layer.shapeKind !== 'stamp-rectangle' && (
        <PropertySection title="Polygon">
          <div className="shape-kind-grid" aria-label="Custom shape">
            <button className={(layer.shapeKind || 'regular') === 'regular' ? 'active' : ''} aria-pressed={(layer.shapeKind || 'regular') === 'regular'} onClick={() => props.onUpdate({ shapeKind: 'regular', sides: layer.sides || 6 })}><Hexagon /><span>Polygon</span></button>
            <button className={layer.shapeKind === 'diamond' ? 'active' : ''} aria-pressed={layer.shapeKind === 'diamond'} onClick={() => props.onUpdate({ shapeKind: 'diamond', sides: 4 })}><Diamond /><span>Diamond</span></button>
            <button className={layer.shapeKind === 'arrow' ? 'active' : ''} aria-pressed={layer.shapeKind === 'arrow'} onClick={() => { if (props.activeTool === 'corner') props.onActivateTool('select'); props.onUpdate({ shapeKind: 'arrow' }) }}><Move /><span>Arrow</span></button>
            <button className={layer.shapeKind === 'heart' ? 'active' : ''} aria-pressed={layer.shapeKind === 'heart'} onClick={() => { if (props.activeTool === 'corner') props.onActivateTool('select'); props.onUpdate({ shapeKind: 'heart' }) }}><Heart /><span>Heart</span></button>
            <button className={layer.shapeKind === 'starburst' ? 'active' : ''} aria-pressed={layer.shapeKind === 'starburst'} onClick={() => props.onUpdate({ shapeKind: 'starburst', sides: clamp(layer.sides || 12, 3, 32) })}><Sparkles /><span>Starburst</span></button>
            <button className={layer.shapeKind === 'sunburst' ? 'active' : ''} aria-pressed={layer.shapeKind === 'sunburst'} onClick={() => { if (props.activeTool === 'corner') props.onActivateTool('select'); props.onUpdate({ shapeKind: 'sunburst', sides: clamp(layer.sides || 16, 3, 32) }) }}><Sun /><span>Sunburst</span></button>
          </div>
          {(layer.shapeKind || 'regular') === 'regular' && <SliderField label="Sides" value={layer.sides || 6} min={3} max={32} unit="" onChange={(sides) => props.onUpdate({ sides: clamp(round(sides), 3, 32) })} />}
          {(layer.shapeKind === 'starburst' || layer.shapeKind === 'sunburst') && <>
            <SliderField label="Points" value={clamp(layer.sides || (layer.shapeKind === 'sunburst' ? 16 : 12), 3, 32)} min={3} max={32} unit="" onChange={(sides) => props.onUpdate({ sides: clamp(round(sides), 3, 32) })} />
            <SliderField label="Inset" value={clamp(layer.burstInset ?? (layer.shapeKind === 'sunburst' ? 25 : 45), 5, 90)} min={5} max={90} unit="%" onChange={(value) => props.onUpdate({ burstInset: clamp(round(value), 5, 90) })} />
          </>}
          {((layer.shapeKind || 'regular') === 'regular' || layer.shapeKind === 'diamond' || layer.shapeKind === 'starburst') && <><SliderField label="Corner radius" value={round(layer.radius || 0)} min={0} max={round(Math.min(layer.width, layer.height) / 3)} unit="px" onChange={(radius) => props.onUpdate({ radius })} /><button className={`button secondary full-button ${props.activeTool === 'corner' ? 'active' : ''}`} onClick={() => props.onActivateTool('corner')}><Spline size={15} /> Edit corners on canvas</button></>}
        </PropertySection>
      )}

      {layer.type === 'image' && <PropertySection title="Selection masks">
        <button className="button secondary full-button" disabled={layer.locked} onClick={() => props.onActivateTool('polygon-mask')}><Hexagon size={16} /> Polygonal selection</button>
        <button className="button secondary full-button" disabled={layer.locked} onClick={() => props.onActivateTool('wand-mask')}><Sparkles size={16} /> Magic wand selection</button>
        {Boolean(layer.maskSelections?.length) && <button className="button secondary full-button" onClick={() => props.onUpdate({ maskSelections: [] })}>Clear selection masks</button>}
      </PropertySection>}

      {layer.type === 'image' && <PropertySection title="Image palette">
        <button className="button secondary full-button" disabled={props.extractingPalette || !layer.src} onClick={props.onExtractPalette}><Palette size={16} />{props.extractingPalette ? 'Extracting…' : 'Extract palette from image'}</button>
        {props.imagePalette && <ImagePalettePreview palette={props.imagePalette} />}
        <small className="palette-note">Colours are extracted from the original image on this device.</small>
      </PropertySection>}

      <PropertySection title="Blur">
        <label className="blur-select"><span>Effect</span><select aria-label="Blur effect" value={layer.blur?.type || 'none'} onChange={(event) => {
          const type = event.target.value as BlurType | 'none'
          props.onUpdate({ blur: type === 'none' ? undefined : { type, amount: layer.blur?.amount ?? 12, angle: layer.blur?.angle ?? 0, curvature: layer.blur?.curvature ?? 50, enabled: true } })
        }}><option value="none">None</option><option value="gaussian">Gaussian</option><option value="motion">Motion</option><option value="radial">Radial zoom</option><option value="path">Curved path</option></select></label>
        {layer.blur && <>
          <button className="button secondary full-button" aria-pressed={layer.blur.enabled} onClick={() => props.onUpdate({ blur: { ...layer.blur!, enabled: !layer.blur!.enabled } })}>{layer.blur.enabled ? 'Disable blur' : 'Enable blur'}</button>
          <SliderField label="Blur amount" value={layer.blur.amount} min={0} max={100} unit={layer.blur.type === 'radial' ? '%' : 'px'} onChange={(amount) => props.onUpdate({ blur: { ...layer.blur!, amount: clamp(amount, 0, 100) } })} />
          {(layer.blur.type === 'motion' || layer.blur.type === 'path') && <SliderField label="Blur angle" value={layer.blur.angle} min={0} max={360} unit="°" onChange={(angle) => props.onUpdate({ blur: { ...layer.blur!, angle: clamp(angle, 0, 360) } })} />}
          {layer.blur.type === 'path' && <SliderField label="Path curvature" value={layer.blur.curvature} min={-100} max={100} unit="%" onChange={(curvature) => props.onUpdate({ blur: { ...layer.blur!, curvature: clamp(curvature, -100, 100) } })} />}
          {layer.blur.type !== 'gaussian' && <small className="palette-note">Blur uses sampled exposure for local rendering.</small>}
        </>}
      </PropertySection>

      <PropertySection title="Position" actions={<button className={`link-toggle ${linked ? 'active' : ''}`} onClick={() => setLinked(!linked)} aria-label="Lock proportions"><Link2 size={14} /></button>}>
        <div className="dimension-pair">
          <NumberInput label="X" value={round(layer.x)} onChange={(value) => props.onUpdate({ x: value })} />
          <NumberInput label="Y" value={round(layer.y)} onChange={(value) => props.onUpdate({ y: value })} />
        </div>
        <div className="dimension-pair">
          <NumberInput label="W" value={round(layer.width)} onChange={(value) => {
            const patch: Partial<DesignLayer> = { width: value }
            if (linked && layer.width) patch.height = layer.height * value / layer.width
            props.onUpdate(patch)
          }} />
          <NumberInput label="H" value={round(layer.height)} onChange={(value) => {
            const patch: Partial<DesignLayer> = { height: value }
            if (linked && layer.height) patch.width = layer.width * value / layer.height
            props.onUpdate(patch)
          }} />
        </div>
        <div className="single-property-row">
          <NumberInput label={<RotateCw size={14} />} value={round(layer.rotation)} unit="°" onChange={(value) => props.onUpdate({ rotation: value })} />
          <div className="flip-actions"><button className={layer.flipX ? 'active' : ''} onClick={() => props.onUpdate({ flipX: !layer.flipX })} aria-label="Flip horizontally" aria-pressed={Boolean(layer.flipX)}>↔</button><button className={layer.flipY ? 'active' : ''} onClick={() => props.onUpdate({ flipY: !layer.flipY })} aria-label="Flip vertically" aria-pressed={Boolean(layer.flipY)}>↕</button></div>
        </div>
      </PropertySection>

      <PropertySection title="Align to artboard">
        <div className="align-grid" aria-label="Align selected object">
          <button onClick={() => props.onAlign('left')} aria-label="Align left"><AlignHorizontalJustifyStart /></button>
          <button onClick={() => props.onAlign('h-center')} aria-label="Align horizontal centre"><AlignHorizontalJustifyCenter /></button>
          <button onClick={() => props.onAlign('right')} aria-label="Align right"><AlignHorizontalJustifyEnd /></button>
          <button onClick={() => props.onAlign('top')} aria-label="Align top"><AlignVerticalJustifyStart /></button>
          <button onClick={() => props.onAlign('v-center')} aria-label="Align vertical centre"><AlignVerticalJustifyCenter /></button>
          <button onClick={() => props.onAlign('bottom')} aria-label="Align bottom"><AlignVerticalJustifyEnd /></button>
        </div>
      </PropertySection>

      {layer.type === 'text' && (
        <PropertySection title="Typography">
          <SelectField label="Font" value={layer.fontFamily || 'Inter'} options={['Inter', 'Arial', 'Georgia', 'Times New Roman']} onChange={(fontFamily) => props.onUpdate({ fontFamily })} />
          <div className="dimension-pair">
            <SelectField compact label="Weight" value={String(layer.fontWeight || 400)} options={['400', '500', '600', '700']} onChange={(value) => props.onUpdate({ fontWeight: Number(value) })} />
            <NumberInput label="Size" value={layer.fontSize || 16} unit="px" onChange={(fontSize) => props.onUpdate({ fontSize })} />
          </div>
          <div className="segmented align-control" aria-label="Text alignment">
            {(['left', 'center', 'right'] as const).map((alignment) => (
              <button key={alignment} className={(layer.textAlign || 'left') === alignment ? 'selected' : ''} onClick={() => props.onUpdate({ textAlign: alignment })} aria-label={`Align ${alignment}`}>
                {alignment === 'left' ? <AlignLeft /> : alignment === 'center' ? <AlignCenter /> : <AlignRight />}
              </button>
            ))}
          </div>
          <div className="dimension-pair">
            <NumberInput label="Line" value={Number((layer.lineHeight || 1.2).toFixed(2))} unit="×" step={0.1} onChange={(lineHeight) => props.onUpdate({ lineHeight })} />
            <NumberInput label="Track" value={layer.letterSpacing || 0} unit="px" step={0.1} onChange={(letterSpacing) => props.onUpdate({ letterSpacing })} />
          </div>
        </PropertySection>
      )}

      {layer.type === 'image' && (
        <PropertySection title="Image">
          <div className="image-property-preview"><img src={layer.src} alt="Selected layer" /><div><span>Original image</span><small>Non-destructive placement</small></div></div>
          <div className="two-buttons"><button className="button secondary" onClick={props.onReplaceImage}>Replace</button><button className={`button secondary ${props.activeTool === 'crop' ? 'active' : ''}`} onClick={props.onStartCrop}><Crop size={15} /> Move image</button></div>
          <SliderField label="Image scale" value={round((layer.imageScale || 1) * 100)} min={100} max={300} unit="%" onChange={(value) => props.onUpdate({ imageScale: value / 100 })} />
          <div className="field-caption">Mask</div>
          <div className="mask-options segmented" aria-label="Image mask">
            {(['none', 'ellipse', 'rounded', 'star'] as const).map((mask) => <button key={mask} className={(layer.mask || 'none') === mask ? 'selected' : ''} onClick={() => props.onUpdate({ mask })} title={`${mask} mask`}>{mask === 'none' ? <Square /> : mask === 'ellipse' ? <Circle /> : mask === 'star' ? <Star /> : <Spline />}</button>)}
          </div>
        </PropertySection>
      )}


      {layer.type !== 'image' && layer.type !== 'line' && layer.type !== 'brush' && (
        <PropertySection title="Fill">
          <FillEditor layer={layer} onUpdate={props.onUpdate} onPickColor={props.onPickColor} imagePalette={props.imagePalette} />
        </PropertySection>
      )}

      {layer.type === 'path' && <PropertySection title="Path"><ToggleRow label="Close path" checked={Boolean(layer.closed)} onChange={(closed) => props.onUpdate({ closed, fill: closed && layer.fill === 'transparent' ? '#5B4BF0' : layer.fill })} /></PropertySection>}

      {(['rectangle', 'ellipse', 'polygon', 'star', 'line', 'path', 'brush'] as LayerType[]).includes(layer.type) && (
        <PropertySection title={layer.type === 'brush' ? 'Brush' : 'Stroke'} optional={layer.type !== 'brush'}>
          <ColorInput onPickColor={props.onPickColor} label="Stroke" value={layer.stroke === 'transparent' ? '#18181B' : layer.stroke} onChange={(stroke) => props.onUpdate({ stroke, strokeWidth: layer.strokeWidth || 1 })} />
          {props.imagePalette && <><div className="field-caption">Image palette</div><ColourPalette colors={props.imagePalette.colors} value={layer.stroke} onChange={(stroke) => props.onUpdate({ stroke, strokeWidth: layer.strokeWidth || 1 })} /></>}
          {layer.type === 'brush'
            ? <><SliderField label="Brush size" value={layer.strokeWidth} min={1} max={120} unit="px" onChange={(strokeWidth) => props.onUpdate({ strokeWidth })} /><SliderField label="Smoothing" value={round((layer.smoothing || .5) * 100)} min={0} max={100} unit="%" onChange={(value) => props.onUpdate({ smoothing: value / 100 })} /></>
            : <NumberInput label="Width" value={layer.strokeWidth} unit="px" onChange={(strokeWidth) => props.onUpdate({ strokeWidth })} />}
          {layer.type === 'rectangle' && <><NumberInput label="Corners" value={layer.radius || 0} unit="px" onChange={(radius) => props.onUpdate({ radius })} /><button className={`button secondary full-button ${props.activeTool === 'corner' ? 'active' : ''}`} onClick={() => props.onActivateTool('corner')}><Spline size={15} /> Edit corners on canvas</button></>}
        </PropertySection>
      )}

      <PropertySection title="Appearance">
        <SliderField label="Opacity" value={round(layer.opacity * 100)} min={0} max={100} unit="%" onChange={(value) => props.onUpdate({ opacity: value / 100 })} />
        <SelectField label="Blend" value={(layer.blendMode || 'normal')[0].toUpperCase() + (layer.blendMode || 'normal').slice(1)} options={['Normal', 'Multiply', 'Screen', 'Overlay']} onChange={(value) => props.onUpdate({ blendMode: value.toLowerCase() as DesignLayer['blendMode'] })} />
      </PropertySection>
      {props.insideSheet && <button className="button destructive-text full-button" onClick={props.onDelete}><Trash2 size={17} /> Delete layer</button>}
    </div>
  )
}

function PropertySection({ title, actions, children, optional }: { title: string; actions?: ReactNode; children: ReactNode; optional?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="property-section">
      <div className="property-section-header">
        <button onClick={() => setOpen(!open)} aria-expanded={open}><ChevronRight size={14} className={open ? 'expanded' : ''} /><span>{title}</span>{optional && <small>Optional</small>}</button>
        {actions}
      </div>
      {open && <div className="property-section-body">{children}</div>}
    </section>
  )
}

function NumberInput({ label, value, unit, step = 1, onChange }: { label: ReactNode; value: number; unit?: string; step?: number; onChange: (value: number) => void }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input type="number" value={Number.isFinite(value) ? Number(value.toFixed(2)) : 0} step={step} onChange={(event) => onChange(Number(event.target.value))} />
      {unit && <small>{unit}</small>}
    </label>
  )
}

function FillEditor({ layer, onUpdate, onPickColor, imagePalette }: { layer: DesignLayer; onUpdate: (patch: Partial<DesignLayer>) => void; onPickColor: (apply: (color: string) => void) => void; imagePalette: { name: string; colors: string[] } | null }) {
  const fillType = layer.fillType || 'solid'
  const gradient = layer.gradient || { ...DEFAULT_GRADIENT, stops: DEFAULT_GRADIENT.stops.map((stop) => ({ ...stop })) }
  const setFillType = (type: 'solid' | 'linear' | 'radial') => {
    if (type === 'solid') onUpdate({ fillType: 'solid' })
    else onUpdate({ fillType: type, gradient: { ...gradient, type } })
  }
  const setStop = (index: number, color: string) => {
    onUpdate({ fillType, gradient: { ...gradient, stops: gradient.stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, color } : stop) } })
  }
  return (
    <div className="fill-editor">
      <div className="segmented fill-type-control" aria-label="Fill type">
        {(['solid', 'linear', 'radial'] as const).map((type) => <button key={type} className={fillType === type ? 'selected' : ''} onClick={() => setFillType(type)}>{type === 'solid' ? 'Solid' : type === 'linear' ? 'Linear' : 'Radial'}</button>)}
      </div>
      {fillType === 'solid'
        ? <ColorInput onPickColor={onPickColor} label="Fill" value={layer.fill} onChange={(fill) => onUpdate({ fill, fillType: 'solid' })} />
        : <>
          <div className="gradient-preview" style={{ background: gradient.type === 'radial' ? `radial-gradient(circle, ${gradient.stops.map((stop) => `${stop.color} ${stop.offset * 100}%`).join(', ')})` : `linear-gradient(${gradient.angle}deg, ${gradient.stops.map((stop) => `${stop.color} ${stop.offset * 100}%`).join(', ')})` }} />
          <div className="gradient-stops">{gradient.stops.map((stop, index) => <div key={index}><ColorInput onPickColor={onPickColor} label={index === 0 ? 'Start' : 'End'} value={stop.color} onChange={(color) => setStop(index, color)} />{imagePalette && <><div className="field-caption">Image palette</div><ColourPalette colors={imagePalette.colors} value={stop.color} onChange={(color) => setStop(index, color)} /></>}</div>)}</div>
          {gradient.type === 'linear' && <SliderField label="Angle" value={gradient.angle} min={0} max={360} unit="°" onChange={(angle) => onUpdate({ gradient: { ...gradient, angle } })} />}
        </>}
      {imagePalette && fillType === 'solid' && <><div className="field-caption">Image palette</div><ColourPalette colors={imagePalette.colors} value={layer.fill} onChange={(color) => onUpdate({ fill: color })} /></>}
      <div className="palette-heading"><span>Document colours</span></div>
      <ColourPalette value={fillType === 'solid' ? layer.fill : gradient.stops[0].color} onChange={(color) => fillType === 'solid' ? onUpdate({ fill: color }) : setStop(0, color)} />
    </div>
  )
}

function ColourPalette({ value, onChange, colors = DOCUMENT_COLOURS }: { value: string; onChange: (colour: string) => void; colors?: string[] }) {
  return <div className="colour-palette">{colors.map((colour) => <button key={colour} className={normalizeColor(value).toLowerCase() === colour.toLowerCase() ? 'selected' : ''} style={{ background: colour }} onClick={() => onChange(colour)} aria-label={`Use ${colour}`}>{normalizeColor(value).toLowerCase() === colour.toLowerCase() && <Check size={11} />}</button>)}</div>
}

function ImagePalettePreview({ palette }: { palette: { name: string; colors: string[] } }) {
  return <div className="image-palette-preview" aria-label={`Palette from ${palette.name}`}>
    <span>From {palette.name}</span>
    <div>{palette.colors.map((color) => <div key={color}><span style={{ background: color }} /><code>{color}</code></div>)}</div>
  </div>
}

function hexToHsv(hex: string) {
  const color = normalizeColor(hex)
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
  let hue = 0
  if (delta) {
    if (max === r) hue = ((g - b) / delta + 6) % 6
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
  }
  return { h: hue * 60, s: max ? delta / max : 0, v: max }
}

function hsvToHex(h: number, s: number, v: number) {
  const chroma = v * s, x = chroma * (1 - Math.abs((h / 60) % 2 - 1)), m = v - chroma
  const channels = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x]
  return `#${channels.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`
}

function ColorInput({ label, value, onChange, onPickColor }: { label: string; value: string; onChange: (value: string) => void; onPickColor: (apply: (color: string) => void) => void }) {
  const colour = normalizeColor(value)
  const [wheelOpen, setWheelOpen] = useState(false)
  const memory = useRef({ ...hexToHsv(colour), color: colour })
  const [, refreshWheel] = useState(0)
  if (memory.current.color !== colour) {
    const next = hexToHsv(colour)
    memory.current = { h: next.s ? next.h : memory.current.h, s: next.v ? next.s : memory.current.s, v: next.v, color: colour }
  }
  const hsv = memory.current
  const updateHsv = (h: number, s: number, v: number) => {
    const color = hsvToHex(h, s, v)
    memory.current = { h, s, v, color }
    if (color.toLowerCase() === colour.toLowerCase()) refreshWheel((value) => value + 1)
    else onChange(color)
  }
  const updateWheel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const dy = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2)
    const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360
    updateHsv(hue, Math.min(1, Math.hypot(dx, dy)), hsv.v)
  }
  const angle = hsv.h * Math.PI / 180
  return <div className="color-control">
    <div className="color-field">
      <label className="color-swatch" style={{ background: colour }} title="Choose colour">
        <input type="color" value={colour} onChange={(event) => onChange(event.target.value)} aria-label={`${label} colour`} />
      </label>
      <span className="color-label">{label}</span>
      <input className="hex-input" value={colour.toUpperCase()} onChange={(event) => {
        const next = event.target.value
        if (/^#[0-9A-Fa-f]{6}$/.test(next)) onChange(next)
      }} aria-label={`${label} hex value`} />
      <button type="button" className="color-pick-button" aria-label={`Pick ${label.toLowerCase()} colour from canvas`} title="Pick colour from canvas" onClick={() => onPickColor(onChange)}><Pipette size={16} /></button>
      <button type="button" className="color-pick-button" aria-label={`${wheelOpen ? 'Close' : 'Open'} ${label.toLowerCase()} colour wheel`} aria-expanded={wheelOpen} title="Colour wheel" onClick={() => setWheelOpen(!wheelOpen)}><Palette size={16} /></button>
    </div>
    {wheelOpen && <div className="custom-colour-picker">
      <div className="colour-wheel" aria-hidden="true" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); updateWheel(event) }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateWheel(event) }}>
        <div className="colour-wheel-shade" style={{ opacity: 1 - hsv.v }} />
        <span className="colour-wheel-marker" style={{ left: `${50 + Math.cos(angle) * hsv.s * 50}%`, top: `${50 + Math.sin(angle) * hsv.s * 50}%` }} />
      </div>
      <label>Hue <input type="range" min="0" max="359" value={Math.round(hsv.h)} aria-label={`${label} hue`} onChange={(event) => updateHsv(Number(event.target.value), hsv.s, hsv.v)} /></label>
      <label>Saturation <input type="range" min="0" max="100" value={Math.round(hsv.s * 100)} aria-label={`${label} saturation`} onChange={(event) => updateHsv(hsv.h, Number(event.target.value) / 100, hsv.v)} /></label>
      <label>Brightness <input type="range" min="0" max="100" value={Math.round(hsv.v * 100)} aria-label={`${label} brightness`} onChange={(event) => updateHsv(hsv.h, hsv.s, Number(event.target.value) / 100)} /></label>
    </div>}
  </div>
}

function normalizeColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#18181B'
}

function SelectField({ label, value, options, onChange, compact }: { label: string; value: string; options: string[]; onChange: (value: string) => void; compact?: boolean }) {
  return (
    <label className={`select-field ${compact ? 'compact' : ''}`}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select>
      <ChevronDown size={14} />
    </label>
  )
}

function SliderField({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  return (
    <div className="slider-field">
      <div><span>{label}</span><label><input type="number" aria-label={`${label} value`} min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /><small>{unit}</small></label></div>
      <input type="range" aria-label={label} min={min} max={max} value={value} style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` } as CSSProperties} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}

function SettingRow({ icon, label, value, active, onClick }: { icon: ReactNode; label: string; value: string; active?: boolean; onClick?: () => void }) {
  return <button className={`setting-row ${active ? 'active' : ''}`} onClick={onClick}><span>{icon}{label}</span><span>{value}<ChevronRight size={14} /></span></button>
}

type MobileToolAction =
  | 'select' | 'object-select' | 'mask-brush' | 'shapes' | 'text' | 'image' | 'layers' | 'more'
  | 'properties' | 'edit-text' | 'finish-text' | 'extract-palette' | 'corners' | 'align' | 'arrange' | 'duplicate' | 'delete' | 'crop' | 'shape-mask'
  | 'mask-done' | 'mask-hide' | 'mask-restore' | 'mask-smaller' | 'mask-larger' | 'mask-clear'

function MobileToolbar({ activeTool, selected, editingText, maskBrushMode, onAction }: {
  activeTool: Tool
  selected: DesignLayer | null
  editingText: boolean
  maskBrushMode: MaskBrushMode
  onAction: (action: MobileToolAction) => void
}) {
  type Item = { label: string; icon: ReactNode; action: MobileToolAction; active?: boolean; danger?: boolean; disabled?: boolean }
  let items: Item[]

  if (activeTool === 'brush' && selected) {
    items = [
      { label: 'Done', icon: <Check />, action: 'mask-done', active: true },
      { label: 'Hide', icon: <Brush />, action: 'mask-hide', active: maskBrushMode === 'hide' },
      { label: 'Restore', icon: <Eraser />, action: 'mask-restore', active: maskBrushMode === 'restore' },
      { label: 'Smaller', icon: <Minus />, action: 'mask-smaller' },
      { label: 'Larger', icon: <Plus />, action: 'mask-larger' },
      { label: 'Clear', icon: <Trash2 />, action: 'mask-clear', danger: true, disabled: !selected.maskStrokes?.length },
      { label: 'Object', icon: <ScanSearch />, action: 'object-select' },
    ]
  } else if (selected) {
    const supportsCorners = selected.type === 'rectangle' || (selected.type === 'polygon' && ((selected.shapeKind || 'regular') === 'regular' || selected.shapeKind === 'diamond' || selected.shapeKind === 'starburst'))
    if (selected.type === 'text') {
      items = [
        editingText
          ? { label: 'Done', icon: <Check />, action: 'finish-text', active: true }
          : { label: 'Edit text', icon: <Type />, action: 'edit-text' },
        { label: 'Style', icon: <SlidersHorizontal />, action: 'properties' },
        { label: 'Align', icon: <AlignCenter />, action: 'align' },
        { label: 'Mask', icon: <Brush />, action: 'mask-brush' },
        { label: 'Duplicate', icon: <Copy />, action: 'duplicate' },
        { label: 'Delete', icon: <Trash2 />, action: 'delete', danger: true },
      ]
    } else if (selected.type === 'image') {
      items = [
        { label: 'Palette', icon: <Palette />, action: 'extract-palette' },
        { label: 'Mask brush', icon: <Brush />, action: 'mask-brush' },
        { label: 'Crop', icon: <Crop />, action: 'crop', active: activeTool === 'crop' },
        { label: 'Mask shape', icon: <Spline />, action: 'shape-mask' },
        { label: 'Edit', icon: <SlidersHorizontal />, action: 'properties' },
        { label: 'Align', icon: <AlignCenter />, action: 'align' },
        { label: 'Duplicate', icon: <Copy />, action: 'duplicate' },
        { label: 'Delete', icon: <Trash2 />, action: 'delete', danger: true },
      ]
    } else {
      items = [
        ...(activeTool === 'corner' ? [{ label: 'Done', icon: <Check />, action: 'mask-done' as MobileToolAction, active: true }] : []),
        { label: 'Edit', icon: <SlidersHorizontal />, action: 'properties' },
        { label: 'Fill', icon: <Palette />, action: 'properties' },
        ...(supportsCorners ? [{ label: 'Corners', icon: <Spline />, action: 'corners' as MobileToolAction, active: activeTool === 'corner' }] : []),
        { label: 'Align', icon: <AlignCenter />, action: 'align' },
        { label: 'Arrange', icon: <Layers3 />, action: 'arrange' },
        { label: 'Mask', icon: <Brush />, action: 'mask-brush' },
        { label: 'Duplicate', icon: <Copy />, action: 'duplicate' },
        { label: 'Delete', icon: <Trash2 />, action: 'delete', danger: true },
      ]
    }
  } else {
    items = [
      { label: 'Select', icon: <MousePointer2 />, action: 'select', active: activeTool === 'select' },
      { label: 'Object', icon: <ScanSearch />, action: 'object-select', active: activeTool === 'object-select' },
      { label: 'Mask', icon: <Brush />, action: 'mask-brush', active: activeTool === 'brush' },
      { label: 'Shapes', icon: <Shapes />, action: 'shapes', active: ['rectangle', 'ellipse', 'polygon', 'star', 'line'].includes(activeTool) },
      { label: 'Text', icon: <Type />, action: 'text', active: activeTool === 'text' },
      { label: 'Image', icon: <ImageIcon />, action: 'image', active: activeTool === 'image' },
      { label: 'Layers', icon: <Layers3 />, action: 'layers' },
      { label: 'More', icon: <Menu />, action: 'more', active: ['pen', 'corner', 'zoom', 'crop'].includes(activeTool) },
    ]
  }

  return (
    <nav className={`mobile-toolbar ${selected ? 'selection-toolbar' : ''}`} aria-label={selected ? `${selected.name} actions` : 'Design tools'}>
      {items.map((item) => <button key={`${item.action}-${item.label}`} className={`${item.active ? 'active' : ''} ${item.danger ? 'danger' : ''}`} disabled={item.disabled} onPointerDown={item.action === 'finish-text' ? (event) => event.preventDefault() : undefined} onClick={() => onAction(item.action)}>{item.icon}<span>{item.label}</span></button>)}
    </nav>
  )
}

function MobileSheetView({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    dialog?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.getClientRects().length > 0)
      if (!focusable.length) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault()
        const destination = event.shiftKey ? last : first
        destination.focus()
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  useEffect(() => { dialogRef.current?.focus() }, [title])
  return (
    <div className="sheet-layer" role="presentation">
      <button className="sheet-scrim" tabIndex={-1} onClick={onClose} aria-label="Close sheet" />
      <section ref={dialogRef} className="mobile-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="sheet-handle" aria-hidden="true" />
        <header><h2>{title}</h2><IconButton label="Close" onClick={onClose}><X /></IconButton></header>
        <div className="sheet-content">{children}</div>
      </section>
    </div>
  )
}

function ArtboardManager({ artboards, activeId, onSwitch, onAdd, onDelete }: {
  artboards: ArtboardSnapshot[]
  activeId: string
  onSwitch: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const managerRef = useRef<HTMLDivElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)
  const pendingArtboard = artboards.find((artboard) => artboard.id === pendingDelete)
  useEffect(() => { if (pendingDelete) cancelDeleteRef.current?.focus() }, [pendingDelete])
  const cancelDelete = () => {
    const trigger = deleteTriggerRef.current
    setPendingDelete(null)
    window.setTimeout(() => { if (trigger?.isConnected) trigger.focus() }, 0)
  }
  const confirmDelete = (id: string) => {
    onDelete(id)
    setPendingDelete(null)
    window.setTimeout(() => managerRef.current?.querySelector<HTMLElement>('.artboard-row-main[aria-current="true"]')?.focus(), 0)
  }
  return (
    <div ref={managerRef} className="artboard-manager">
      <p className="sheet-intro">Tap an artboard to switch. Long-press the canvas to open this list.</p>
      <div className="artboard-manager-list">
        {artboards.map((artboard, index) => (
          <div key={artboard.id} className={`artboard-manager-row ${artboard.id === activeId ? 'active' : ''}`}>
            <button className="artboard-row-main" aria-current={artboard.id === activeId ? 'true' : undefined} onClick={() => onSwitch(artboard.id)}>
              <span className="artboard-row-preview" style={{ aspectRatio: `${artboard.document.width}/${artboard.document.height}`, background: artboard.document.background }}><Frame size={15} /></span>
              <span className="artboard-row-copy"><strong>{artboard.name || `Artboard ${index + 1}`}</strong><small>{artboard.document.width} × {artboard.document.height} px · {artboard.layers.length} layer{artboard.layers.length === 1 ? '' : 's'}</small></span>
              {artboard.id === activeId && <span className="active-artboard-check"><Check size={13} /></span>}
            </button>
            <button className="artboard-row-delete" disabled={artboards.length <= 1} onClick={(event) => { deleteTriggerRef.current = event.currentTarget; setPendingDelete(artboard.id) }} aria-label={`Delete ${artboard.name}`} title={artboards.length <= 1 ? 'A design needs at least one artboard' : `Delete ${artboard.name}`}><Trash2 size={17} /></button>
          </div>
        ))}
      </div>
      <button className="button secondary full-button add-artboard-button" onClick={onAdd}><Plus size={17} /> Add artboard</button>
      {pendingArtboard && (
        <div className="artboard-delete-confirm" role="alertdialog" aria-label={`Delete ${pendingArtboard.name}`}>
          <div><span><Trash2 size={17} /></span><p><strong>Delete {pendingArtboard.name}?</strong><small>Its {pendingArtboard.layers.length} layer{pendingArtboard.layers.length === 1 ? '' : 's'} will be removed.</small></p></div>
          <div><button ref={cancelDeleteRef} className="button secondary" onClick={cancelDelete}>Cancel</button><button className="button delete-confirm-button" onClick={() => confirmDelete(pendingArtboard.id)}>Delete artboard</button></div>
        </div>
      )}
    </div>
  )
}

function MaskPanel({ layer, onUpdate, onMoveImage, onBrushMask, onPolygonMask, onWandMask, onClearPaintMask }: {
  layer: DesignLayer
  onUpdate: (patch: Partial<DesignLayer>) => void
  onMoveImage: () => void
  onBrushMask: () => void
  onPolygonMask: () => void
  onWandMask: () => void
  onClearPaintMask: () => void
}) {
  const mask = layer.mask || 'none'
  const masks = [
    { id: 'none' as const, label: 'Rectangle', icon: <Square /> },
    { id: 'rounded' as const, label: 'Rounded', icon: <Spline /> },
    { id: 'ellipse' as const, label: 'Ellipse', icon: <Circle /> },
    { id: 'star' as const, label: 'Star', icon: <Star /> },
  ]
  return (
    <div className="mask-panel">
      <div className={`mask-panel-preview mask-${mask}`}><img src={layer.src} alt={`${layer.name} mask preview`} style={{ transform: `translate(${(layer.imageOffsetX || 0) * .08}px, ${(layer.imageOffsetY || 0) * .08}px) scale(${layer.imageScale || 1})` }} /></div>
      <div className="mask-panel-heading"><h3>Choose a mask</h3><p>The original image stays unchanged.</p></div>
      <div className="mask-choice-grid">{masks.map((item) => <button key={item.id} className={mask === item.id ? 'active' : ''} onClick={() => onUpdate({ mask: item.id })} aria-pressed={mask === item.id}>{item.icon}<span>{item.label}</span>{mask === item.id && <i><Check size={11} /></i>}</button>)}</div>
      <SliderField label="Image scale" value={round((layer.imageScale || 1) * 100)} min={100} max={300} unit="%" onChange={(value) => onUpdate({ imageScale: value / 100 })} />
      <div className="mask-panel-actions">
        <button className="button secondary full-button" onClick={onPolygonMask}><Hexagon size={17} /> Polygonal selection</button>
        <button className="button secondary full-button" onClick={onWandMask}><Sparkles size={17} /> Magic wand selection</button>
        {Boolean(layer.maskSelections?.length) && <button className="button secondary full-button" onClick={() => onUpdate({ maskSelections: [] })}>Clear selection masks</button>}
        <button className="button primary full-button" onClick={onBrushMask}><Brush size={17} /> Refine with mask brush</button>
        <button className="button secondary full-button" onClick={onMoveImage}><Move size={17} /> Move image inside mask</button>
        {Boolean(layer.maskStrokes?.length) && <button className="button secondary full-button" onClick={onClearPaintMask}>Clear brush mask</button>}
        {mask !== 'none' && <button className="button secondary full-button" onClick={() => onUpdate({ mask: 'none' })}>Remove shape mask</button>}
      </div>
    </div>
  )
}

function ShapesGrid({ onAdd }: { onAdd: (type: LayerType, point?: { x: number; y: number }, preset?: Partial<DesignLayer>) => void }) {
  return <div className="shape-library">
    <p className="shape-library-intro">Choose a shape to add it to the artboard.</p>
    {shapeCategories.map((category) => <section className="shape-category" key={category.name} aria-label={category.name}>
      <h3>{category.name}</h3>
      <div className="shapes-grid custom-shapes-grid">
        {category.shapes.map((shape) => {
          const preview: DesignLayer = {
            id: 'preview', name: shape.label, type: shape.type, x: 2, y: 2, width: 28, height: 28,
            rotation: 0, opacity: 1, visible: true, locked: false, fill: 'currentColor', stroke: 'currentColor', strokeWidth: 1,
            ...shape.preset,
          }
          return <button key={shape.label} onClick={() => onAdd(shape.type, undefined, shape.preset)}>
            <svg viewBox="0 0 32 32" aria-hidden="true">
              {shape.type === 'polygon' ? <path d={polygonLayerPath(preview)} fillRule="evenodd" />
                : shape.type === 'rectangle' ? <rect x="3" y="4" width="26" height="24" rx="2" />
                  : shape.type === 'ellipse' ? <ellipse cx="16" cy="16" rx="13" ry="12" />
                    : shape.type === 'star' ? <polygon points={starPoints(16, 16, 14, 6)} />
                      : <line x1="3" y1="27" x2="29" y2="5" stroke="currentColor" strokeWidth="2" />}
            </svg>
            <span>{shape.label}</span>
          </button>
        })}
      </div>
    </section>)}
  </div>
}

function MouseSettingsPanel({ settings, onChange }: { settings: MouseSettings; onChange: (settings: MouseSettings) => void }) {
  return <div className="mouse-settings">
    <p>Choose how the mouse behaves over the canvas. Touch gestures are unchanged.</p>
    {(['left', 'right', 'middle'] as const).map((button) => <label key={button}>
      <span>{button === 'left' ? 'Left click' : button === 'right' ? 'Right click' : 'Middle click'}</span>
      <select value={settings[button]} onChange={(event) => onChange({ ...settings, [button]: event.target.value as MouseButtonAction })}>
        <option value="default">{button === 'right' ? 'Browser context menu' : button === 'left' ? 'Current tool' : 'Browser default'}</option>
        <option value="pan">Pan canvas</option><option value="none">No action</option>
      </select>
    </label>)}
    <label><span>Scroll wheel</span><select value={settings.wheel} onChange={(event) => onChange({ ...settings, wheel: event.target.value as MouseSettings['wheel'] })}>
      <option value="zoom">Zoom at pointer</option><option value="pan">Scroll canvas</option><option value="none">No action</option>
    </select></label>
    <button className="button secondary" onClick={() => onChange({ ...DEFAULT_MOUSE })}>Reset to defaults</button>
  </div>
}

function MoreMenu({ onAction }: { onAction: (action: string) => void }) {
  const actions = [
    { id: 'new', label: 'New design', icon: <Plus /> },
    { id: 'object-select', label: 'Object selection', icon: <ScanSearch /> },
    { id: 'brush', label: 'Mask brush', icon: <Brush /> },
    { id: 'pen', label: 'Pen tool', icon: <PenTool /> },
    { id: 'corner', label: 'Corner tool', icon: <Spline /> },
    { id: 'zoom', label: 'Zoom tool', icon: <ZoomIn /> },
    { id: 'artboards', label: 'Manage artboards', icon: <Frame /> },
    { id: 'grid', label: 'Layout grid', icon: <Grid3X3 /> },
    { id: 'rulers', label: 'Rulers and guides', icon: <Ruler /> },
    { id: 'settings', label: 'Design settings', icon: <Settings2 /> },
    { id: 'mouse', label: 'Mouse settings', icon: <MousePointer2 /> },
    { id: 'export', label: 'Export design', icon: <Download /> },
  ]
  return <div className="more-menu-list">{actions.map((action) => <button key={action.id} onClick={() => onAction(action.id)}>{action.icon}<span>{action.label}</span><ChevronRight /></button>)}</div>
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="toast" role="status"><span className="toast-check"><Check size={14} /></span><span>{message}</span><button onClick={onClose} aria-label="Dismiss"><X size={15} /></button></div>
}

interface ExportDialogProps {
  projectName: string
  documentMeta: DesignDocument
  layers: DesignLayer[]
  artboards: ArtboardSnapshot[]
  onClose: () => void
  onSuccess: (message: string) => void
}

function ExportDialog(props: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('PNG')
  const [scale, setScale] = useState(1)
  const [transparent, setTransparent] = useState(false)
  const [quality, setQuality] = useState(92)
  const [fileName, setFileName] = useState(props.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'design')
  const [exporting, setExporting] = useState(false)
  const outputWidth = props.documentMeta.width * scale
  const outputHeight = props.documentMeta.height * scale
  const estimatedMb = Math.max(0.2, outputWidth * outputHeight * (format === 'JPG' ? 0.22 : 0.52) / 1_000_000).toFixed(1)

  const runExport = async () => {
    setExporting(true)
    try {
      await exportDesign({
        format, scale, transparent, quality, fileName,
        documentMeta: props.documentMeta, layers: props.layers, artboards: props.artboards,
      })
      props.onSuccess(`${format === 'PROJECT' ? 'Project' : format} exported`)
    } catch (error) {
      console.error(error)
      setExporting(false)
    }
  }

  return (
    <div className="dialog-layer">
      <button className="dialog-scrim" onClick={props.onClose} aria-label="Close export" />
      <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="dialog-header"><div><span className="dialog-icon"><Download size={19} /></span><div><h2 id="export-title">Export design</h2><p>Choose a format and output size.</p></div></div><IconButton label="Close" onClick={props.onClose}><X /></IconButton></div>
        <div className="export-content">
          <div className="format-grid" role="radiogroup" aria-label="Export format">
            {(['PNG', 'JPG', 'SVG', 'PDF', 'PROJECT'] as ExportFormat[]).map((item) => (
              <button key={item} role="radio" aria-checked={format === item} className={format === item ? 'selected' : ''} onClick={() => setFormat(item)}>
                <span>{item === 'PROJECT' ? <FolderOpen /> : item === 'SVG' ? <Shapes /> : item === 'PDF' ? <FileText /> : <ImageIcon />}</span>
                <strong>{item === 'PROJECT' ? 'Project' : item}</strong>
                {format === item && <i><Check size={12} /></i>}
              </button>
            ))}
          </div>
          <label className="export-field"><span>File name</span><div><input value={fileName} onChange={(event) => setFileName(event.target.value)} /><small>.{format === 'PROJECT' ? 'pocket' : format.toLowerCase()}</small></div></label>
          {format !== 'SVG' && format !== 'PROJECT' && (
            <div className="export-row"><span>Scale</span><div className="segmented scale-control">{[1, 2, 3].map((item) => <button key={item} className={scale === item ? 'selected' : ''} onClick={() => setScale(item)}>{item}×</button>)}</div></div>
          )}
          {format === 'JPG' && <SliderField label="Quality" value={quality} min={1} max={100} unit="%" onChange={setQuality} />}
          {format === 'PNG' && <ToggleRow label="Transparent background" checked={transparent} onChange={setTransparent} />}
          <div className="output-summary">
            <div className="output-preview"><div style={{ aspectRatio: `${props.documentMeta.width}/${props.documentMeta.height}` }}><PosterMini /></div></div>
            <div><span>Output size</span><strong>{format === 'SVG' || format === 'PROJECT' ? 'Vector document' : `${outputWidth} × ${outputHeight} px`}</strong><small>Estimated {estimatedMb} MB</small></div>
          </div>
        </div>
        <div className="dialog-footer"><button className="button secondary" onClick={props.onClose}>Cancel</button><button className="button primary export-confirm" disabled={exporting} onClick={runExport}>{exporting ? <span className="spinner" /> : <Download size={17} />}{exporting ? 'Preparing…' : 'Export'}</button></div>
      </section>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span>{label}</span><button role="switch" aria-checked={checked} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} type="button"><span /></button></label>
}

type ExportOptions = {
  format: ExportFormat
  scale: number
  transparent: boolean
  quality: number
  fileName: string
  documentMeta: DesignDocument
  layers: DesignLayer[]
  artboards: ArtboardSnapshot[]
}

async function exportDesign(options: ExportOptions) {
  const safeName = options.fileName || 'design'
  const embedImages = (layers: DesignLayer[]) => Promise.all(layers.map(async (layer) => {
    if (layer.type !== 'image' || !layer.src || layer.src.startsWith('data:')) return layer
    try { return { ...layer, src: await imageToDataUrl(layer.src) } } catch { return layer }
  }))
  if (options.format === 'PROJECT') {
    const embeddedArtboards = await Promise.all(options.artboards.map(async (artboard) => ({ ...artboard, layers: await embedImages(artboard.layers) })))
    const payload = JSON.stringify({ version: 2, name: safeName, document: embeddedArtboards[0].document, layers: embeddedArtboards[0].layers, artboards: embeddedArtboards }, null, 2)
    downloadBlob(new Blob([payload], { type: 'application/json' }), `${safeName}.pocket`)
    return
  }
  const embeddedLayers = await embedImages(options.layers)
  const includeBackground = options.format !== 'PNG' || !options.transparent
  const svg = buildSvg(embeddedLayers, options.documentMeta, includeBackground)
  if (options.format === 'SVG') {
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${safeName}.svg`)
    return
  }
  await document.fonts.ready
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  const image = new Image()
  image.src = url
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = options.documentMeta.width * options.scale
  canvas.height = options.documentMeta.height * options.scale
  const context = canvas.getContext('2d')!
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  if (options.format === 'JPG') {
    context.fillStyle = options.documentMeta.background
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(url)
  if (options.format === 'PDF') {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({
      orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait', unit: 'px',
      format: [canvas.width, canvas.height], hotfixes: ['px_scaling'],
    })
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height)
    pdf.save(`${safeName}.pdf`)
    return
  }
  const mime = options.format === 'JPG' ? 'image/jpeg' : 'image/png'
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Export failed')), mime, options.quality / 100))
  downloadBlob(blob, `${safeName}.${options.format.toLowerCase()}`)
}

async function sampleArtboardColor(layers: DesignLayer[], meta: DesignDocument, point: Point): Promise<string> {
  // Render the same artwork as export, without selection handles, rulers or grid.
  const embedded = await Promise.all(layers.map(async (layer) => {
    if (layer.type !== 'image' || !layer.src || layer.src.startsWith('data:')) return layer
    return { ...layer, src: await imageToDataUrl(layer.src) }
  }))
  await document.fonts.ready
  const svg = buildSvg(embedded, meta, true)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 4096 / Math.max(meta.width, meta.height), Math.sqrt(16_000_000 / (meta.width * meta.height)))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(meta.width * scale))
    canvas.height = Math.max(1, Math.round(meta.height * scale))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const x = clamp(Math.floor(point.x / meta.width * canvas.width), 0, canvas.width - 1)
    const y = clamp(Math.floor(point.y / meta.height * canvas.height), 0, canvas.height - 1)
    const pixel = ctx.getImageData(x, y, 1, 1).data
    return `#${Array.from(pixel.slice(0, 3), (value) => value.toString(16).padStart(2, '0')).join('')}`
  } finally { URL.revokeObjectURL(url) }
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function imageToDataUrl(url: string) {
  return fetch(url).then((response) => response.blob()).then((blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  }))
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char] || char))
}

function buildSvg(layers: DesignLayer[], meta: DesignDocument, includeBackground: boolean) {
  const defs = layers.map((layer) => {
    let definition = ''
    layer.maskSelections?.forEach((selection, index) => {
      const id = `${layer.id}-${index}`
      if (selection.feather > 0) {
        const bounds = selectionFeatherBounds(layer, selection.feather)
        definition += `<filter id="selection-feather-${id}" filterUnits="userSpaceOnUse" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"><feGaussianBlur stdDeviation="${selection.feather}"/></filter>`
      }
      const filter = selection.feather ? ` filter="url(#selection-feather-${id})"` : ''
      const shape = selection.kind === 'polygon' ? `<polygon points="${selection.points.map((point) => `${layer.x + point.x * layer.width},${layer.y + point.y * layer.height}`).join(' ')}" fill="${selection.mode === 'keep' ? 'white' : 'black'}"${filter}/>` : `<image href="${escapeXml(selection.image)}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="none"${filter}/>`
      definition += `<mask id="selection-mask-${id}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}"><rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" fill="${selection.mode === 'keep' ? 'black' : 'white'}"/>${shape}</mask>`
    })
    if (layer.blur?.enabled && layer.blur.type === 'gaussian') {
      const bounds = gaussianBounds(layer)
      definition += `<filter id="blur-${layer.id}" filterUnits="userSpaceOnUse" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${layer.blur.amount}"/></filter>`
    }
    if (layer.fillType && layer.fillType !== 'solid' && layer.gradient) {
      const stops = layer.gradient.stops.map((stop) => `<stop offset="${stop.offset * 100}%" stop-color="${stop.color}"/>`).join('')
      definition += layer.gradient.type === 'linear'
        ? `<linearGradient id="gradient-${layer.id}" x1="0" y1="0.5" x2="1" y2="0.5" gradientTransform="rotate(${layer.gradient.angle} .5 .5)">${stops}</linearGradient>`
        : `<radialGradient id="gradient-${layer.id}" cx="50%" cy="50%" r="70%">${stops}</radialGradient>`
    }
    if (layer.type === 'image') {
      const mask = layer.mask || 'none'
      const shape = mask === 'ellipse'
        ? `<ellipse cx="${layer.x + layer.width / 2}" cy="${layer.y + layer.height / 2}" rx="${layer.width / 2}" ry="${layer.height / 2}"/>`
        : mask === 'star'
          ? `<polygon points="${starPoints(layer.x + layer.width / 2, layer.y + layer.height / 2, Math.min(layer.width, layer.height) / 2, Math.min(layer.width, layer.height) / 4.3)}"/>`
          : `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${mask === 'rounded' ? Math.min(layer.width, layer.height) * .16 : layer.radius || 0}"/>`
      definition += `<clipPath id="clip-${layer.id}">${shape}</clipPath>`
    }
    if (layer.maskStrokes?.length || layer.maskSelections?.length) {
      const maskExtent = Math.max(layer.width, layer.height, 1)
      const strokes = (layer.maskStrokes || []).map((stroke) => `<path d="${smoothPath(maskStrokePoints(layer, stroke), .55)}" fill="none" stroke="${stroke.mode === 'hide' ? 'black' : 'white'}" stroke-width="${maskStrokeWidth(layer, stroke)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')
      const base = (layer.maskSelections || []).reduce((node, _selection, index) => `<g mask="url(#selection-mask-${layer.id}-${index})">${node}</g>`, `<rect x="${layer.x - layer.width}" y="${layer.y - maskExtent}" width="${layer.width * 3}" height="${maskExtent * 3}" fill="white"/>`)
      definition += `<mask id="paint-mask-${layer.id}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="${layer.x - layer.width}" y="${layer.y - maskExtent}" width="${layer.width * 3}" height="${maskExtent * 3}">${base}${strokes}</mask>`
    }
    return definition
  }).join('')
  const body = layers.filter((layer) => layer.visible).map((layer) => {
    const cx = layer.x + layer.width / 2
    const cy = layer.y + layer.height / 2
    const transform = layerTransform(layer)
    const opacity = layer.opacity
    const fill = layer.fillType && layer.fillType !== 'solid' && layer.gradient ? `url(#gradient-${layer.id})` : layer.fill
    const wrap = (element: string) => {
      const source = `<g transform="${transform}"${layer.maskStrokes?.length || layer.maskSelections?.length ? ` mask="url(#paint-mask-${layer.id})"` : ''}>${element}</g>`
      const samples = blurSamples(layer)
      const filtered = layer.blur?.enabled && layer.blur.type === 'gaussian' ? `<g filter="url(#blur-${layer.id})">${source}</g>` : samples.length ? samples.map((sample) => `<g transform="${sample.transform}" opacity="${sample.opacity}" style="mix-blend-mode:plus-lighter">${source}</g>`).join('') : source
      return `<g style="isolation:isolate;mix-blend-mode:${layer.blendMode || 'normal'}">${filtered}</g>`
    }
    if (layer.type === 'rectangle') return wrap(`<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.radius || 0}" fill="${fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}"/>`)
    if (layer.type === 'ellipse') return wrap(`<ellipse cx="${cx}" cy="${cy}" rx="${layer.width / 2}" ry="${layer.height / 2}" fill="${fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}"/>`)
    if (layer.type === 'polygon') return wrap(`<path d="${polygonLayerPath(layer)}" fill-rule="evenodd" fill="${fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" stroke-linejoin="round" opacity="${opacity}"/>`)
    if (layer.type === 'image') {
      const scale = layer.imageScale || 1
      const width = layer.width * scale
      const height = layer.height * scale
      const x = layer.x - (width - layer.width) / 2 + (layer.imageOffsetX || 0)
      const y = layer.y - (height - layer.height) / 2 + (layer.imageOffsetY || 0)
      return wrap(`<image href="${escapeXml(layer.src || '')}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${layer.id})" opacity="${opacity}"/>`)
    }
    if (layer.type === 'line') return wrap(`<line x1="${layer.x}" y1="${layer.y}" x2="${layer.x + layer.width}" y2="${layer.y + layer.height}" stroke="${layer.stroke}" stroke-width="${Math.max(layer.strokeWidth, 2)}" stroke-linecap="round" opacity="${opacity}"/>`)
    if (layer.type === 'star') return wrap(`<polygon points="${starPoints(cx, cy, Math.min(layer.width, layer.height) / 2, Math.min(layer.width, layer.height) / 4.3)}" fill="${fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}"/>`)
    if (layer.type === 'path' || layer.type === 'brush') {
      const points = layerPoints(layer)
      const data = layer.type === 'brush' ? smoothPath(points, layer.smoothing || .5) : pointPath(points, Boolean(layer.closed))
      return wrap(`<path d="${data}" fill="${layer.closed ? fill : 'none'}" stroke="${layer.stroke}" stroke-width="${Math.max(layer.strokeWidth, 1)}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`)
    }
    const fontSize = layer.fontSize || 32
    const x = layer.textAlign === 'center' ? layer.x + layer.width / 2 : layer.textAlign === 'right' ? layer.x + layer.width : layer.x
    const anchor = layer.textAlign === 'center' ? 'middle' : layer.textAlign === 'right' ? 'end' : 'start'
    return wrap(`<text xml:space="preserve" x="${x}" y="${layer.y + fontSize * 0.84}" transform="translate(${x} 0) scale(${layer.textScaleX || 1} 1) translate(${-x} 0)" fill="${fill}" font-family="${escapeXml(layer.fontFamily || 'Inter')}" font-size="${fontSize}" font-weight="${layer.fontWeight || 400}" letter-spacing="${layer.letterSpacing || 0}" text-anchor="${anchor}" opacity="${opacity}">${textLines(layer).map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : fontSize * (layer.lineHeight || 1.2)}">${escapeXml(line)}</tspan>`).join('')}</text>`)
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${meta.width}" height="${meta.height}" viewBox="0 0 ${meta.width} ${meta.height}"><defs>${defs}</defs>${includeBackground ? `<rect width="100%" height="100%" fill="${meta.background}"/>` : ''}${body}</svg>`
}

function HomeScreen({ theme, onToggleTheme, onNew, onImport, onOpenSample, onOpenCurrent, currentName, hasCurrent }: {
  theme: Theme; onToggleTheme: () => void; onNew: () => void; onImport: (file: File) => void; onOpenSample: () => void; onOpenCurrent: () => void; currentName: string; hasCurrent: boolean
}) {
  const importInputRef = useRef<HTMLInputElement>(null)
  const [backupHelp, setBackupHelp] = useState(false)
  return (
    <div className="home-screen">
      <HomeHeader theme={theme} onToggleTheme={onToggleTheme} onNew={onNew} />
      <main className="home-main">
        <section className="home-intro">
          <div><span className="eyebrow">Your workspace</span><h1>Designs</h1><p>Everything stays on this device, ready whenever you are.</p></div>
          <div className="home-actions"><button className="button secondary" onClick={() => importInputRef.current?.click()}><Upload size={17} /> Import project</button><button className="button primary" onClick={onNew}><Plus size={18} /> New design</button></div>
        </section>
        <section className="recent-section">
          <div className="section-title-row"><div><h2>Recent designs</h2><span>{hasCurrent ? 4 : 3} designs</span></div></div>
          <div className="project-grid">
            {hasCurrent && <ProjectCard name={currentName} meta="Edited just now" variant="current" onClick={onOpenCurrent} />}
            <ProjectCard name="Objects & Space" meta="Edited just now" variant="poster" onClick={onOpenSample} />
            <ProjectCard name="Sonder identity" meta="Edited yesterday" variant="sonder" onClick={onOpenSample} />
            <ProjectCard name="Lagos / 26" meta="Edited 4 days ago" variant="lagos" onClick={onOpenSample} />
            <button className="new-project-card" onClick={onNew}><span><Plus /></span><strong>Create a design</strong><small>Start from a preset or custom size</small></button>
          </div>
        </section>
        <section className="quick-start-section">
          <div className="section-title-row"><h2>Quick start</h2><button onClick={onNew}>View all sizes <ChevronRight size={15} /></button></div>
          <div className="quick-start-grid">
            <button onClick={onNew}><span className="quick-icon square"><LayoutGrid /></span><div><strong>Instagram post</strong><small>1080 × 1080 px</small></div><Plus /></button>
            <button onClick={onNew}><span className="quick-icon portrait"><Smartphone /></span><div><strong>Story or reel</strong><small>1080 × 1920 px</small></div><Plus /></button>
            <button onClick={onNew}><span className="quick-icon document"><FileText /></span><div><strong>A4 document</strong><small>210 × 297 mm</small></div><Plus /></button>
            <button onClick={onNew}><span className="quick-icon custom"><SlidersHorizontal /></span><div><strong>Custom size</strong><small>Set your own dimensions</small></div><Plus /></button>
          </div>
        </section>
        <div className="backup-reminder"><span><FolderOpen size={19} /></span><div><strong>Keep a backup of your work</strong><p>Your designs are stored on this device only. Export a backup to keep them safe.</p>{backupHelp && <p className="backup-help" role="status">Open a design, choose Export, then select Project to save an editable .pocket backup.</p>}</div><button className="button secondary" onClick={() => setBackupHelp((visible) => !visible)} aria-expanded={backupHelp}>{backupHelp ? 'Hide guide' : 'Learn how'}</button></div>
      </main>
      <input ref={importInputRef} className="visually-hidden" type="file" accept=".pocket,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = '' }} />
    </div>
  )
}

function HomeHeader({ theme, onToggleTheme, onNew }: { theme: Theme; onToggleTheme: () => void; onNew: () => void }) {
  return (
    <header className="home-header"><button className="home-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><LogoMark /><span>Pocketboard</span></button><nav><button className="active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Designs</button></nav><div><IconButton label={theme === 'light' ? 'Use dark theme' : 'Use light theme'} onClick={onToggleTheme}>{theme === 'light' ? <Moon /> : <Sun />}</IconButton><button className="button primary compact-new" onClick={onNew}><Plus size={17} /> New</button></div></header>
  )
}

function ProjectCard({ name, meta, variant, onClick }: { name: string; meta: string; variant: 'poster' | 'sonder' | 'lagos' | 'current'; onClick: () => void }) {
  return (
    <article className="project-card"><button className="project-thumbnail" onClick={onClick} aria-label={`Open ${name}`}><div className={`thumbnail-art ${variant}`}>{variant === 'poster' ? <PosterMini /> : variant === 'sonder' ? <><span className="sonder-s">S</span><span className="sonder-label">SONDER®<br />STUDIO</span></> : variant === 'lagos' ? <><span className="lagos-small">CULTURE / DESIGN / PEOPLE</span><strong>LAGOS<br />/26</strong><i /></> : <><span className="current-grid" /><strong>{name.slice(0, 1).toUpperCase()}</strong></>}</div></button><div className="project-card-info"><div><strong>{name}</strong><span>{meta}</span></div></div></article>
  )
}

function PosterMini() {
  return <div className="poster-mini"><span className="mini-orange" /><img src="/editorial-chair.jpg" alt="" /><strong>OBJECTS<br />FOR LIVING</strong><span className="mini-blue"><b>04</b><small>NORTHLINE STUDIO</small></span></div>
}

function NewDesignScreen({ theme, onToggleTheme, onBack, onCreate }: { theme: Theme; onToggleTheme: () => void; onBack: () => void; onCreate: (meta: DesignDocument, name: string) => void }) {
  const [selectedPreset, setSelectedPreset] = useState(presets[1])
  const [width, setWidth] = useState(selectedPreset.width)
  const [height, setHeight] = useState(selectedPreset.height)
  const [unit, setUnit] = useState<DesignDocument['unit']>(selectedPreset.unit)
  const [dpi, setDpi] = useState(selectedPreset.unit === 'px' ? 72 : 300)
  const [background, setBackground] = useState('#FFFFFF')
  const [name, setName] = useState('Untitled design')
  const choosePreset = (preset: typeof presets[number]) => {
    setSelectedPreset(preset); setWidth(preset.width); setHeight(preset.height); setUnit(preset.unit); setDpi(preset.unit === 'px' ? 72 : 300)
  }
  const meta: DesignDocument = { width, height, unit, dpi, background, presetName: selectedPreset.name }
  return (
    <div className="new-design-screen">
      <header className="new-header"><button className="home-brand" onClick={onBack}><LogoMark /><span>Pocketboard</span></button><div><IconButton label={theme === 'light' ? 'Use dark theme' : 'Use light theme'} onClick={onToggleTheme}>{theme === 'light' ? <Moon /> : <Sun />}</IconButton><button className="button secondary" onClick={onBack}>Cancel</button><button className="button primary" onClick={() => onCreate(meta, name)}>Create design</button></div></header>
      <main className="new-main">
        <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to designs</button>
        <div className="new-title"><span className="eyebrow">Start something new</span><h1>New design</h1><p>Choose a preset or set custom dimensions.</p></div>
        <div className="new-layout">
          <section className="presets-area">
            {['Social', 'Print', 'Web'].map((category) => <div className="preset-category" key={category}><h2>{category}</h2><div className="preset-grid">{presets.filter((preset) => preset.category === category).map((preset) => <button key={preset.id} className={selectedPreset.id === preset.id ? 'selected' : ''} onClick={() => choosePreset(preset)}><span className={`preset-shape ${preset.icon}`}><i /></span><div><strong>{preset.name}</strong><small>{preset.width} × {preset.height} {preset.unit}</small></div>{selectedPreset.id === preset.id && <em><Check size={12} /></em>}</button>)}</div></div>)}
          </section>
          <aside className="custom-card">
            <div className="custom-card-heading"><span><SlidersHorizontal /></span><div><h2>Custom size</h2><p>Set exact canvas dimensions.</p></div></div>
            <label className="new-field"><span>Design name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <div className="new-dimension-label"><span>Dimensions</span><button onClick={() => { setWidth(height); setHeight(width) }}><RotateCw size={14} /> Swap</button></div>
            <div className="new-dimensions"><label><span>Width</span><input type="number" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label><span>×</span><label><span>Height</span><input type="number" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label><label className="unit-select"><span>Unit</span><select value={unit} onChange={(event) => setUnit(event.target.value as DesignDocument['unit'])}><option>px</option><option>mm</option><option>cm</option><option>in</option></select><ChevronDown size={14} /></label></div>
            {unit !== 'px' && <label className="new-field"><span>Print resolution</span><div className="field-with-unit"><input type="number" value={dpi} onChange={(event) => setDpi(Number(event.target.value))} /><small>DPI</small></div></label>}
            <div className="new-field"><span>Background</span><div className="background-choices">{['#FFFFFF', '#F4EEE4', '#18181B', '#5B4BF0'].map((colour) => <button key={colour} className={background === colour ? 'selected' : ''} onClick={() => setBackground(colour)} style={{ background: colour }} aria-label={`Background ${colour}`}>{background === colour && <Check size={13} />}</button>)}<label><Palette size={16} /><input type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label></div></div>
            <div className="custom-summary"><Monitor size={18} /><div><span>{width} × {height} {unit}</span><small>{unit === 'px' ? 'Screen design' : `${dpi} DPI print design`}</small></div></div>
            <button className="button primary full-button" onClick={() => onCreate(meta, name)}>Create design <ChevronRight size={17} /></button>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default App
