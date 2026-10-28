import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  Grid3X3,
  GripVertical,
  Group,
  Hand,
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
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { emptyDocumentLayers, presets, sampleDocument, sampleLayers } from './data'
import type {
  DesignDocument,
  DesignLayer,
  ExportFormat,
  LayerType,
  MobileSheet,
  Theme,
  Tool,
  View,
} from './types'

const ACCENT = '#5B4BF0'

const cloneLayers = (layers: DesignLayer[]) => layers.map((layer) => ({ ...layer }))
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
  const isPhone = useMedia('(max-width: 599px)')
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
      setSavingState('Saved')
    }, 500)
    return () => window.clearTimeout(timer)
  }, [layers, documentMeta, projectName])

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

  const addLayer = useCallback((type: LayerType, point?: { x: number; y: number }) => {
    const count = layersRef.current.length
    const centerX = point?.x ?? documentMeta.width / 2
    const centerY = point?.y ?? documentMeta.height / 2
    const base: DesignLayer = {
      id: makeId(),
      name: type === 'rectangle' ? 'Rectangle' : type === 'ellipse' ? 'Ellipse' : type === 'text' ? 'Text' : type === 'star' ? 'Star' : type === 'line' ? 'Line' : 'Image',
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
      stroke: type === 'line' ? '#18181B' : 'transparent',
      strokeWidth: type === 'line' ? 4 : 0,
      radius: type === 'rectangle' ? 16 : 0,
      text: type === 'text' ? 'Type something' : undefined,
      fontSize: type === 'text' ? 56 : undefined,
      fontWeight: type === 'text' ? 600 : undefined,
      fontFamily: type === 'text' ? 'Inter' : undefined,
      letterSpacing: type === 'text' ? -1 : undefined,
      lineHeight: type === 'text' ? 1.1 : undefined,
    }
    commitLayers([...layersRef.current, base])
    setSelectedId(base.id)
    setActiveTool('select')
    if (isPhone) setMobileSheet(null)
  }, [commitLayers, documentMeta.height, documentMeta.width, isPhone])

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
        fill: '#E8E8EA', stroke: 'transparent', strokeWidth: 0, radius: 0,
        src: String(reader.result),
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
        setSelectedId(null)
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
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commitLayers, deleteSelected, duplicateSelected, redo, selectedId, undo, updateLayer])

  const createDesign = (meta: DesignDocument, name: string) => {
    const toPx = (value: number) => {
      if (meta.unit === 'px') return value
      if (meta.unit === 'mm') return value * meta.dpi / 25.4
      if (meta.unit === 'cm') return value * meta.dpi / 2.54
      return value * meta.dpi
    }
    const nextMeta = { ...meta, width: round(toPx(meta.width)), height: round(toPx(meta.height)), unit: 'px' as const }
    setDocumentMeta(nextMeta)
    setProjectName(name || 'Untitled design')
    commitLayers(emptyDocumentLayers())
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
    setDocumentMeta(sampleDocument)
    setProjectName('Objects & Space')
    commitLayers(cloneLayers(sampleLayers))
    setSelectedId('objects-title')
    navigate('editor')
  }

  const importProject = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result)) as { name?: string; document?: DesignDocument; layers?: DesignLayer[] }
        if (!payload.document || !Array.isArray(payload.layers)) throw new Error('Invalid project')
        setDocumentMeta(payload.document)
        setProjectName(payload.name || file.name.replace(/\.[^/.]+$/, '') || 'Imported design')
        commitLayers(cloneLayers(payload.layers))
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
          onGrid={() => showToast('Layout grid shown')}
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

        <main className={`workspace tool-${activeTool}`} aria-label="Design canvas">
          <div className="workspace-top-hint">
            <span className="artboard-name">Instagram portrait</span>
            <span className="artboard-size">{documentMeta.width} × {documentMeta.height} px</span>
          </div>
          <Canvas
            artboardRef={artboardRef}
            documentMeta={documentMeta}
            layers={layers}
            selected={selected}
            activeTool={activeTool}
            zoom={zoom}
            onSelect={setSelectedId}
            onAddLayer={addLayer}
            onUpdateLive={(id, patch) => updateLayer(id, patch, false)}
            onCommitSnapshot={(snapshot) => {
              setPast((items) => [...items.slice(-99), cloneLayers(snapshot)])
              setFuture([])
            }}
          />

          {selected && (
            <ContextBar
              selected={selected}
              onOpenProperties={() => setMobileSheet('properties')}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onUpdate={(patch) => updateLayer(selected.id, patch)}
            />
          )}

          <ZoomControl
            zoom={zoom}
            onZoomOut={() => setZoom((value) => clamp(value - 10, 5, 200))}
            onZoomIn={() => setZoom((value) => clamp(value + 10, 5, 200))}
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
            onReplaceImage={() => imageInputRef.current?.click()}
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
        <MobileSheetView title={mobileSheet === 'layers' ? 'Layers' : mobileSheet === 'properties' ? 'Properties' : mobileSheet === 'shapes' ? 'Add shape' : 'More'} onClose={() => setMobileSheet(null)}>
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
              onReplaceImage={() => imageInputRef.current?.click()}
              insideSheet
            />
          )}
          {mobileSheet === 'shapes' && <ShapesGrid onAdd={addLayer} />}
          {mobileSheet === 'more' && (
            <MoreMenu
              onAction={(action) => {
                if (action === 'new') navigate('new')
                else if (action === 'export') setExportOpen(true)
                else showToast(action === 'grid' ? 'Layout grid shown' : action === 'rulers' ? 'Rulers shown' : 'Action completed')
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

function ToolRail({ activeTool, onTool, onGrid }: { activeTool: Tool; onTool: (tool: Tool) => void; onGrid: () => void }) {
  const tools: { id: Tool; label: string; shortcut?: string; icon: ReactNode }[] = [
    { id: 'select', label: 'Select', shortcut: 'V', icon: <MousePointer2 /> },
    { id: 'hand', label: 'Hand tool', shortcut: 'H', icon: <Hand /> },
    { id: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: <Square /> },
    { id: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: <Circle /> },
    { id: 'star', label: 'Star', icon: <Star /> },
    { id: 'line', label: 'Line', shortcut: 'L', icon: <Minus /> },
    { id: 'text', label: 'Text', shortcut: 'T', icon: <Type /> },
    { id: 'image', label: 'Place image', icon: <ImageIcon /> },
  ]
  return (
    <nav className="tool-rail" aria-label="Design tools">
      <div className="tool-stack">
        {tools.map((tool, index) => (
          <div key={tool.id} className={index === 2 || index === 6 ? 'tool-divider-before' : ''}>
            <IconButton label={tool.label} shortcut={tool.shortcut} active={activeTool === tool.id} onClick={() => onTool(tool.id)}>{tool.icon}</IconButton>
          </div>
        ))}
      </div>
      <div className="tool-stack rail-bottom">
        <IconButton label="Layout grid" onClick={onGrid}><Grid3X3 /></IconButton>
        <IconButton label="More tools"><MoreHorizontal /></IconButton>
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
  if (layer.type === 'star') return <span className="layer-thumbnail icon"><Star size={15} style={{ color: layer.fill }} /></span>
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
  onSelect: (id: string | null) => void
  onAddLayer: (type: LayerType, point?: { x: number; y: number }) => void
  onUpdateLive: (id: string, patch: Partial<DesignLayer>) => void
  onCommitSnapshot: (layers: DesignLayer[]) => void
}

type TransformState = {
  mode: 'move' | 'resize' | 'rotate'
  id: string
  startClientX: number
  startClientY: number
  original: DesignLayer
  snapshot: DesignLayer[]
  handle?: 'nw' | 'ne' | 'sw' | 'se'
  moved: boolean
}

function Canvas(props: CanvasProps) {
  const transformRef = useRef<TransformState | null>(null)
  const layersRef = useRef(props.layers)
  useEffect(() => { layersRef.current = props.layers }, [props.layers])

  const pointerToCanvas = (clientX: number, clientY: number) => {
    const svg = props.artboardRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: (clientX - rect.left) * props.documentMeta.width / rect.width,
      y: (clientY - rect.top) * props.documentMeta.height / rect.height,
    }
  }

  const startTransform = (event: ReactPointerEvent, layer: DesignLayer, mode: TransformState['mode'], handle?: TransformState['handle']) => {
    if (layer.locked || props.activeTool !== 'select') return
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
        props.onUpdateLive(state.id, {
          x: clamp(state.original.x + dx, -state.original.width + 10, props.documentMeta.width - 10),
          y: clamp(state.original.y + dy, -state.original.height + 10, props.documentMeta.height - 10),
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
      } else {
        const point = pointerToCanvas(moveEvent.clientX, moveEvent.clientY)
        const cx = state.original.x + state.original.width / 2
        const cy = state.original.y + state.original.height / 2
        const angle = Math.atan2(point.y - cy, point.x - cx) * 180 / Math.PI + 90
        props.onUpdateLive(state.id, { rotation: Math.round(angle * 10) / 10 })
      }
    }
    const onUp = () => {
      const state = transformRef.current
      if (state?.moved) props.onCommitSnapshot(state.snapshot)
      transformRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const onBackgroundPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const target = event.target as SVGElement
    if (target.dataset.layer) return
    if (['rectangle', 'ellipse', 'text', 'star', 'line'].includes(props.activeTool)) {
      const point = pointerToCanvas(event.clientX, event.clientY)
      props.onAddLayer(props.activeTool as LayerType, point)
    } else if (props.activeTool === 'select') {
      props.onSelect(null)
    }
  }

  const aspect = props.documentMeta.width / props.documentMeta.height
  const zoomRatio = props.zoom / 68
  return (
    <div className="canvas-scroll">
      <div className="artboard-scale" style={{ '--zoom-ratio': zoomRatio, '--artboard-aspect': aspect } as CSSProperties}>
        <svg
          ref={props.artboardRef}
          className="artboard"
          viewBox={`0 0 ${props.documentMeta.width} ${props.documentMeta.height}`}
          role="img"
          aria-label={`Artboard, ${props.documentMeta.width} by ${props.documentMeta.height} pixels`}
          onPointerDown={onBackgroundPointerDown}
        >
          <rect width={props.documentMeta.width} height={props.documentMeta.height} fill={props.documentMeta.background} data-artboard-background="true" />
          <defs>
            {props.layers.filter((layer) => layer.type === 'image').map((layer) => (
              <clipPath id={`clip-${layer.id}`} key={layer.id}>
                <rect x={layer.x} y={layer.y} width={layer.width} height={layer.height} rx={layer.radius || 0} />
              </clipPath>
            ))}
          </defs>
          {props.layers.filter((layer) => layer.visible).map((layer) => (
            <LayerElement
              key={layer.id}
              layer={layer}
              onPointerDown={(event) => startTransform(event, layer, 'move')}
            />
          ))}
          {props.selected?.visible && (
            <SelectionOverlay
              layer={props.selected}
              onResize={(event, handle) => startTransform(event, props.selected!, 'resize', handle)}
              onRotate={(event) => startTransform(event, props.selected!, 'rotate')}
            />
          )}
        </svg>
      </div>
    </div>
  )
}

function LayerElement({ layer, onPointerDown }: { layer: DesignLayer; onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void }) {
  const cx = layer.x + layer.width / 2
  const cy = layer.y + layer.height / 2
  const transform = `rotate(${layer.rotation} ${cx} ${cy})`
  const common = {
    opacity: layer.opacity,
    'data-layer': layer.id,
  }
  let content: ReactNode
  if (layer.type === 'rectangle') {
    content = <rect {...common} x={layer.x} y={layer.y} width={layer.width} height={layer.height} rx={layer.radius || 0} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
  } else if (layer.type === 'ellipse') {
    content = <ellipse {...common} cx={cx} cy={cy} rx={layer.width / 2} ry={layer.height / 2} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
  } else if (layer.type === 'image') {
    content = <image {...common} href={layer.src} x={layer.x} y={layer.y} width={layer.width} height={layer.height} preserveAspectRatio="xMidYMid slice" clipPath={`url(#clip-${layer.id})`} />
  } else if (layer.type === 'line') {
    content = <line {...common} x1={layer.x} y1={layer.y} x2={layer.x + layer.width} y2={layer.y + layer.height} stroke={layer.stroke} strokeWidth={Math.max(layer.strokeWidth, 2)} strokeLinecap="round" />
  } else if (layer.type === 'star') {
    content = <polygon {...common} points={starPoints(cx, cy, Math.min(layer.width, layer.height) / 2, Math.min(layer.width, layer.height) / 4.3)} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />
  } else {
    const lines = (layer.text || '').split('\n')
    const fontSize = layer.fontSize || 32
    const x = layer.textAlign === 'center' ? layer.x + layer.width / 2 : layer.textAlign === 'right' ? layer.x + layer.width : layer.x
    const anchor = layer.textAlign === 'center' ? 'middle' : layer.textAlign === 'right' ? 'end' : 'start'
    content = (
      <text
        {...common}
        x={x}
        y={layer.y + fontSize * 0.84}
        fill={layer.fill}
        fontFamily={layer.fontFamily || 'Inter'}
        fontSize={fontSize}
        fontWeight={layer.fontWeight || 400}
        letterSpacing={layer.letterSpacing || 0}
        textAnchor={anchor}
      >
        {lines.map((line, index) => <tspan key={index} x={x} dy={index === 0 ? 0 : fontSize * (layer.lineHeight || 1.2)}>{line}</tspan>)}
      </text>
    )
  }
  return <g transform={transform} onPointerDown={onPointerDown} data-layer={layer.id} style={{ cursor: layer.locked ? 'not-allowed' : 'move' }}>{content}</g>
}

function starPoints(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + index * Math.PI / 5
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`
  }).join(' ')
}

function SelectionOverlay({ layer, onResize, onRotate }: {
  layer: DesignLayer
  onResize: (event: ReactPointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se') => void
  onRotate: (event: ReactPointerEvent) => void
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
  return (
    <g transform={transform} className="selection-overlay" aria-hidden="true">
      <rect x={layer.x} y={layer.y} width={layer.width} height={height} fill="none" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      <line x1={cx} y1={layer.y} x2={cx} y2={layer.y - 34} stroke={ACCENT} strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      <circle cx={cx} cy={layer.y - 42} r="9" fill="white" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" onPointerDown={onRotate} style={{ cursor: 'grab', pointerEvents: 'all' }} />
      {handles.map((handle) => (
        <g key={handle.id} onPointerDown={(event) => onResize(event, handle.id)} style={{ cursor: handle.cursor, pointerEvents: 'all' }}>
          <circle cx={handle.x} cy={handle.y} r="22" fill="transparent" />
          <rect x={handle.x - 7} y={handle.y - 7} width="14" height="14" rx="2" fill="white" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      {!layer.locked && <SizePill x={layer.x + layer.width / 2} y={layer.y + height + 28} text={`${round(layer.width)} × ${round(layer.height)}`} />}
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

function ContextBar({ selected, onOpenProperties, onDuplicate, onDelete, onUpdate }: {
  selected: DesignLayer
  onOpenProperties: () => void
  onDuplicate: () => void
  onDelete: () => void
  onUpdate: (patch: Partial<DesignLayer>) => void
}) {
  return (
    <div className="context-bar" aria-label="Selection actions">
      <button className="context-item" onClick={onOpenProperties}><SlidersHorizontal size={17} /><span>Edit</span></button>
      {selected.type !== 'image' && (
        <label className="context-item color-context">
          <span className="mini-swatch" style={{ background: selected.fill }} />
          <span>Fill</span>
          <input type="color" value={normalizeColor(selected.fill)} onChange={(event) => onUpdate({ fill: event.target.value })} aria-label="Fill colour" />
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
  onReplaceImage: () => void
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
          <SettingRow icon={<Grid3X3 size={17} />} label="Layout grid" value="Off" />
          <SettingRow icon={<Ruler size={17} />} label="Rulers" value="Off" />
        </PropertySection>
        <div className="panel-note"><Lock size={16} /><p>Designs are saved to this device automatically.</p></div>
      </div>
    )
  }

  const layer = props.selected
  return (
    <div className={`panel-inner properties-inner ${props.insideSheet ? 'inside-sheet' : ''}`}>
      {!props.insideSheet && (
        <div className="panel-header properties-title">
          <div className="property-heading-icon"><LayerThumbnail layer={layer} /><div><h2>{layer.type === 'text' ? 'Text' : layer.type === 'image' ? 'Image' : 'Shape'}</h2><span>{layer.name}</span></div></div>
          <IconButton label="More layer options"><MoreHorizontal /></IconButton>
        </div>
      )}
      <div className="quick-arrange">
        <IconButton label="Move layer up" onClick={props.onMoveUp}><ArrowUp /></IconButton>
        <IconButton label="Move layer down" onClick={props.onMoveDown}><ArrowDown /></IconButton>
        <IconButton label="Duplicate" onClick={props.onDuplicate}><Copy /></IconButton>
        <IconButton label={layer.locked ? 'Unlock' : 'Lock'} onClick={() => props.onUpdate({ locked: !layer.locked })}>{layer.locked ? <Lock /> : <Unlock />}</IconButton>
      </div>
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
          <div className="image-property-preview"><img src={layer.src} alt="Selected layer" /><div><span>Original image</span><small>High resolution</small></div></div>
          <div className="two-buttons"><button className="button secondary" onClick={props.onReplaceImage}>Replace</button><button className="button secondary"><Move size={15} /> Crop</button></div>
        </PropertySection>
      )}

      {layer.type !== 'image' && layer.type !== 'line' && (
        <PropertySection title="Fill">
          <ColorInput label="Solid" value={layer.fill} onChange={(fill) => props.onUpdate({ fill })} />
        </PropertySection>
      )}

      {(layer.type === 'rectangle' || layer.type === 'ellipse' || layer.type === 'star' || layer.type === 'line') && (
        <PropertySection title="Stroke" optional>
          <ColorInput label="Colour" value={layer.stroke === 'transparent' ? '#18181B' : layer.stroke} onChange={(stroke) => props.onUpdate({ stroke, strokeWidth: layer.strokeWidth || 1 })} />
          <NumberInput label="Width" value={layer.strokeWidth} unit="px" onChange={(strokeWidth) => props.onUpdate({ strokeWidth })} />
          {layer.type === 'rectangle' && <NumberInput label="Corners" value={layer.radius || 0} unit="px" onChange={(radius) => props.onUpdate({ radius })} />}
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

function SettingRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <button className="setting-row"><span>{icon}{label}</span><span>{value}<ChevronRight size={14} /></span></button>
}

function MobileToolbar({ activeTool, selected, onSelect, onShapes, onText, onImage, onLayers, onMore }: {
  activeTool: Tool; selected: DesignLayer | null; onSelect: () => void; onShapes: () => void; onText: () => void; onImage: () => void; onLayers: () => void; onMore: () => void
}) {
  const items = [
    { label: 'Select', icon: <MousePointer2 />, onClick: onSelect, active: activeTool === 'select' },
    { label: 'Shapes', icon: <Shapes />, onClick: onShapes, active: ['rectangle', 'ellipse', 'star', 'line'].includes(activeTool) },
    { label: 'Text', icon: <Type />, onClick: onText, active: activeTool === 'text' },
    { label: 'Image', icon: <ImageIcon />, onClick: onImage, active: activeTool === 'image' },
    { label: 'Layers', icon: <Layers3 />, onClick: onLayers, active: Boolean(selected) },
    { label: 'More', icon: <Menu />, onClick: onMore, active: false },
  ]
  return (
    <nav className="mobile-toolbar" aria-label="Design tools">
      {items.map((item) => <button key={item.label} className={item.active ? 'active' : ''} onClick={item.onClick}>{item.icon}<span>{item.label}</span></button>)}
    </nav>
  )
}

function MobileSheetView({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-layer" role="presentation">
      <button className="sheet-scrim" onClick={onClose} aria-label="Close sheet" />
      <section className="mobile-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <header><h2>{title}</h2><IconButton label="Close" onClick={onClose}><X /></IconButton></header>
        <div className="sheet-content">{children}</div>
      </section>
    </div>
  )
}

function ShapesGrid({ onAdd }: { onAdd: (type: LayerType) => void }) {
  const shapes: { type: LayerType; label: string; icon: ReactNode }[] = [
    { type: 'rectangle', label: 'Rectangle', icon: <Square /> },
    { type: 'ellipse', label: 'Ellipse', icon: <Circle /> },
    { type: 'star', label: 'Star', icon: <Star /> },
    { type: 'line', label: 'Line', icon: <Minus /> },
  ]
  return <div className="shapes-grid">{shapes.map((shape) => <button key={shape.type} onClick={() => onAdd(shape.type)}>{shape.icon}<span>{shape.label}</span></button>)}</div>
}

function MoreMenu({ onAction }: { onAction: (action: string) => void }) {
  const actions = [
    { id: 'new', label: 'New design', icon: <Plus /> },
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
        documentMeta: props.documentMeta, layers: props.layers,
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
}

async function exportDesign(options: ExportOptions) {
  const safeName = options.fileName || 'design'
  if (options.format === 'PROJECT') {
    const payload = JSON.stringify({ version: 1, name: safeName, document: options.documentMeta, layers: options.layers }, null, 2)
    downloadBlob(new Blob([payload], { type: 'application/json' }), `${safeName}.pocket`)
    return
  }
  const embeddedLayers = await Promise.all(options.layers.map(async (layer) => {
    if (layer.type !== 'image' || !layer.src || layer.src.startsWith('data:')) return layer
    try { return { ...layer, src: await imageToDataUrl(layer.src) } } catch { return layer }
  }))
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
  const defs = layers.filter((layer) => layer.type === 'image').map((layer) => `<clipPath id="clip-${layer.id}"><rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.radius || 0}"/></clipPath>`).join('')
  const body = layers.filter((layer) => layer.visible).map((layer) => {
    const cx = layer.x + layer.width / 2
    const cy = layer.y + layer.height / 2
    const transform = `rotate(${layer.rotation} ${cx} ${cy})`
    const opacity = layer.opacity
    if (layer.type === 'rectangle') return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.radius || 0}" fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}" transform="${transform}"/>`
    if (layer.type === 'ellipse') return `<ellipse cx="${cx}" cy="${cy}" rx="${layer.width / 2}" ry="${layer.height / 2}" fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}" transform="${transform}"/>`
    if (layer.type === 'image') return `<image href="${layer.src}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${layer.id})" opacity="${opacity}" transform="${transform}"/>`
    if (layer.type === 'line') return `<line x1="${layer.x}" y1="${layer.y}" x2="${layer.x + layer.width}" y2="${layer.y + layer.height}" stroke="${layer.stroke}" stroke-width="${Math.max(layer.strokeWidth, 2)}" stroke-linecap="round" opacity="${opacity}" transform="${transform}"/>`
    if (layer.type === 'star') return `<polygon points="${starPoints(cx, cy, Math.min(layer.width, layer.height) / 2, Math.min(layer.width, layer.height) / 4.3)}" fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${opacity}" transform="${transform}"/>`
    const fontSize = layer.fontSize || 32
    const x = layer.textAlign === 'center' ? layer.x + layer.width / 2 : layer.textAlign === 'right' ? layer.x + layer.width : layer.x
    const anchor = layer.textAlign === 'center' ? 'middle' : layer.textAlign === 'right' ? 'end' : 'start'
    return `<text x="${x}" y="${layer.y + fontSize * 0.84}" fill="${layer.fill}" font-family="${escapeXml(layer.fontFamily || 'Inter')}" font-size="${fontSize}" font-weight="${layer.fontWeight || 400}" letter-spacing="${layer.letterSpacing || 0}" text-anchor="${anchor}" opacity="${opacity}" transform="${transform}">${(layer.text || '').split('\n').map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : fontSize * (layer.lineHeight || 1.2)}">${escapeXml(line)}</tspan>`).join('')}</text>`
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
