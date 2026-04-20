# Colorblind Palette Detector

A small React + TypeScript web app that checks whether an input palette is **likely colorblind-friendly** using a similarity method based on Professor Chen's approach:

1. Convert input and known-safe palette colors from HEX to CIELAB
2. Compute perceptual differences using Delta E (CIE76)
3. For each input color, find the nearest color in each known-safe palette
4. Average these nearest distances per known-safe palette
5. Pick the lowest average score as the best match
6. Classify as likely colorblind-friendly if the best score is below a threshold

## Important Scope

- This app is **similarity-based detection only**.
- It does **not** run full color vision deficiency simulation.
- A pass result is **not a guarantee** of accessibility in all contexts.

## Tech Stack

- React
- TypeScript
- Vite
- JSZip (ZIP image reading)
- Vitest (unit tests)

## Run Locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in your terminal.

## Build and Test

```bash
npm run build
npm run test
```

## Where to Configure

- Known safe palettes: `src/data/knownPalettes.ts`
- Default threshold in UI: `src/App.tsx` (`DEFAULT_THRESHOLD`)

## Input Format

The detector expects a JSON array of hex strings, for example:

```json
["#E69F00", "#56B4E9", "#009E73", "#F0E442"]
```

Both short (`#abc`) and long (`#aabbcc`) hex are accepted and normalized.

You can also upload a `.zip` file of images in the UI. The app extracts dominant colors from the images and auto-fills the input JSON palette.

## Threshold Notes

- Lower threshold: stricter, fewer palettes pass
- Higher threshold: more permissive, more palettes pass
- The app uses a numeric Delta E average score from nearest-color matching

A practical class-project workflow is to start around `10` to `15` and adjust based on your reference palette set.

## Project Layout

```text
src/
  components/
    PaletteSwatches.tsx
  data/
    examples.ts
    knownPalettes.ts
  utils/
    colorMath.ts
    inputParser.ts
    paletteDetector.ts
    zipColorExtractor.ts
    colorMath.test.ts
    paletteDetector.test.ts
  App.tsx
  App.css
  index.css
```

## Core Utility Functions

Implemented in `src/utils`:

- `hexToRgb`
- `rgbToXyz`
- `xyzToLab`
- `deltaE76`
- palette scoring (`scorePaletteAgainstReference`)
- detector (`detectColorblindFriendlyPalette`)

These utilities are intentionally separated from the UI so the method is easy to inspect and test.
