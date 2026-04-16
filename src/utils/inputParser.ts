import { isValidHex, normalizeHex } from './colorMath'
import type { ColorPalette } from '../types'

function parseHexStringArray(value: unknown, fieldLabel: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldLabel} must be an array of hex color strings.`)
  }

  if (value.length === 0) {
    throw new Error(`${fieldLabel} cannot be empty.`)
  }

  return value.map((item, index) => {
    if (typeof item !== 'string') {
      throw new Error(`${fieldLabel} entry at index ${index} is not a string.`)
    }

    if (!isValidHex(item)) {
      throw new Error(`${fieldLabel} has invalid hex at index ${index}: ${item}`)
    }

    return normalizeHex(item)
  })
}

export function parseHexArrayInput(rawInput: string): string[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawInput)
  } catch {
    throw new Error('Input must be valid JSON, for example: ["#E69F00", "#56B4E9"]')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Input must be a JSON array of hex color strings.')
  }

  // Validate and normalize each user-provided hex string before detection.
  return parseHexStringArray(parsed, 'Input palette')
}

export function parseKnownPalettesInput(rawInput: string): ColorPalette[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawInput)
  } catch {
    throw new Error(
      'Known palettes must be valid JSON, for example: [{"name":"My Safe Set","colors":["#4477AA","#EE6677"]}]',
    )
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Known palettes must be a JSON array of palette objects.')
  }

  if (parsed.length === 0) {
    throw new Error('Known palettes list cannot be empty.')
  }

  return parsed.map((palette, paletteIndex) => {
    if (!palette || typeof palette !== 'object') {
      throw new Error(`Palette at index ${paletteIndex} must be an object.`)
    }

    const candidate = palette as { name?: unknown; colors?: unknown }

    if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
      throw new Error(`Palette at index ${paletteIndex} needs a non-empty "name" string.`)
    }

    const colors = parseHexStringArray(
      candidate.colors,
      `Palette "${candidate.name.trim()}" colors`,
    )

    return {
      name: candidate.name.trim(),
      colors,
    }
  })
}
