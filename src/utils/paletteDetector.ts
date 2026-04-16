import type { ColorPalette, DetectionResult, PaletteScore } from '../types'
import { deltaE76, hexToLab, normalizeHex } from './colorMath'

function average(values: number[]): number {
  if (values.length === 0) {
    throw new Error('Cannot compute average of an empty list.')
  }

  const sum = values.reduce((running, value) => running + value, 0)
  return sum / values.length
}

export function scorePaletteAgainstReference(
  inputColors: string[],
  referencePalette: ColorPalette,
): PaletteScore {
  if (referencePalette.colors.length === 0) {
    throw new Error(`Reference palette "${referencePalette.name}" has no colors.`)
  }

  const normalizedInput = inputColors.map(normalizeHex)
  const normalizedReference = referencePalette.colors.map(normalizeHex)

  // Step 1: convert both palettes into LAB for perceptual comparison.
  const inputLabs = normalizedInput.map(hexToLab)
  const referenceLabs = normalizedReference.map(hexToLab)

  // Steps 2-3: for each input color, find nearest reference color by Delta E.
  const nearestDistances = inputLabs.map((inputLab) => {
    let smallestDistance = Number.POSITIVE_INFINITY

    for (const referenceLab of referenceLabs) {
      const distance = deltaE76(inputLab, referenceLab)
      if (distance < smallestDistance) {
        smallestDistance = distance
      }
    }

    return smallestDistance
  })

  return {
    paletteName: referencePalette.name,
    paletteColors: normalizedReference,
    // Step 4: average nearest distances to get one score per known palette.
    averageDistance: average(nearestDistances),
  }
}

export function detectColorblindFriendlyPalette(
  inputColors: string[],
  knownSafePalettes: ColorPalette[],
  threshold: number,
): DetectionResult {
  if (inputColors.length === 0) {
    throw new Error('Input palette cannot be empty.')
  }

  if (knownSafePalettes.length === 0) {
    throw new Error('Known safe palette list cannot be empty.')
  }

  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error('Threshold must be a non-negative number.')
  }

  // Step 5: rank known-safe palettes by ascending average distance.
  const ranking = knownSafePalettes
    .map((safePalette) => scorePaletteAgainstReference(inputColors, safePalette))
    .sort((a, b) => a.averageDistance - b.averageDistance)

  const bestMatch = ranking[0]

  return {
    inputColors: inputColors.map(normalizeHex),
    threshold,
    bestMatch,
    ranking,
    // Step 6: classify using configurable threshold.
    isLikelyColorblindFriendly: bestMatch.averageDistance < threshold,
  }
}
