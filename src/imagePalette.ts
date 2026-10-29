/** Extract representative colours from the original image without uploading it. */
export async function extractImagePalette(src: string): Promise<string[]> {
  const image = new Image()
  if (!src.startsWith('data:') && !src.startsWith('blob:')) image.crossOrigin = 'anonymous'
  image.src = src
  await image.decode()
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Image is empty')
  const scale = Math.min(1, 160 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas unavailable')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data
  const buckets = new Map<number, { weight: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255
    if (alpha < .1) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4)
    const bucket = buckets.get(key) || { weight: 0, r: 0, g: 0, b: 0 }
    bucket.weight += alpha
    bucket.r += r * alpha; bucket.g += g * alpha; bucket.b += b * alpha
    buckets.set(key, bucket)
  }
  const colors: { r: number; g: number; b: number }[] = []
  const sorted = [...buckets.values()].sort((a, b) => b.weight - a.weight)
  for (const bucket of sorted) {
    const color = { r: Math.round(bucket.r / bucket.weight), g: Math.round(bucket.g / bucket.weight), b: Math.round(bucket.b / bucket.weight) }
    if (colors.some((other) => Math.hypot(color.r - other.r, color.g - other.g, color.b - other.b) < 40)) continue
    colors.push(color)
    if (colors.length === 6) break
  }
  if (!colors.length) throw new Error('Image has no visible colours')
  return colors.map(({ r, g, b }) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`)
}
