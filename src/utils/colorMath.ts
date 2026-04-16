import type { LabColor, RgbColor, XyzColor } from '../types'

const SHORT_HEX_REGEX = /^#?([0-9a-fA-F]{3})$/
const LONG_HEX_REGEX = /^#?([0-9a-fA-F]{6})$/

const REF_X = 95.047
const REF_Y = 100
const REF_Z = 108.883
const LAB_EPSILON = 0.008856
const LAB_KAPPA = 7.787

export function normalizeHex(hex: string): string {
  const trimmed = hex.trim()

  const shortMatch = trimmed.match(SHORT_HEX_REGEX)
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }

  const longMatch = trimmed.match(LONG_HEX_REGEX)
  if (longMatch) {
    return `#${longMatch[1]}`.toUpperCase()
  }

  throw new Error(`Invalid hex color: ${hex}`)
}

export function isValidHex(hex: string): boolean {
  try {
    normalizeHex(hex)
    return true
  } catch {
    return false
  }
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeHex(hex)
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255
  if (normalized <= 0.04045) {
    return normalized / 12.92
  }
  return ((normalized + 0.055) / 1.055) ** 2.4
}

export function rgbToXyz(rgb: RgbColor): XyzColor {
  const r = srgbChannelToLinear(rgb.r)
  const g = srgbChannelToLinear(rgb.g)
  const b = srgbChannelToLinear(rgb.b)

  return {
    x: (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100,
    y: (r * 0.2126729 + g * 0.7151522 + b * 0.072175) * 100,
    z: (r * 0.0193339 + g * 0.119192 + b * 0.9503041) * 100,
  }
}

function xyzToLabPivot(value: number): number {
  // This uses the same piecewise form shown in the referenced article.
  if (value > LAB_EPSILON) {
    return Math.cbrt(value)
  }

  return LAB_KAPPA * value + 16 / 116
}

export function xyzToLab(xyz: XyzColor): LabColor {
  const x = xyzToLabPivot(xyz.x / REF_X)
  const y = xyzToLabPivot(xyz.y / REF_Y)
  const z = xyzToLabPivot(xyz.z / REF_Z)

  return {
    // L* tracks perceptual lightness
    l: 116 * y - 16,
    // a* is green-red opponent axis
    a: 500 * (x - y),
    // b* is blue-yellow opponent axis
    b: 200 * (y - z),
  }
}

export function hexToLab(hex: string): LabColor {
  return xyzToLab(rgbToXyz(hexToRgb(hex)))
}

export function deltaE76(colorA: LabColor, colorB: LabColor): number {
  const deltaL = colorA.l - colorB.l
  const deltaA = colorA.a - colorB.a
  const deltaB = colorA.b - colorB.b

  // CIE76 treats LAB as Euclidean space and measures straight-line distance.
  return Math.sqrt(deltaL ** 2 + deltaA ** 2 + deltaB ** 2)
}
