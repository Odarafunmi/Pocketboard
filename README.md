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
- Dedicated zoom tool, controls, two-finger workspace pinch, and pointer-centred mouse-wheel zoom from 5% to 6400%
- Middle-button drag pans the canvas. Mouse actions can be changed or reset under View → Mouse settings (or More → Mouse settings on mobile).
- Custom colour wheel with keyboard-adjustable hue, saturation and brightness, alongside the native picker and canvas eyedropper.
- Contextual properties for typography, fills, strokes, position, opacity, and artboard settings
- Undo/redo, keyboard shortcuts, local auto-save plus an explicit Save action, light/dark themes, and reduced-motion support
- Home and New design screens with project cards, presets, print units, and custom dimensions
- In-browser PNG, JPG, SVG, PDF, and project-file export
- PWA manifest and offline runtime cache

All project state remains in the browser's local storage; there is no backend or account system.

Imported images are stored in the browser and may be limited by device storage. Export a project backup if the editor reports that it cannot save.

To sample a colour, use the picker beside a fill, gradient stop, stroke or background field, then tap the artboard. Press Escape or choose Cancel to exit. When focused, use arrow keys and Enter to sample with a keyboard. The picker samples the rendered artboard, not editor controls or the surrounding screen.

Select an image and choose Extract palette from image (or Palette on mobile) to generate up to six colours from the original image. The palette stays on this device and is available in fill, gradient-stop, stroke, and background controls. Save writes the current design to this browser; export a project file for a portable backup.

For a selection mask, select an unlocked image. On a phone, choose Polygonal or Magic wand directly in the bottom image toolbar; on a tablet, use the contextual toolbar; on desktop, use the left tool strip or Selection masks in image properties. The tools are also listed under More on a phone. Choose whether to keep or hide the selected region and set feathering before applying it. The polygon tool places vertices with taps and uses Apply selection; the wand selects a contiguous region of similar colour using the chosen tolerance. The wand samples the displayed image crop, at up to 1024 pixels on its longest side; it is not an AI object detector. Selection masks remain editable through undo, clearing and the hide/restore mask brush. Large image masks can consume local storage.

Blur is available in the selected layer's properties for shapes, text and images. Gaussian uses the browser's SVG filter. Motion, radial zoom and curved-path blurs use locally rendered exposure samples; the path is controlled by angle and curvature rather than a drawn path. The layer list toggles each blur without removing its settings. Exports and colour sampling use the same rendering; SVG viewers must support the `plus-lighter` blend mode for sampled blurs, so use PNG if a viewer does not support it. No new image-processing dependency is required.

Text properties include undoable uppercase and lowercase conversion. Use **Find and install fonts** to import a TTF, OTF, WOFF or WOFF2 file, browse device fonts where the browser supports and permits the Local Font Access API, or search Fontsource fonts online. Device access needs permission and can be refreshed after installing a font on the device; on unsupported browsers, import a font file instead. Online searches and downloads contact the public npm registry. The downloaded regular face and available Unicode subsets are installed in Pocketboard, not the operating system; other weights may be synthesised by the browser. Check the font's licence and embedding permissions before use. Installed fonts are stored on this device, and fonts used by a text layer are embedded in project and SVG exports (as well as local raster exports). Large fonts may exhaust browser project storage; export a project backup and use smaller fonts if the editor reports a save failure.

Text layers have bold, italic and underline controls in Typography, applied to the whole layer. Shape and text fills can be set to None in Fill, while shape and path strokes can be set to None in Stroke. The previous colours are retained when these options are turned off, and the artwork remains selectable. These choices are saved with the project and included in local exports.

New circles, regular polygons and radial stars start with equal axes. Selecting one of these unlocked shapes restores equal axes around its centre, using the longer side; undo restores the previous dimensions. Other shapes retain their own width-to-height proportions, and selecting text, images, lines or drawn paths does not resize them. Corner handles preserve proportions; side handles still resize independently.
