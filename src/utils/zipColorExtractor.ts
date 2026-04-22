import JSZip from 'jszip'

interface ColorBucket {
  count: number
  sumR: number
  sumG: number
  sumB: number
}

export interface ZipPaletteExtraction {
  images: {
    fileName: string
    colors: string[]
  }[]
  processedImages: number
  skippedImages: number
}

interface ZipExtractionOptions {
  /** Used when a file has no entry in maxColorsByImage. */
  maxColorsPerImage?: number
  /** Optional per-zip-entry limits; keys must match JSZip entry names exactly. */
  maxColorsByImage?: Record<string, number>
}

export interface ZipBatchListImage {
  fileName: string
  /** Present when the entry could be read as a blob (used for UI preview). */
  previewBlob: Blob | null
}

function assertNonNegativeIntegerMaxColors(value: number, context: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative integer.`)
  }
}

const IMAGE_FILE_REGEX = /\.(png|jpe?g|webp|bmp|gif)$/i
const MAX_IMAGES_TO_PROCESS = 40
const QUANTIZATION_STEP = 32

/**
 * Light, low-chroma pixels (white, cream, paper, light gray UI) typical of figure backgrounds.
 * Uses brightness + chroma so tinted off-whites like #EFEEEB are excluded, not only #FFFFFF.
 */
const BG_LIGHT_MIN_BRIGHTNESS = 226
const BG_LIGHT_MAX_CHROMA = 22

/** Flat light gray legend / chrome (#CECFCD-ish), without catching saturated mid-tones. */
const BG_NEUTRAL_MIN_BRIGHTNESS = 196
const BG_NEUTRAL_MAX_CHROMA = 14
const BG_NEUTRAL_MIN_CHANNEL = 188

function rgbBrightness(r: number, g: number, b: number): number {
  return (r + g + b) / 3
}

function rgbChroma(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function isBackgroundLikeRgb(r: number, g: number, b: number): boolean {
  const bright = rgbBrightness(r, g, b)
  const chroma = rgbChroma(r, g, b)
  const minC = Math.min(r, g, b)

  if (bright >= BG_LIGHT_MIN_BRIGHTNESS && chroma <= BG_LIGHT_MAX_CHROMA) {
    return true
  }

  if (
    bright >= BG_NEUTRAL_MIN_BRIGHTNESS &&
    chroma <= BG_NEUTRAL_MAX_CHROMA &&
    minC >= BG_NEUTRAL_MIN_CHANNEL
  ) {
    return true
  }

  return false
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const normalized = hex.trim().toUpperCase()
  const match = /^#?([0-9A-F]{6})$/.exec(normalized)
  if (!match) {
    return null
  }
  const n = Number.parseInt(match[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** macOS archives often include __MACOSX/ and AppleDouble `._*` files next to real images. */
function isMacOsZipMetadataPath(entryName: string): boolean {
  const normalized = entryName.replace(/\\/g, '/')
  if (normalized.includes('__MACOSX/')) {
    return true
  }
  const baseName = normalized.split('/').pop() ?? normalized
  return baseName.startsWith('._')
}

function isZipImageFileEntry(entryName: string): boolean {
  return IMAGE_FILE_REGEX.test(entryName) && !isMacOsZipMetadataPath(entryName)
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}

function extractDominantHexColors(imageData: ImageData, maxColorsPerImage?: number): string[] {
  const buckets = new Map<string, ColorBucket>()
  const { data } = imageData

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]
    if (alpha < 120) {
      continue
    }

    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]

    if (isBackgroundLikeRgb(r, g, b)) {
      continue
    }

    const quantizedR = Math.floor(r / QUANTIZATION_STEP)
    const quantizedG = Math.floor(g / QUANTIZATION_STEP)
    const quantizedB = Math.floor(b / QUANTIZATION_STEP)
    const key = `${quantizedR}-${quantizedG}-${quantizedB}`

    const existingBucket = buckets.get(key)
    if (existingBucket) {
      existingBucket.count += 1
      existingBucket.sumR += r
      existingBucket.sumG += g
      existingBucket.sumB += b
      continue
    }

    buckets.set(key, {
      count: 1,
      sumR: r,
      sumG: g,
      sumB: b,
    })
  }

  const sortedBuckets = [...buckets.values()].sort((a, b) => b.count - a.count)
  const limitedBuckets =
    typeof maxColorsPerImage === 'number' && maxColorsPerImage > 0
      ? sortedBuckets.slice(0, maxColorsPerImage)
      : sortedBuckets

  return limitedBuckets
    .map((bucket) => {
      const averageR = Math.round(bucket.sumR / bucket.count)
      const averageG = Math.round(bucket.sumG / bucket.count)
      const averageB = Math.round(bucket.sumB / bucket.count)
      return rgbToHex(averageR, averageG, averageB)
    })
    .filter((hex) => {
      const rgb = parseHexRgb(hex)
      if (!rgb) {
        return true
      }
      return !isBackgroundLikeRgb(rgb[0], rgb[1], rgb[2])
    })
}

function scaleToWorkingSize(width: number, height: number): { width: number; height: number } {
  const maxDimension = 180

  if (width <= maxDimension && height <= maxDimension) {
    return { width, height }
  }

  if (width > height) {
    return {
      width: maxDimension,
      height: Math.max(1, Math.round((height / width) * maxDimension)),
    }
  }

  return {
    width: Math.max(1, Math.round((width / height) * maxDimension)),
    height: maxDimension,
  }
}

async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob)
  const scaled = scaleToWorkingSize(bitmap.width, bitmap.height)

  const canvas = document.createElement('canvas')
  canvas.width = scaled.width
  canvas.height = scaled.height

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Unable to create drawing context for image processing.')
  }

  context.drawImage(bitmap, 0, 0, scaled.width, scaled.height)
  bitmap.close()

  return context.getImageData(0, 0, scaled.width, scaled.height)
}

export async function listZipImagesForBatchUi(file: File): Promise<{
  images: ZipBatchListImage[]
  skippedImageCount: number
}> {
  const zip = await JSZip.loadAsync(file)

  const imageEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && isZipImageFileEntry(entry.name),
  )

  if (imageEntries.length === 0) {
    throw new Error('No supported image files were found in the ZIP.')
  }

  const entriesToProcess = imageEntries.slice(0, MAX_IMAGES_TO_PROCESS)
  const images: ZipBatchListImage[] = []

  for (const entry of entriesToProcess) {
    try {
      const previewBlob = await entry.async('blob')
      images.push({ fileName: entry.name, previewBlob })
    } catch {
      images.push({ fileName: entry.name, previewBlob: null })
    }
  }

  return {
    images,
    skippedImageCount: imageEntries.length - entriesToProcess.length,
  }
}

export async function extractPaletteFromZip(
  file: File,
  options: ZipExtractionOptions = {},
): Promise<ZipPaletteExtraction> {
  const { maxColorsPerImage, maxColorsByImage } = options

  if (maxColorsPerImage !== undefined) {
    assertNonNegativeIntegerMaxColors(maxColorsPerImage, 'Default max colors per image')
  }

  if (maxColorsByImage) {
    for (const [fileName, limit] of Object.entries(maxColorsByImage)) {
      assertNonNegativeIntegerMaxColors(
        limit,
        `Max colors for image "${fileName}"`,
      )
    }
  }

  const zip = await JSZip.loadAsync(file)

  const imageEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && isZipImageFileEntry(entry.name),
  )

  if (imageEntries.length === 0) {
    throw new Error('No supported image files were found in the ZIP.')
  }

  const entriesToProcess = imageEntries.slice(0, MAX_IMAGES_TO_PROCESS)
  const extractedImages: ZipPaletteExtraction['images'] = []
  let processedImages = 0

  for (const entry of entriesToProcess) {
    try {
      const blob = await entry.async('blob')
      const imageData = await blobToImageData(blob)
      const limitForEntry =
        maxColorsByImage && Object.prototype.hasOwnProperty.call(maxColorsByImage, entry.name)
          ? maxColorsByImage[entry.name]
          : maxColorsPerImage
      const imageColors = extractDominantHexColors(imageData, limitForEntry)

      if (imageColors.length > 0) {
        extractedImages.push({
          fileName: entry.name,
          colors: imageColors,
        })
        processedImages += 1
      }
    } catch {
      // Skip unreadable files and continue processing the rest.
    }
  }

  if (extractedImages.length === 0) {
    throw new Error('Could not extract colors from images in the ZIP.')
  }

  return {
    images: extractedImages,
    processedImages,
    skippedImages: imageEntries.length - entriesToProcess.length,
  }
}
