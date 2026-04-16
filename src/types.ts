export interface ColorPalette {
  name: string
  colors: string[]
}

export interface PaletteScore {
  paletteName: string
  paletteColors: string[]
  averageDistance: number
}

export interface DetectionResult {
  inputColors: string[]
  threshold: number
  isLikelyColorblindFriendly: boolean
  bestMatch: PaletteScore
  ranking: PaletteScore[]
}

export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface XyzColor {
  x: number
  y: number
  z: number
}

export interface LabColor {
  l: number
  a: number
  b: number
}
