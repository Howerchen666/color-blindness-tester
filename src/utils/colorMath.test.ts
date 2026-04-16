import { describe, expect, it } from 'vitest'
import { deltaE76, hexToLab, hexToRgb, normalizeHex, rgbToXyz } from './colorMath'

describe('colorMath utilities', () => {
  it('normalizes 3-digit hex and parses RGB values', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC')
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 })
  })

  it('converts white RGB to XYZ near D65 reference', () => {
    const xyz = rgbToXyz({ r: 255, g: 255, b: 255 })

    expect(xyz.x).toBeCloseTo(95.05, 1)
    expect(xyz.y).toBeCloseTo(100, 1)
    expect(xyz.z).toBeCloseTo(108.9, 1)
  })

  it('returns zero Delta E for identical LAB colors', () => {
    const lab = hexToLab('#336699')
    expect(deltaE76(lab, lab)).toBeCloseTo(0, 8)
  })
})
