# Pocketboard

A touch-first, local-first vector design workspace built from the supplied product requirements and interface style guide.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. A production build can be created with:

```bash
npm run build
npm run preview
```

## Included in this prototype

- Workspace-first launch with recent designs, quick-start presets, and project import
- Responsive editor layouts for desktop, tablet, portrait phone, and short-screen landscape use
- Interactive SVG artboard with object selection, moving, rotation, proportional corner resizing, independent side resizing, and faded out-of-artboard artwork
- Shape and text tools: tap text to select and transform it, double-tap or double-click to edit its content, then use Done or tap outside to return to transform controls; drag side handles to wrap text or corner handles to scale it
- File, Edit, Select, and View menus; import images and SVG elements from a device or drop them onto the canvas (SVGs are placed as images)
- Layers, visibility, lock, drag or keyboard reordering, duplicate, and delete
- Pen paths plus a non-destructive hide/restore mask brush with object selection, adjustable size, clearing, and undo
- Selection-aware mobile actions for shape corners, fills, alignment, image crops, masks, text styling, duplication, and deletion
- Linear and radial gradients, document swatches, blend modes, flipping, an artboard colour picker, and reusable colours extracted from a selected image
- A grouped shape library with decorative, UI, infographic, geometric, stamp, and indicator presets, including round and rectangular stamps with a square option; editable polygons, starbursts, sunbursts, and corner controls
- Pie and donut chart presets are static shapes, not data-driven charts
- Non-destructive image repositioning, scaling, and rectangle, rounded, ellipse, or star masks, with a dedicated compact-screen workflow
- Artboard alignment controls, snapping smart guides, draggable ruler guides, and adjustable layout grids
- Multiple artboards with switching, adding, deleting, local persistence, project-file backup, and a touch-first manager available by tap or long-press
- Dedicated zoom tool, controls, and two-finger workspace pinch zoom from 5% to 6400%
- Contextual properties for typography, fills, strokes, position, opacity, and artboard settings
- Undo/redo, keyboard shortcuts, local auto-save plus an explicit Save action, light/dark themes, and reduced-motion support
- Home and New design screens with project cards, presets, print units, and custom dimensions
- In-browser PNG, JPG, SVG, PDF, and project-file export
- PWA manifest and offline runtime cache

All project state remains in the browser's local storage; there is no backend or account system.

Imported images are stored in the browser and may be limited by device storage. Export a project backup if the editor reports that it cannot save.

To sample a colour, use the picker beside a fill, gradient stop, stroke or background field, then tap the artboard. Press Escape or choose Cancel to exit. When focused, use arrow keys and Enter to sample with a keyboard. The picker samples the rendered artboard, not editor controls or the surrounding screen.

Select an image and choose Extract palette from image (or Palette on mobile) to generate up to six colours from the original image. The palette stays on this device and is available in fill, gradient-stop, stroke, and background controls. Save writes the current design to this browser; export a project file for a portable backup.
