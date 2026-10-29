import type { DesignLayer, Point } from './types'

/** Finds a contiguous region of similar RGBA pixels in the displayed image crop.
 * Processing is local and bounded to 1024 pixels on the longest side. */
export async function magicWandMask(layer: DesignLayer, point: Point, tolerance: number, mode: 'keep' | 'hide'): Promise<string> {
  if (!layer.src) throw new Error('This image has no source.')
  const image = new Image()
  image.src = layer.src
  await image.decode()
  const ratio = Math.min(1, 1024 / Math.max(1, layer.width, layer.height))
  const width = Math.max(1, Math.round(layer.width * ratio))
  const height = Math.max(1, Math.round(layer.height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas processing is not available.')
  const scale = layer.imageScale || 1
  const targetWidth = layer.width * scale * ratio, targetHeight = layer.height * scale * ratio
  const x = (layer.x - (layer.width * scale - layer.width) / 2 + (layer.imageOffsetX || 0) - layer.x) * ratio
  const y = (layer.y - (layer.height * scale - layer.height) / 2 + (layer.imageOffsetY || 0) - layer.y) * ratio
  // Match the image element's xMidYMid slice behaviour.
  const fit = Math.max(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight)
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, targetWidth, targetHeight); ctx.clip()
  ctx.drawImage(image, x + (targetWidth - image.naturalWidth * fit) / 2, y + (targetHeight - image.naturalHeight * fit) / 2, image.naturalWidth * fit, image.naturalHeight * fit)
  ctx.restore()
  const pixels = ctx.getImageData(0, 0, width, height)
  const data = pixels.data
  const sx = Math.min(width - 1, Math.max(0, Math.floor(point.x * width)))
  const sy = Math.min(height - 1, Math.max(0, Math.floor(point.y * height)))
  const start = (sy * width + sx) * 4
  const reference = [data[start], data[start + 1], data[start + 2], data[start + 3]]
  const seen = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0, tail = 0
  const seed = sy * width + sx
  queue[tail++] = seed; seen[seed] = 1
  const threshold = Math.max(0, Math.min(255, tolerance))
  const enqueue = (neighbour: number) => {
    if (!seen[neighbour]) { seen[neighbour] = 1; queue[tail++] = neighbour }
  }
  while (head < tail) {
    const index = queue[head++]
    const i = index * 4
    // Maximum channel distance makes the tolerance easy to understand and includes alpha.
    if (Math.max(Math.abs(data[i] - reference[0]), Math.abs(data[i + 1] - reference[1]), Math.abs(data[i + 2] - reference[2]), Math.abs(data[i + 3] - reference[3])) > threshold) { seen[index] = 2; continue }
    const px = index % width, py = Math.floor(index / width)
    if (px > 0) enqueue(index - 1)
    if (px + 1 < width) enqueue(index + 1)
    if (py > 0) enqueue(index - width)
    if (py + 1 < height) enqueue(index + width)
  }
  for (let index = 0; index < width * height; index++) {
    const selected = seen[index] === 1
    const value = (mode === 'keep' ? selected : !selected) ? 255 : 0
    const i = index * 4
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas.toDataURL('image/png')
}
