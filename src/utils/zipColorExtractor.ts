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

const IMAGE_FILE_REGEX = /\.(png|jpe?g|webp|bmp|gif)$/i
const MAX_IMAGES_TO_PROCESS = 40
const QUANTIZATION_STEP = 32

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}

function extractDominantHexColors(imageData: ImageData): string[] {
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

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .map((bucket) => {
      const averageR = Math.round(bucket.sumR / bucket.count)
      const averageG = Math.round(bucket.sumG / bucket.count)
      const averageB = Math.round(bucket.sumB / bucket.count)
      return rgbToHex(averageR, averageG, averageB)
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

export async function extractPaletteFromZip(file: File): Promise<ZipPaletteExtraction> {
  const zip = await JSZip.loadAsync(file)

  const imageEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && IMAGE_FILE_REGEX.test(entry.name),
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
      const imageColors = extractDominantHexColors(imageData)

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
