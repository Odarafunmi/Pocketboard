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
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  Frame,
  Grid3X3,
  GripVertical,
  Group,
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
  MoreHorizontal,
  MousePointer2,
  Move,
  Palette,
  PenTool,
  Pipette,
  Plus,
  Redo2,
  RotateCw,
  Ruler,
  Search,
  Settings2,
  Share2,
  Shapes,
  SlidersHorizontal,
  Smartphone,
  Spline,
  Square,
  Star,
  Sun,
  Trash2,
  Triangle,
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
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { emptyDocumentLayers, presets, sampleDocument, sampleLayers } from './data'
import type {
  ArtboardSnapshot,
  CanvasGuide,
  DesignDocument,
  DesignLayer,
  ExportFormat,
  GradientFill,
  LayerType,
  MobileSheet,
  Point,
  Theme,
  Tool,
  View,
} from './types'

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
  gradient: layer.gradient ? { ...layer.gradient, stops: layer.gradient.stops.map((stop) => ({ ...stop })) } : undefined,
}))
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round = (value: number) => Math.round(value)
const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

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
    if (window.location.hash === '#home') return 'home'
    if (window.location.hash === '#new') return 'new'
    return 'editor'
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
  const [exportOpen, setExportOpen] = useState(false)
  const [savingState, setSavingState] = useState<'Saving' | 'Saved'>('Saved')
  const [toast, setToast] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const artboardRef = useRef<SVGSVGElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const clipboardRef = useRef<DesignLayer | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const layersRef = useRef(layers)

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

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

  useEffect(() => {
    setSavingState('Saving')
    const timer = window.setTimeout(() => {
      localStorage.setItem('pocketboard-layers', JSON.stringify(layers))
      localStorage.setItem('pocketboard-document-meta', JSON.stringify(documentMeta))
      localStorage.setItem('pocketboard-project-name', projectName)
      localStorage.setItem('pocketboard-active-artboard', activeArtboardId)
      localStorage.setItem('pocketboard-artboards', JSON.stringify(artboards.map((artboard) => artboard.id === activeArtboardId
        ? { ...artboard, document: documentMeta, layers }
        : artboard)))
      localStorage.setItem('pocketboard-grid', String(gridVisible))
      localStorage.setItem('pocketboard-grid-size', String(gridSize))
      localStorage.setItem('pocketboard-guides-visible', String(guidesVisible))
      localStorage.setItem('pocketboard-guides', JSON.stringify(canvasGuides))
      setSavingState('Saved')
    }, 500)
    return () => window.clearTimeout(timer)
  }, [layers, documentMeta, projectName, activeArtboardId, artboards, gridVisible, gridSize, guidesVisible, canvasGuides])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000)
  }, [])

  const navigate = (nextView: View) => {
    setView(nextView)
    const hash = nextView === 'editor' ? '' : `#${nextView}`
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
    setPast((items) => [...items.slice(-99), cloneLayers(layersRef.current)])
    setFuture([])
    setLayers(nextLayers)
    if (message) showToast(message)
  }, [showToast])

  const updateLayer = useCallback((id: string, patch: Partial<DesignLayer>, record = true) => {
    const current = layersRef.current
    const next = current.map((layer) => layer.id === id ? { ...layer, ...patch } : layer)
    if (record) commitLayers(next)
    else setLayers(next)
  }, [commitLayers])

  const undo = useCallback(() => {
    if (!past.length) return
    const previous = past[past.length - 1]
    setFuture((items) => [cloneLayers(layersRef.current), ...items].slice(0, 100))
    setPast((items) => items.slice(0, -1))
    setLayers(cloneLayers(previous))
  }, [past])

  const redo = useCallback(() => {
    if (!future.length) return
    const next = future[0]
    setPast((items) => [...items.slice(-99), cloneLayers(layersRef.current)])
    setFuture((items) => items.slice(1))
    setLayers(cloneLayers(next))
  }, [future])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    const layer = layersRef.current.find((item) => item.id === selectedId)
    if (!layer || layer.locked) return
    commitLayers(layersRef.current.filter((item) => item.id !== selectedId), 'Layer deleted')
    setSelectedId(null)
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

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const imageLayer: DesignLayer = {
        id: makeId(), name: file.name.replace(/\.[^/.]+$/, '') || 'Image', type: 'image',
        x: documentMeta.width * 0.25, y: documentMeta.height * 0.25,
        width: documentMeta.width * 0.5, height: documentMeta.height * 0.42,
        rotation: 0, opacity: 1, visible: true, locked: false,
        fill: '#E8E8EA', fillType: 'solid', stroke: 'transparent', strokeWidth: 0, radius: 0,
        src: String(reader.result), mask: 'none', imageOffsetX: 0, imageOffsetY: 0, imageScale: 1,
      }
      commitLayers([...layersRef.current, imageLayer], 'Image added')
      setSelectedId(imageLayer.id)
      setActiveTool('select')
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (editing) return
      const command = event.metaKey || event.ctrlKey
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
      else if (event.key.toLowerCase() === 'h') setActiveTool('hand')
      else if (event.key.toLowerCase() === 'r') setActiveTool('rectangle')
      else if (event.key.toLowerCase() === 't') setActiveTool('text')
      else if (event.key.toLowerCase() === 'p') setActiveTool('pen')
      else if (event.key.toLowerCase() === 'b') setActiveTool('brush')
      else if (event.key.toLowerCase() === 'z') setActiveTool('zoom')
      else if (event.key.toLowerCase() === 'u') setActiveTool('polygon')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTool, commitLayers, deleteSelected, duplicateSelected, redo, selectedId, undo, updateLayer])

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
  const syncedArtboards = artboards.map((artboard) => artboard.id === activeArtboardId ? { ...artboard, document: documentMeta, layers } : artboard)
  const exportArtboards = [...syncedArtboards.filter((artboard) => artboard.id === activeArtboardId), ...syncedArtboards.filter((artboard) => artboard.id !== activeArtboardId)]

  return (
    <div className="app-shell editor-app">
      <TopBar
        projectName={projectName}
        setProjectName={setProjectName}
        renaming={renaming}
        setRenaming={setRenaming}
        savingState={savingState}
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

      <div className="editor-body">
        <ToolRail
          activeTool={activeTool}
          onTool={(tool) => {
            if (tool === 'image') imageInputRef.current?.click()
            else setActiveTool(tool)
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
            onAdd={() => addLayer('rectangle')}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onMoveUp={() => reorderSelected('up')}
            onMoveDown={() => reorderSelected('down')}
          />
        </aside>

        <main className={`workspace tool-${activeTool} ${guidesVisible ? 'with-rulers' : ''}`} aria-label="Design canvas">
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
            gridVisible={gridVisible}
            gridSize={gridSize}
            guidesVisible={guidesVisible}
            userGuides={canvasGuides}
            onSelect={setSelectedId}
            onAddLayer={addLayer}
            onAddPath={addDrawnPath}
            onOpenArtboards={openArtboardManager}
            onZoom={(delta) => setZoom((value) => clamp(value + delta, 5, 6400))}
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
              onOpenProperties={() => setMobileSheet('properties')}
              onOpenMask={() => setMobileSheet('mask')}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onDoneTool={() => setActiveTool('select')}
              onUpdate={(patch) => updateLayer(selected.id, patch)}
            />
          )}

          <ZoomControl
            zoom={zoom}
            onZoomOut={() => setZoom((value) => clamp(value - (value >= 800 ? 400 : value >= 200 ? 50 : 10), 5, 6400))}
            onZoomIn={() => setZoom((value) => clamp(value + (value >= 800 ? 400 : value >= 200 ? 50 : 10), 5, 6400))}
            onFit={() => setZoom(68)}
          />
        </main>

        <aside className="properties-panel desktop-panel" aria-label="Properties panel">
          <PropertiesPanel
            selected={selected}
            documentMeta={documentMeta}
            onUpdate={(patch) => selected && updateLayer(selected.id, patch)}
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
        onSelect={() => setActiveTool('select')}
        onShapes={() => setMobileSheet('shapes')}
        onText={() => setActiveTool('text')}
        onImage={() => imageInputRef.current?.click()}
        onLayers={() => setMobileSheet('layers')}
        onMore={() => setMobileSheet('more')}
      />

      {mobileSheet && (
        <MobileSheetView title={mobileSheet === 'layers' ? 'Layers' : mobileSheet === 'properties' ? 'Properties' : mobileSheet === 'shapes' ? 'Add shape' : mobileSheet === 'artboards' ? 'Artboards' : mobileSheet === 'mask' ? 'Crop and mask' : 'More'} onClose={() => setMobileSheet(null)}>
          {mobileSheet === 'layers' && (
            <LayersPanel
              layers={layers}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setMobileSheet(null) }}
              onToggleVisible={(layer) => updateLayer(layer.id, { visible: !layer.visible })}
              onToggleLock={(layer) => updateLayer(layer.id, { locked: !layer.locked })}
              onAdd={() => addLayer('rectangle')}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onMoveUp={() => reorderSelected('up')}
              onMoveDown={() => reorderSelected('down')}
              insideSheet
            />
          )}
          {mobileSheet === 'properties' && (
            <PropertiesPanel
              selected={selected}
              documentMeta={documentMeta}
              onUpdate={(patch) => selected && updateLayer(selected.id, patch)}
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
          {mobileSheet === 'shapes' && <ShapesGrid onAdd={addLayer} />}
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
                else if (action === 'pen' || action === 'brush' || action === 'zoom' || action === 'corner') setActiveTool(action)
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

      <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*" onChange={handleImageUpload} />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

interface TopBarProps {
  projectName: string
  setProjectName: (name: string) => void
  renaming: boolean
  setRenaming: (value: boolean) => void
  savingState: 'Saving' | 'Saved'
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
          <span className={`save-status ${props.savingState.toLowerCase()}`}><span className="status-dot" />{props.savingState}</span>
        </div>
        <div className="history-controls">
          <IconButton label="Undo" shortcut="Ctrl Z" onClick={props.onUndo} disabled={!props.canUndo}><Undo2 /></IconButton>
          <IconButton label="Redo" shortcut="Ctrl Shift Z" onClick={props.onRedo} disabled={!props.canRedo}><Redo2 /></IconButton>
        </div>
      </div>
      <div className="topbar-actions">
        <IconButton className="theme-button" label={props.theme === 'light' ? 'Use dark theme' : 'Use light theme'} onClick={props.onToggleTheme}>
          {props.theme === 'light' ? <Moon /> : <Sun />}
        </IconButton>
        <button className="button secondary share-button" onClick={props.onShare}><Share2 size={17} /><span>Share</span></button>
        <button className="button primary export-button" onClick={props.onExport}><Download size={17} /><span>Export</span></button>
        <IconButton className="mobile-more" label="More options"><MoreHorizontal /></IconButton>
      </div>
    </header>
  )
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
    { id: 'hand', label: 'Hand tool', shortcut: 'H', icon: <Hand /> },
    { id: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: <Square />, divider: true },
    { id: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: <Circle /> },
    { id: 'polygon', label: 'Polygon', shortcut: 'U', icon: <Hexagon /> },
    { id: 'star', label: 'Star', icon: <Star /> },
    { id: 'line', label: 'Line', shortcut: 'L', icon: <Minus /> },
    { id: 'pen', label: 'Pen tool', shortcut: 'P', icon: <PenTool />, divider: true },
    { id: 'brush', label: 'Brush tool', shortcut: 'B', icon: <Brush /> },
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
  onAdd: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  insideSheet?: boolean
}

function LayersPanel(props: LayersPanelProps) {
  const [query, setQuery] = useState('')
  const visibleLayers = [...props.layers].reverse().filter((layer) => layer.name.toLowerCase().includes(query.toLowerCase()))
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
      <div className="layer-list" role="listbox" aria-label="Canvas layers">
        {visibleLayers.length ? visibleLayers.map((layer) => (
          <div
            key={layer.id}
            role="option"
            aria-selected={props.selectedId === layer.id}
            className={`layer-row ${props.selectedId === layer.id ? 'selected' : ''} ${!layer.visible ? 'muted' : ''}`}
            onClick={() => props.onSelect(layer.id)}
          >
            <button className="row-grip" aria-label={`Reorder ${layer.name}`} onClick={(event) => event.stopPropagation()}><GripVertical size={14} /></button>
            <LayerThumbnail layer={layer} />
            <span className="layer-name">{layer.name}</span>
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
      <div className="panel-footer-actions">
        <IconButton label="Group selection"><Group /></IconButton>
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
  gridVisible: boolean
  gridSize: number
  guidesVisible: boolean
  userGuides: CanvasGuide[]
  onSelect: (id: string | null) => void
  onAddLayer: (type: LayerType, point?: { x: number; y: number }, preset?: Partial<DesignLayer>) => void
  onAddPath: (points: Point[], type: 'path' | 'brush', closed?: boolean) => void
  onOpenArtboards: () => void
  onZoom: (delta: number) => void
  onUpdateGuide: (id: string, position: number) => void
  onDeleteGuide: (id: string) => void
  onUpdateLive: (id: string, patch: Partial<DesignLayer>) => void
  onCommitSnapshot: (layers: DesignLayer[]) => void
}

type TransformState = {
  mode: 'move' | 'resize' | 'rotate' | 'corner' | 'crop'
  id: string
  startClientX: number
  startClientY: number
  original: DesignLayer
  snapshot: DesignLayer[]
  handle?: 'nw' | 'ne' | 'sw' | 'se'
  moved: boolean
}

type SmartGuideState = { x?: number; y?: number }

function Canvas(props: CanvasProps) {
  const onAddPath = props.onAddPath
  const transformRef = useRef<TransformState | null>(null)
  const layersRef = useRef(props.layers)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null)
  const longPressPointerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const [smartGuides, setSmartGuides] = useState<SmartGuideState>({})
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const draftPointsRef = useRef<Point[]>([])
  useEffect(() => { layersRef.current = props.layers }, [props.layers])
  useEffect(() => { draftPointsRef.current = draftPoints }, [draftPoints])
  useEffect(() => { setDraftPoints([]) }, [props.activeTool])
  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const pointerToCanvas = useCallback((clientX: number, clientY: number) => {
    const svg = props.artboardRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: clamp((clientX - rect.left) * props.documentMeta.width / rect.width, 0, props.documentMeta.width),
      y: clamp((clientY - rect.top) * props.documentMeta.height / rect.height, 0, props.documentMeta.height),
    }
  }, [props.artboardRef, props.documentMeta.height, props.documentMeta.width])

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

  const startTransform = (event: ReactPointerEvent, layer: DesignLayer, mode: TransformState['mode'], handle?: TransformState['handle']) => {
    const allowed = (props.activeTool === 'select' && ['move', 'resize', 'rotate'].includes(mode))
      || (props.activeTool === 'corner' && mode === 'corner')
      || (props.activeTool === 'crop' && mode === 'crop')
    if (layer.locked || !allowed) return
    event.stopPropagation()
    event.preventDefault()
    props.onSelect(layer.id)
    transformRef.current = {
      mode, id: layer.id, startClientX: event.clientX, startClientY: event.clientY,
      original: { ...layer }, snapshot: cloneLayers(layersRef.current), handle, moved: false,
    }

    const onMove = (moveEvent: PointerEvent) => {
      const state = transformRef.current
      const svg = props.artboardRef.current
      if (!state || !svg) return
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
        const minimum = 20
        let x = state.original.x
        let y = state.original.y
        let width = state.original.width
        let height = Math.max(state.original.height, state.original.type === 'line' ? 0 : minimum)
        if (state.handle?.includes('e')) width = Math.max(minimum, state.original.width + dx)
        if (state.handle?.includes('s')) height = Math.max(state.original.type === 'line' ? 0 : minimum, state.original.height + dy)
        if (state.handle?.includes('w')) {
          width = Math.max(minimum, state.original.width - dx)
          x = state.original.x + (state.original.width - width)
        }
        if (state.handle?.includes('n')) {
          height = Math.max(minimum, state.original.height - dy)
          y = state.original.y + (state.original.height - height)
        }
        props.onUpdateLive(state.id, { x, y, width, height })
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
    const onUp = () => {
      const state = transformRef.current
      if (state?.moved) props.onCommitSnapshot(state.snapshot)
      transformRef.current = null
      setSmartGuides({})
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const startBrushStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.preventDefault()
    const start = pointerToCanvas(event.clientX, event.clientY)
    const points = [start]
    setDraftPoints(points)
    const onMove = (moveEvent: PointerEvent) => {
      const point = pointerToCanvas(moveEvent.clientX, moveEvent.clientY)
      const previous = points[points.length - 1]
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < 2) return
      points.push(point)
      setDraftPoints([...points])
    }
    const onUp = () => {
      if (points.length > 1) props.onAddPath(points, 'brush', false)
      setDraftPoints([])
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
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
    if (event.pointerType !== 'touch' || !['select', 'hand'].includes(props.activeTool)) return
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
        const transform = transformRef.current
        if (transform?.moved) {
          props.onUpdateLive(transform.id, transform.original)
          transform.moved = false
        }
      }
      cleanup()
      // Open after release so the touch's synthetic click cannot immediately dismiss the sheet.
      if (shouldOpen) window.setTimeout(props.onOpenArtboards, 0)
    }
    const onCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId === longPressPointerRef.current) cleanup()
    }
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
    if (props.activeTool === 'select') startTransform(event, layer, 'move')
    else if (props.activeTool === 'corner' && (layer.type === 'rectangle' || (layer.type === 'polygon' && (layer.shapeKind === 'regular' || layer.shapeKind === 'diamond')))) {
      event.stopPropagation()
      props.onSelect(layer.id)
    } else if (props.activeTool === 'crop' && layer.type === 'image') {
      startTransform(event, layer, 'crop')
    }
  }

  const onBackgroundPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (props.activeTool === 'brush') {
      startBrushStroke(event)
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
    if (['rectangle', 'ellipse', 'polygon', 'text', 'star', 'line'].includes(props.activeTool)) {
      const point = pointerToCanvas(event.clientX, event.clientY)
      props.onAddLayer(props.activeTool as LayerType, point)
      return
    }
    const target = event.target as SVGElement
    if (target.dataset.layer) return
    if (props.activeTool === 'select') props.onSelect(null)
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
  return (
    <div className="canvas-scroll">
      <div className="artboard-zoom-space" style={{ width: fitWidth * zoomRatio, height: fitHeight * zoomRatio }}>
      <div className="artboard-scale" style={{ width: fitWidth, height: fitHeight, transform: `scale(${zoomRatio})`, '--zoom-ratio': zoomRatio, '--artboard-aspect': aspect } as CSSProperties}>
        {props.guidesVisible && <><div className="canvas-ruler ruler-horizontal"><span>0</span><span>{round(props.documentMeta.width / 2)}</span><span>{props.documentMeta.width}</span></div><div className="canvas-ruler ruler-vertical"><span>0</span><span>{round(props.documentMeta.height / 2)}</span><span>{props.documentMeta.height}</span></div></>}
        <svg
          ref={props.artboardRef}
          className="artboard"
          viewBox={`0 0 ${props.documentMeta.width} ${props.documentMeta.height}`}
          role="img"
          aria-label={`Artboard, ${props.documentMeta.width} by ${props.documentMeta.height} pixels. Long-press to manage artboards.`}
          onPointerDownCapture={startArtboardLongPress}
          onPointerDown={onBackgroundPointerDown}
        >
          <rect width={props.documentMeta.width} height={props.documentMeta.height} fill={props.documentMeta.background} data-artboard-background="true" />
          <defs>
            <pattern id="canvas-grid-pattern" width={props.gridSize} height={props.gridSize} patternUnits="userSpaceOnUse">
              <path d={`M ${props.gridSize} 0 L 0 0 0 ${props.gridSize}`} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </pattern>
            {props.layers.map((layer) => <LayerDefinition key={layer.id} layer={layer} />)}
          </defs>
          {props.layers.filter((layer) => layer.visible).map((layer) => (
            <LayerElement key={layer.id} layer={layer} onPointerDown={(event) => onLayerPointerDown(event, layer)} />
          ))}
          {props.gridVisible && <rect className="canvas-grid-overlay" width={props.documentMeta.width} height={props.documentMeta.height} fill="url(#canvas-grid-pattern)" pointerEvents="none" />}
          {props.guidesVisible && props.userGuides.map((guide) => guide.axis === 'x'
            ? <line key={guide.id} className="user-guide guide-x" x1={guide.position} x2={guide.position} y1="0" y2={props.documentMeta.height} stroke={RULER_GUIDE_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke" onPointerDown={(event) => startGuideDrag(event, guide)} />
            : <line key={guide.id} className="user-guide guide-y" y1={guide.position} y2={guide.position} x1="0" x2={props.documentMeta.width} stroke={RULER_GUIDE_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke" onPointerDown={(event) => startGuideDrag(event, guide)} />)}
          {smartGuides.x !== undefined && <line className="smart-guide" x1={smartGuides.x} x2={smartGuides.x} y1="0" y2={props.documentMeta.height} stroke={GUIDE_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          {smartGuides.y !== undefined && <line className="smart-guide" y1={smartGuides.y} y2={smartGuides.y} x1="0" x2={props.documentMeta.width} stroke={GUIDE_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          {draftPoints.length > 0 && props.activeTool === 'brush' && <path d={smoothPath(draftPoints, .55)} fill="none" stroke="#18181B" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />}
          {draftPoints.length > 0 && props.activeTool === 'pen' && <g className="pen-draft" pointerEvents="none"><polyline points={draftPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" />{draftPoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={index === 0 && draftPoints.length >= 3 ? 9 : 6} fill="white" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}</g>}
          {props.selected?.visible && (
            <SelectionOverlay
              layer={props.selected}
              mode={props.activeTool}
              onResize={(event, handle) => startTransform(event, props.selected!, 'resize', handle)}
              onRotate={(event) => startTransform(event, props.selected!, 'rotate')}
              onCorner={(event) => startTransform(event, props.selected!, 'corner')}
              onCrop={(event) => startTransform(event, props.selected!, 'crop')}
            />
          )}
        </svg>
        {props.activeTool === 'pen' && <div className="canvas-tool-tip"><PenTool size={14} /> Click to add points · click the first point to close · Enter to finish</div>}
        {props.activeTool === 'brush' && <div className="canvas-tool-tip"><Brush size={14} /> Drag on the artboard to paint</div>}
        {props.activeTool === 'zoom' && <div className="canvas-tool-tip"><ZoomIn size={14} /> Click to zoom in · Alt-click to zoom out</div>}
      </div>
      </div>
    </div>
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
    </>
  )
}

function layerFill(layer: DesignLayer) {
  return layer.fillType && layer.fillType !== 'solid' && layer.gradient ? `url(#gradient-${layer.id})` : layer.fill
}

function LayerElement({ layer, onPointerDown }: { layer: DesignLayer; onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void }) {
  const cx = layer.x + layer.width / 2
  const cy = layer.y + layer.height / 2
  const transform = `rotate(${layer.rotation} ${cx} ${cy})`
  const common = { opacity: layer.opacity, 'data-layer': layer.id }
  const fill = layerFill(layer)
  let content: ReactNode
  if (layer.type === 'rectangle') {
    content = <rect {...common} x={layer.x} y={layer.y} width={layer.width} height={layer.height} rx={layer.radius || 0} fill={fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
  } else if (layer.type === 'ellipse') {
    content = <ellipse {...common} cx={cx} cy={cy} rx={layer.width / 2} ry={layer.height / 2} fill={fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
  } else if (layer.type === 'polygon') {
    content = <path {...common} d={polygonLayerPath(layer)} fill={fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} strokeLinejoin="round" />
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
    const lines = (layer.text || '').split('\n')
    const fontSize = layer.fontSize || 32
    const x = layer.textAlign === 'center' ? layer.x + layer.width / 2 : layer.textAlign === 'right' ? layer.x + layer.width : layer.x
    const anchor = layer.textAlign === 'center' ? 'middle' : layer.textAlign === 'right' ? 'end' : 'start'
    content = (
      <text {...common} x={x} y={layer.y + fontSize * 0.84} fill={fill} fontFamily={layer.fontFamily || 'Inter'} fontSize={fontSize} fontWeight={layer.fontWeight || 400} letterSpacing={layer.letterSpacing || 0} textAnchor={anchor}>
        {lines.map((line, index) => <tspan key={index} x={x} dy={index === 0 ? 0 : fontSize * (layer.lineHeight || 1.2)}>{line}</tspan>)}
      </text>
    )
  }
  return <g transform={transform} onPointerDown={onPointerDown} data-layer={layer.id} style={{ cursor: layer.locked ? 'not-allowed' : undefined }}>{content}</g>
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
      before: { x: point.x + (previous.x - point.x) / previousDistance * amount, y: point.y + (previous.y - point.y) / previousDistance * amount },
      after: { x: point.x + (next.x - point.x) / nextDistance * amount, y: point.y + (next.y - point.y) / nextDistance * amount },
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

function SelectionOverlay({ layer, mode, onResize, onRotate, onCorner, onCrop }: {
  layer: DesignLayer
  mode: Tool
  onResize: (event: ReactPointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se') => void
  onRotate: (event: ReactPointerEvent) => void
  onCorner: (event: ReactPointerEvent) => void
  onCrop: (event: ReactPointerEvent) => void
}) {
  const height = Math.max(layer.height, 2)
  const cx = layer.x + layer.width / 2
  const cy = layer.y + height / 2
  const transform = `rotate(${layer.rotation} ${cx} ${cy})`
  const handles: { id: 'nw' | 'ne' | 'sw' | 'se'; x: number; y: number; cursor: string }[] = [
    { id: 'nw', x: layer.x, y: layer.y, cursor: 'nwse-resize' },
    { id: 'ne', x: layer.x + layer.width, y: layer.y, cursor: 'nesw-resize' },
    { id: 'sw', x: layer.x, y: layer.y + height, cursor: 'nesw-resize' },
    { id: 'se', x: layer.x + layer.width, y: layer.y + height, cursor: 'nwse-resize' },
  ]
  const standard = mode === 'select'
  const cornerMode = mode === 'corner' && (layer.type === 'rectangle' || (layer.type === 'polygon' && (layer.shapeKind === 'regular' || layer.shapeKind === 'diamond')))
  const cropMode = mode === 'crop' && layer.type === 'image'
  return (
    <g transform={transform} className={`selection-overlay ${cropMode ? 'crop-selection' : ''}`} aria-hidden="true">
      <rect x={layer.x} y={layer.y} width={layer.width} height={height} fill={cropMode ? 'rgba(91,75,240,.04)' : 'none'} stroke={ACCENT} strokeWidth={cropMode ? '3' : '2'} strokeDasharray={cropMode ? '8 5' : undefined} vectorEffect="non-scaling-stroke" pointerEvents={cropMode ? 'all' : 'none'} onPointerDown={cropMode ? onCrop : undefined} />
      {standard && <>
        <line x1={cx} y1={layer.y} x2={cx} y2={layer.y - 34} stroke={ACCENT} strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        <circle cx={cx} cy={layer.y - 42} r="9" fill="white" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" onPointerDown={onRotate} style={{ cursor: 'grab', pointerEvents: 'all' }} />
        {handles.map((handle) => (
          <g key={handle.id} onPointerDown={(event) => onResize(event, handle.id)} style={{ cursor: handle.cursor, pointerEvents: 'all' }}>
            <circle cx={handle.x} cy={handle.y} r="22" fill="transparent" />
            <rect x={handle.x - 7} y={handle.y - 7} width="14" height="14" rx="2" fill="white" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
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

function ContextBar({ selected, activeTool, onOpenProperties, onOpenMask, onDuplicate, onDelete, onDoneTool, onUpdate }: {
  selected: DesignLayer
  activeTool: Tool
  onOpenProperties: () => void
  onOpenMask: () => void
  onDuplicate: () => void
  onDelete: () => void
  onDoneTool: () => void
  onUpdate: (patch: Partial<DesignLayer>) => void
}) {
  const focusedMode = activeTool === 'crop' || activeTool === 'corner'
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
        {!props.insideSheet && <div className="panel-header properties-title"><div><h2>Design</h2></div><IconButton label="Design options"><MoreHorizontal /></IconButton></div>}
        <PropertySection title="Artboard">
          <div className="dimension-pair">
            <NumberInput label="W" value={props.documentMeta.width} unit="px" onChange={(value) => props.onUpdateDocument({ width: value })} />
            <NumberInput label="H" value={props.documentMeta.height} unit="px" onChange={(value) => props.onUpdateDocument({ height: value })} />
          </div>
          <ColorInput label="Background" value={props.documentMeta.background} onChange={(value) => props.onUpdateDocument({ background: value })} />
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
          <IconButton label="More layer options"><MoreHorizontal /></IconButton>
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
          <div className="flip-actions"><button aria-label="Flip horizontally">↔</button><button aria-label="Flip vertically">↕</button></div>
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

      {layer.type === 'polygon' && (
        <PropertySection title="Polygon">
          <div className="shape-kind-grid" aria-label="Custom shape">
            <button className={(layer.shapeKind || 'regular') === 'regular' ? 'active' : ''} onClick={() => props.onUpdate({ shapeKind: 'regular', sides: layer.sides || 6 })}><Hexagon /><span>Polygon</span></button>
            <button className={layer.shapeKind === 'diamond' ? 'active' : ''} onClick={() => props.onUpdate({ shapeKind: 'diamond', sides: 4 })}><Diamond /><span>Diamond</span></button>
            <button className={layer.shapeKind === 'arrow' ? 'active' : ''} onClick={() => props.onUpdate({ shapeKind: 'arrow' })}><Move /><span>Arrow</span></button>
            <button className={layer.shapeKind === 'heart' ? 'active' : ''} onClick={() => props.onUpdate({ shapeKind: 'heart' })}><Heart /><span>Heart</span></button>
          </div>
          {layer.shapeKind === 'regular' && <SliderField label="Sides" value={layer.sides || 6} min={3} max={12} unit="" onChange={(sides) => props.onUpdate({ sides: round(sides) })} />}
          {(layer.shapeKind === 'regular' || layer.shapeKind === 'diamond') && <><SliderField label="Corner radius" value={round(layer.radius || 0)} min={0} max={round(Math.min(layer.width, layer.height) / 3)} unit="px" onChange={(radius) => props.onUpdate({ radius })} /><button className={`button secondary full-button ${props.activeTool === 'corner' ? 'active' : ''}`} onClick={() => props.onActivateTool('corner')}><Spline size={15} /> Edit corners on canvas</button></>}
        </PropertySection>
      )}

      {layer.type !== 'image' && layer.type !== 'line' && layer.type !== 'brush' && (
        <PropertySection title="Fill">
          <FillEditor layer={layer} onUpdate={props.onUpdate} />
        </PropertySection>
      )}

      {layer.type === 'path' && <PropertySection title="Path"><ToggleRow label="Close path" checked={Boolean(layer.closed)} onChange={(closed) => props.onUpdate({ closed, fill: closed && layer.fill === 'transparent' ? '#5B4BF0' : layer.fill })} /></PropertySection>}

      {(['rectangle', 'ellipse', 'polygon', 'star', 'line', 'path', 'brush'] as LayerType[]).includes(layer.type) && (
        <PropertySection title={layer.type === 'brush' ? 'Brush' : 'Stroke'} optional={layer.type !== 'brush'}>
          <ColorInput label="Colour" value={layer.stroke === 'transparent' ? '#18181B' : layer.stroke} onChange={(stroke) => props.onUpdate({ stroke, strokeWidth: layer.strokeWidth || 1 })} />
          {layer.type === 'brush'
            ? <><SliderField label="Brush size" value={layer.strokeWidth} min={1} max={120} unit="px" onChange={(strokeWidth) => props.onUpdate({ strokeWidth })} /><SliderField label="Smoothing" value={round((layer.smoothing || .5) * 100)} min={0} max={100} unit="%" onChange={(value) => props.onUpdate({ smoothing: value / 100 })} /></>
            : <NumberInput label="Width" value={layer.strokeWidth} unit="px" onChange={(strokeWidth) => props.onUpdate({ strokeWidth })} />}
          {layer.type === 'rectangle' && <><NumberInput label="Corners" value={layer.radius || 0} unit="px" onChange={(radius) => props.onUpdate({ radius })} /><button className={`button secondary full-button ${props.activeTool === 'corner' ? 'active' : ''}`} onClick={() => props.onActivateTool('corner')}><Spline size={15} /> Edit corners on canvas</button></>}
        </PropertySection>
      )}

      <PropertySection title="Appearance">
        <SliderField label="Opacity" value={round(layer.opacity * 100)} min={0} max={100} unit="%" onChange={(value) => props.onUpdate({ opacity: value / 100 })} />
        <SelectField label="Blend" value="Normal" options={['Normal', 'Multiply', 'Screen', 'Overlay']} onChange={() => undefined} />
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

function FillEditor({ layer, onUpdate }: { layer: DesignLayer; onUpdate: (patch: Partial<DesignLayer>) => void }) {
  const fillType = layer.fillType || 'solid'
  const gradient = layer.gradient || { ...DEFAULT_GRADIENT, stops: DEFAULT_GRADIENT.stops.map((stop) => ({ ...stop })) }
  const setFillType = (type: 'solid' | 'linear' | 'radial') => {
    if (type === 'solid') onUpdate({ fillType: 'solid' })
    else onUpdate({ fillType: type, gradient: { ...gradient, type } })
  }
  const setStop = (index: number, color: string) => {
    onUpdate({ fillType, gradient: { ...gradient, stops: gradient.stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, color } : stop) } })
  }
  const pickFromScreen = async () => {
    const EyeDropperClass = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
    if (!EyeDropperClass) return
    try {
      const result = await new EyeDropperClass().open()
      if (fillType === 'solid') onUpdate({ fill: result.sRGBHex })
      else setStop(0, result.sRGBHex)
    } catch { /* the picker was cancelled */ }
  }
  return (
    <div className="fill-editor">
      <div className="segmented fill-type-control" aria-label="Fill type">
        {(['solid', 'linear', 'radial'] as const).map((type) => <button key={type} className={fillType === type ? 'selected' : ''} onClick={() => setFillType(type)}>{type === 'solid' ? 'Solid' : type === 'linear' ? 'Linear' : 'Radial'}</button>)}
      </div>
      {fillType === 'solid'
        ? <ColorInput label="Colour" value={layer.fill} onChange={(fill) => onUpdate({ fill, fillType: 'solid' })} />
        : <>
          <div className="gradient-preview" style={{ background: gradient.type === 'radial' ? `radial-gradient(circle, ${gradient.stops.map((stop) => `${stop.color} ${stop.offset * 100}%`).join(', ')})` : `linear-gradient(${gradient.angle}deg, ${gradient.stops.map((stop) => `${stop.color} ${stop.offset * 100}%`).join(', ')})` }} />
          <div className="gradient-stops">{gradient.stops.map((stop, index) => <ColorInput key={index} label={index === 0 ? 'Start' : 'End'} value={stop.color} onChange={(color) => setStop(index, color)} />)}</div>
          {gradient.type === 'linear' && <SliderField label="Angle" value={gradient.angle} min={0} max={360} unit="°" onChange={(angle) => onUpdate({ gradient: { ...gradient, angle } })} />}
        </>}
      <div className="palette-heading"><span>Document colours</span><button onClick={pickFromScreen} disabled={!('EyeDropper' in window)} title="Pick a colour from the screen"><Pipette size={14} /></button></div>
      <ColourPalette value={fillType === 'solid' ? layer.fill : gradient.stops[0].color} onChange={(color) => fillType === 'solid' ? onUpdate({ fill: color }) : setStop(0, color)} />
    </div>
  )
}

function ColourPalette({ value, onChange }: { value: string; onChange: (colour: string) => void }) {
  return <div className="colour-palette">{DOCUMENT_COLOURS.map((colour) => <button key={colour} className={normalizeColor(value).toLowerCase() === colour.toLowerCase() ? 'selected' : ''} style={{ background: colour }} onClick={() => onChange(colour)} aria-label={`Use ${colour}`}>{normalizeColor(value).toLowerCase() === colour.toLowerCase() && <Check size={11} />}</button>)}</div>
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const colour = normalizeColor(value)
  return (
    <div className="color-field">
      <label className="color-swatch" style={{ background: colour }} title="Choose colour">
        <input type="color" value={colour} onChange={(event) => onChange(event.target.value)} aria-label={`${label} colour`} />
      </label>
      <span className="color-label">{label}</span>
      <input className="hex-input" value={colour.toUpperCase()} onChange={(event) => {
        const next = event.target.value
        if (/^#[0-9A-Fa-f]{6}$/.test(next)) onChange(next)
      }} aria-label={`${label} hex value`} />
    </div>
  )
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
      <div><span>{label}</span><label><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /><small>{unit}</small></label></div>
      <input type="range" min={min} max={max} value={value} style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` } as CSSProperties} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}

function SettingRow({ icon, label, value, active, onClick }: { icon: ReactNode; label: string; value: string; active?: boolean; onClick?: () => void }) {
  return <button className={`setting-row ${active ? 'active' : ''}`} onClick={onClick}><span>{icon}{label}</span><span>{value}<ChevronRight size={14} /></span></button>
}

function MobileToolbar({ activeTool, selected, onSelect, onShapes, onText, onImage, onLayers, onMore }: {
  activeTool: Tool; selected: DesignLayer | null; onSelect: () => void; onShapes: () => void; onText: () => void; onImage: () => void; onLayers: () => void; onMore: () => void
}) {
  const items = [
    { label: 'Select', icon: <MousePointer2 />, onClick: onSelect, active: activeTool === 'select' },
    { label: 'Shapes', icon: <Shapes />, onClick: onShapes, active: ['rectangle', 'ellipse', 'polygon', 'star', 'line'].includes(activeTool) },
    { label: 'Text', icon: <Type />, onClick: onText, active: activeTool === 'text' },
    { label: 'Image', icon: <ImageIcon />, onClick: onImage, active: activeTool === 'image' },
    { label: 'Layers', icon: <Layers3 />, onClick: onLayers, active: Boolean(selected) },
    { label: 'More', icon: <Menu />, onClick: onMore, active: ['pen', 'brush', 'corner', 'zoom', 'crop'].includes(activeTool) },
  ]
  return (
    <nav className="mobile-toolbar" aria-label="Design tools">
      {items.map((item) => <button key={item.label} className={item.active ? 'active' : ''} onClick={item.onClick}>{item.icon}<span>{item.label}</span></button>)}
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

function MaskPanel({ layer, onUpdate, onMoveImage }: { layer: DesignLayer; onUpdate: (patch: Partial<DesignLayer>) => void; onMoveImage: () => void }) {
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
        <button className="button primary full-button" onClick={onMoveImage}><Move size={17} /> Move image inside mask</button>
        {mask !== 'none' && <button className="button secondary full-button" onClick={() => onUpdate({ mask: 'none' })}>Remove mask</button>}
      </div>
    </div>
  )
}

function ShapesGrid({ onAdd }: { onAdd: (type: LayerType, point?: { x: number; y: number }, preset?: Partial<DesignLayer>) => void }) {
  const shapes: { id: string; type: LayerType; label: string; icon: ReactNode; preset?: Partial<DesignLayer> }[] = [
    { id: 'rectangle', type: 'rectangle', label: 'Rectangle', icon: <Square /> },
    { id: 'ellipse', type: 'ellipse', label: 'Ellipse', icon: <Circle /> },
    { id: 'triangle', type: 'polygon', label: 'Triangle', icon: <Triangle />, preset: { name: 'Triangle', sides: 3, shapeKind: 'regular' } },
    { id: 'polygon', type: 'polygon', label: 'Polygon', icon: <Hexagon />, preset: { sides: 6, shapeKind: 'regular' } },
    { id: 'star', type: 'star', label: 'Star', icon: <Star /> },
    { id: 'diamond', type: 'polygon', label: 'Diamond', icon: <Diamond />, preset: { name: 'Diamond', sides: 4, shapeKind: 'diamond' } },
    { id: 'arrow', type: 'polygon', label: 'Arrow', icon: <Move />, preset: { name: 'Arrow', shapeKind: 'arrow' } },
    { id: 'heart', type: 'polygon', label: 'Heart', icon: <Heart />, preset: { name: 'Heart', shapeKind: 'heart', fill: '#FF5C47' } },
    { id: 'line', type: 'line', label: 'Line', icon: <Minus /> },
  ]
  return <div className="shapes-grid custom-shapes-grid">{shapes.map((shape) => <button key={shape.id} onClick={() => onAdd(shape.type, undefined, shape.preset)}>{shape.icon}<span>{shape.label}</span></button>)}</div>
}

function MoreMenu({ onAction }: { onAction: (action: string) => void }) {
  const actions = [
    { id: 'new', label: 'New design', icon: <Plus /> },
    { id: 'pen', label: 'Pen tool', icon: <PenTool /> },
    { id: 'brush', label: 'Brush tool', icon: <Brush /> },
    { id: 'corner', label: 'Corner tool', icon: <Spline /> },
    { id: 'zoom', label: 'Zoom tool', icon: <ZoomIn /> },
    { id: 'artboards', label: 'Manage artboards', icon: <Frame /> },
    { id: 'grid', label: 'Layout grid', icon: <Grid3X3 /> },
    { id: 'rulers', label: 'Rulers and guides', icon: <Ruler /> },
    { id: 'settings', label: 'Design settings', icon: <Settings2 /> },
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
          {format === 'SVG' && <ToggleRow label="Outline text" checked={false} onChange={() => undefined} />}
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
    return definition
  }).join('')
  const body = layers.filter((layer) => layer.visible).map((layer) => {
    const cx = layer.x + layer.width / 2
    const cy = layer.y + layer.height / 2
    const transform = `rotate(${layer.rotation} ${cx} ${cy})`
    const opacity = layer.opacity
    const fill = layer.fillType && layer.fillType !== 'solid' && layer.gradient ? `url(#gradient-${layer.id})` : layer.fill
    if (layer.type === 'rectangle') return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.radius || 0}" fill="${fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}" transform="${transform}"/>`
    if (layer.type === 'ellipse') return `<ellipse cx="${cx}" cy="${cy}" rx="${layer.width / 2}" ry="${layer.height / 2}" fill="${fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}" transform="${transform}"/>`
    if (layer.type === 'polygon') return `<path d="${polygonLayerPath(layer)}" fill="${fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" stroke-linejoin="round" opacity="${opacity}" transform="${transform}"/>`
    if (layer.type === 'image') {
      const scale = layer.imageScale || 1
      const width = layer.width * scale
      const height = layer.height * scale
      const x = layer.x - (width - layer.width) / 2 + (layer.imageOffsetX || 0)
      const y = layer.y - (height - layer.height) / 2 + (layer.imageOffsetY || 0)
      return `<image href="${escapeXml(layer.src || '')}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${layer.id})" opacity="${opacity}" transform="${transform}"/>`
    }
    if (layer.type === 'line') return `<line x1="${layer.x}" y1="${layer.y}" x2="${layer.x + layer.width}" y2="${layer.y + layer.height}" stroke="${layer.stroke}" stroke-width="${Math.max(layer.strokeWidth, 2)}" stroke-linecap="round" opacity="${opacity}" transform="${transform}"/>`
    if (layer.type === 'star') return `<polygon points="${starPoints(cx, cy, Math.min(layer.width, layer.height) / 2, Math.min(layer.width, layer.height) / 4.3)}" fill="${fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}" transform="${transform}"/>`
    if (layer.type === 'path' || layer.type === 'brush') {
      const points = layerPoints(layer)
      const data = layer.type === 'brush' ? smoothPath(points, layer.smoothing || .5) : pointPath(points, Boolean(layer.closed))
      return `<path d="${data}" fill="${layer.closed ? fill : 'none'}" stroke="${layer.stroke}" stroke-width="${Math.max(layer.strokeWidth, 1)}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" transform="${transform}"/>`
    }
    const fontSize = layer.fontSize || 32
    const x = layer.textAlign === 'center' ? layer.x + layer.width / 2 : layer.textAlign === 'right' ? layer.x + layer.width : layer.x
    const anchor = layer.textAlign === 'center' ? 'middle' : layer.textAlign === 'right' ? 'end' : 'start'
    return `<text x="${x}" y="${layer.y + fontSize * 0.84}" fill="${fill}" font-family="${escapeXml(layer.fontFamily || 'Inter')}" font-size="${fontSize}" font-weight="${layer.fontWeight || 400}" letter-spacing="${layer.letterSpacing || 0}" text-anchor="${anchor}" opacity="${opacity}" transform="${transform}">${(layer.text || '').split('\n').map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : fontSize * (layer.lineHeight || 1.2)}">${escapeXml(line)}</tspan>`).join('')}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${meta.width}" height="${meta.height}" viewBox="0 0 ${meta.width} ${meta.height}"><defs>${defs}</defs>${includeBackground ? `<rect width="100%" height="100%" fill="${meta.background}"/>` : ''}${body}</svg>`
}

function HomeScreen({ theme, onToggleTheme, onNew, onImport, onOpenSample, onOpenCurrent, currentName, hasCurrent }: {
  theme: Theme; onToggleTheme: () => void; onNew: () => void; onImport: (file: File) => void; onOpenSample: () => void; onOpenCurrent: () => void; currentName: string; hasCurrent: boolean
}) {
  const importInputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="home-screen">
      <HomeHeader theme={theme} onToggleTheme={onToggleTheme} onNew={onNew} />
      <main className="home-main">
        <section className="home-intro">
          <div><span className="eyebrow">Your workspace</span><h1>Designs</h1><p>Everything stays on this device, ready whenever you are.</p></div>
          <div className="home-actions"><button className="button secondary" onClick={() => importInputRef.current?.click()}><Upload size={17} /> Import project</button><button className="button primary" onClick={onNew}><Plus size={18} /> New design</button></div>
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
        <section className="recent-section">
          <div className="section-title-row"><div><h2>Recent designs</h2><span>{hasCurrent ? 4 : 3} designs</span></div><div className="view-actions"><IconButton label="Grid view" active><LayoutGrid /></IconButton><IconButton label="Search designs"><Search /></IconButton></div></div>
          <div className="project-grid">
            {hasCurrent && <ProjectCard name={currentName} meta="Edited just now" variant="current" onClick={onOpenCurrent} />}
            <ProjectCard name="Objects & Space" meta="Edited just now" variant="poster" onClick={onOpenSample} />
            <ProjectCard name="Sonder identity" meta="Edited yesterday" variant="sonder" onClick={onOpenSample} />
            <ProjectCard name="Lagos / 26" meta="Edited 4 days ago" variant="lagos" onClick={onOpenSample} />
            <button className="new-project-card" onClick={onNew}><span><Plus /></span><strong>Create a design</strong><small>Start from a preset or custom size</small></button>
          </div>
        </section>
        <div className="backup-reminder"><span><FolderOpen size={19} /></span><div><strong>Keep a backup of your work</strong><p>Your designs are stored on this device only. Export a backup to keep them safe.</p></div><button className="button secondary">Learn how</button></div>
      </main>
      <input ref={importInputRef} className="visually-hidden" type="file" accept=".pocket,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = '' }} />
    </div>
  )
}

function HomeHeader({ theme, onToggleTheme, onNew }: { theme: Theme; onToggleTheme: () => void; onNew: () => void }) {
  return (
    <header className="home-header"><button className="home-brand"><LogoMark /><span>Pocketboard</span></button><nav><button className="active">Designs</button><button>Fonts</button><button>Swatches</button></nav><div><IconButton label="Search"><Search /></IconButton><IconButton label="Settings"><Settings2 /></IconButton><IconButton label={theme === 'light' ? 'Use dark theme' : 'Use light theme'} onClick={onToggleTheme}>{theme === 'light' ? <Moon /> : <Sun />}</IconButton><button className="button primary compact-new" onClick={onNew}><Plus size={17} /> New</button></div></header>
  )
}

function ProjectCard({ name, meta, variant, onClick }: { name: string; meta: string; variant: 'poster' | 'sonder' | 'lagos' | 'current'; onClick: () => void }) {
  return (
    <article className="project-card"><button className="project-thumbnail" onClick={onClick} aria-label={`Open ${name}`}><div className={`thumbnail-art ${variant}`}>{variant === 'poster' ? <PosterMini /> : variant === 'sonder' ? <><span className="sonder-s">S</span><span className="sonder-label">SONDER®<br />STUDIO</span></> : variant === 'lagos' ? <><span className="lagos-small">CULTURE / DESIGN / PEOPLE</span><strong>LAGOS<br />/26</strong><i /></> : <><span className="current-grid" /><strong>{name.slice(0, 1).toUpperCase()}</strong></>}</div><span className="card-menu"><MoreHorizontal /></span></button><div className="project-card-info"><div><strong>{name}</strong><span>{meta}</span></div><button aria-label={`More options for ${name}`}><MoreHorizontal /></button></div></article>
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
