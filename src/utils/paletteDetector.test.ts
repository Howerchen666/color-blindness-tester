import { describe, expect, it } from 'vitest'
import { KNOWN_COLORBLIND_FRIENDLY_PALETTES } from '../data/knownPalettes'
import {
  detectColorblindFriendlyPalette,
  scorePaletteAgainstReference,
} from './paletteDetector'

describe('palette detector', () => {
  it('matches a known-safe palette closely', () => {
    const input = ['#E69F00', '#56B4E9', '#009E73', '#F0E442']

    const result = detectColorblindFriendlyPalette(
      input,
      KNOWN_COLORBLIND_FRIENDLY_PALETTES,
      12,
    )

    expect(result.bestMatch.paletteName).toBe('Okabe-Ito')
    expect(result.bestMatch.averageDistance).toBeLessThan(0.5)
    expect(result.isLikelyColorblindFriendly).toBe(true)
  })

  it('scores a harsh neon palette poorly against safe references', () => {
    const input = ['#00FF00', '#FF00FF', '#00FFFF', '#FF0000']

    const result = detectColorblindFriendlyPalette(
      input,
      KNOWN_COLORBLIND_FRIENDLY_PALETTES,
      12,
    )

    expect(result.bestMatch.averageDistance).toBeGreaterThan(18)
    expect(result.isLikelyColorblindFriendly).toBe(false)
  })

  it('computes an average nearest distance for a single reference palette', () => {
    const score = scorePaletteAgainstReference(
      ['#E69F00', '#56B4E9'],
      KNOWN_COLORBLIND_FRIENDLY_PALETTES[0],
    )

    expect(score.averageDistance).toBeLessThan(0.1)
  })
})
