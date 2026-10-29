import type { DesignLayer, FontAsset, StoredFont } from './types'

const MAX_FONT_BYTES = 8 * 1024 * 1024
const FONT_DB = 'pocketboard-fonts'
const loaded = new Map<string, Promise<void>>()

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the font file.'))
    reader.readAsDataURL(blob)
  })
}

export function newFontId() {
  return `PocketboardFont-${crypto.randomUUID().replace(/-/g, '')}`
}

export async function fontFromBlob(blob: Blob, label: string): Promise<StoredFont> {
  if (blob.size > MAX_FONT_BYTES) throw new Error('Font files must be 8 MB or smaller.')
  const font: StoredFont = { id: newFontId(), label: label.slice(0, 120), assets: [{ data: await dataUrl(blob) }] }
  await ensureFont(font)
  return font
}

export function ensureFont(font: StoredFont): Promise<void> {
  const key = font.id
  const previous = loaded.get(key)
  if (previous) return previous
  const task = (async () => {
    const faces: FontFace[] = []
    for (const asset of font.assets) {
      if (!/^data:[^,]*;base64,[a-zA-Z0-9+/=]+$/.test(asset.data)) throw new Error('Invalid font data.')
      const face = new FontFace(font.id, `url("${asset.data}")`, { weight: '400', ...(asset.unicodeRange ? { unicodeRange: asset.unicodeRange } : {}) })
      await face.load()
      faces.push(face)
    }
    for (const face of faces) document.fonts.add(face)
  })()
  loaded.set(key, task)
  task.catch(() => loaded.delete(key))
  return task
}

export async function ensureLayerFonts(layers: DesignLayer[]) {
  await Promise.all(layers.flatMap((layer) => layer.fontFamily && layer.fontAssets?.length ? [ensureFont({ id: layer.fontFamily, label: layer.fontLabel || layer.fontFamily, assets: layer.fontAssets })] : []))
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FONT_DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('fonts', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function listSavedFonts(): Promise<StoredFont[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fonts', 'readonly')
    const request = tx.objectStore('fonts').getAll()
    request.onsuccess = () => resolve(request.result as StoredFont[])
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
    tx.onabort = () => { db.close(); reject(tx.error) }
  })
}

export async function saveFont(font: StoredFont) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('fonts', 'readwrite')
    tx.objectStore('fonts').put(font)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export interface LocalFont { family: string; fullName: string; postscriptName: string; blob: () => Promise<Blob> }
export async function getLocalFonts(): Promise<LocalFont[]> {
  const query = (window as Window & { queryLocalFonts?: () => Promise<LocalFont[]> }).queryLocalFonts
  if (!query) throw new Error('This browser does not support listing device fonts. Import a font file instead.')
  return (await query.call(window)).sort((a, b) => a.fullName.localeCompare(b.fullName))
}

export interface OnlineFont { name: string; label: string; license: string }
export async function searchOnlineFonts(query: string, signal?: AbortSignal): Promise<OnlineFont[]> {
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(`scope:fontsource ${query}`)}&size=60`
  const response = await fetch(url, { signal, credentials: 'omit' })
  if (!response.ok) throw new Error('Font search is unavailable. Check your connection and try again.')
  const result = await response.json() as { objects: { package: { name: string; description?: string; license?: string } }[] }
  return result.objects.filter(({ package: pkg }) => /^@fontsource\/[a-z0-9-]+$/.test(pkg.name)).map(({ package: pkg }) => ({
    name: pkg.name, label: pkg.description?.match(/Self-host the (.+?) font/)?.[1] || pkg.name.slice('@fontsource/'.length).replace(/-/g, ' '), license: pkg.license || 'See package licence',
  }))
}

// Extract only Fontsource's regular WOFF2 faces; no third-party runtime is needed.
async function unpackFontArchive(blob: Blob): Promise<Map<string, Uint8Array>> {
  if (!('DecompressionStream' in window)) throw new Error('This browser cannot unpack online fonts. Import a font file instead.')
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
  const reader = stream.getReader(), chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 50 * 1024 * 1024) { await reader.cancel(); throw new Error('Font package is too large.') }
    chunks.push(value)
  }
  const buffer = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength }
  const decoder = new TextDecoder(), files = new Map<string, Uint8Array>()
  for (let i = 0; i + 512 <= buffer.length;) {
    const header = buffer.subarray(i, i + 512)
    if (header.every((byte) => byte === 0)) break
    const name = decoder.decode(header.subarray(0, 100)).replace(/\0.*$/, '')
    const length = parseInt(decoder.decode(header.subarray(124, 136)).replace(/\0.*$/, '').trim() || '0', 8)
    if (!Number.isFinite(length) || length < 0 || i + 512 + length > buffer.length) throw new Error('Invalid font package.')
    if ((name.endsWith('.css') || name.endsWith('.woff2')) && name.startsWith('package/')) files.set(name.slice(8), buffer.slice(i + 512, i + 512 + length))
    i += 512 + Math.ceil(length / 512) * 512
  }
  return files
}

export async function downloadOnlineFont(item: OnlineFont): Promise<StoredFont> {
  if (!/^@fontsource\/[a-z0-9-]+$/.test(item.name)) throw new Error('Invalid font package.')
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(item.name)}/latest`, { credentials: 'omit' })
  if (!response.ok) throw new Error('Could not load font information.')
  const metadata = await response.json() as { dist?: { tarball?: string } }
  const url = new URL(metadata.dist?.tarball || '')
  if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org') throw new Error('Invalid font download location.')
  const download = await fetch(url, { credentials: 'omit' })
  if (!download.ok) throw new Error('Could not download this font.')
  const archive = await download.blob()
  if (archive.size > 25 * 1024 * 1024) throw new Error('Font package is too large.')
  const files = await unpackFontArchive(archive)
  const cssName = files.has('400.css') ? '400.css' : [...files.keys()].find((name) => /^\d{3}\.css$/.test(name))
  if (!cssName) throw new Error('This font does not provide a regular font face.')
  const css = new TextDecoder().decode(files.get(cssName))
  const assets: FontAsset[] = []
  let total = 0
  for (const match of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
    const path = match[1].match(/url\(['"]?\.\/(files\/[^'")]+\.woff2)['"]?\)/)?.[1]
    const range = match[1].match(/unicode-range:\s*([^;]+);/)?.[1].trim()
    if (!path || !files.has(path)) continue
    const bytes = files.get(path)!
    total += bytes.byteLength
    if (total > MAX_FONT_BYTES) throw new Error('This font is too large to install.')
    assets.push({ data: await dataUrl(new Blob([bytes as BlobPart], { type: 'font/woff2' })), ...(range ? { unicodeRange: range } : {}) })
  }
  if (!assets.length) throw new Error('Could not find a compatible font face.')
  const font = { id: newFontId(), label: item.label, assets }
  await ensureFont(font)
  return font
}
