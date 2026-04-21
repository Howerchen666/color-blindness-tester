import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import './App.css'
import PaletteSwatches from './components/PaletteSwatches'
import { GOOD_EXAMPLE_PALETTE, POOR_EXAMPLE_PALETTE } from './data/examples'
import { KNOWN_COLORBLIND_FRIENDLY_PALETTES } from './data/knownPalettes'
import type { ColorPalette, DetectionResult } from './types'
import { parseHexArrayInput, parseKnownPalettesInput } from './utils/inputParser'
import { detectColorblindFriendlyPalette } from './utils/paletteDetector'
import { extractPaletteFromZip } from './utils/zipColorExtractor'

const DEFAULT_THRESHOLD = 12
const KNOWN_PALETTES_STORAGE_KEY = 'colorblind-detector-known-palettes'
const KNOWN_PALETTES_EDITOR_STORAGE_KEY = 'colorblind-detector-known-palettes-editor'

interface ZipImagePalette {
  fileName: string
  colors: string[]
}

function formatExampleJson(colors: string[]): string {
  return JSON.stringify(colors, null, 2)
}

function formatKnownPalettesJson(palettes: ColorPalette[]): string {
  return JSON.stringify(palettes, null, 2)
}

function loadStoredKnownPalettes(): ColorPalette[] {
  if (typeof window === 'undefined') {
    return KNOWN_COLORBLIND_FRIENDLY_PALETTES
  }

  try {
    const stored = window.localStorage.getItem(KNOWN_PALETTES_STORAGE_KEY)
    if (!stored) {
      return KNOWN_COLORBLIND_FRIENDLY_PALETTES
    }

    return parseKnownPalettesInput(stored)
  } catch {
    return KNOWN_COLORBLIND_FRIENDLY_PALETTES
  }
}

function loadStoredKnownPalettesEditorText(): string {
  if (typeof window === 'undefined') {
    return formatKnownPalettesJson(KNOWN_COLORBLIND_FRIENDLY_PALETTES)
  }

  try {
    const stored = window.localStorage.getItem(KNOWN_PALETTES_EDITOR_STORAGE_KEY)
    if (stored) {
      return stored
    }
  } catch {
    return formatKnownPalettesJson(loadStoredKnownPalettes())
  }

  return formatKnownPalettesJson(loadStoredKnownPalettes())
}

function App() {
  const [rawInput, setRawInput] = useState<string>(formatExampleJson(GOOD_EXAMPLE_PALETTE))
  const [rawThreshold, setRawThreshold] = useState<string>(String(DEFAULT_THRESHOLD))
  const [error, setError] = useState<string>('')
  const [copyStatus, setCopyStatus] = useState<string>('')
  const [zipError, setZipError] = useState<string>('')
  const [zipStatus, setZipStatus] = useState<string>('')
  const [zipExtractedPalettes, setZipExtractedPalettes] = useState<ZipImagePalette[]>([])
  const [knownPalettes, setKnownPalettes] = useState<ColorPalette[]>(() => loadStoredKnownPalettes())
  const [rawKnownPalettes, setRawKnownPalettes] = useState<string>(() =>
    loadStoredKnownPalettesEditorText(),
  )
  const [knownPaletteError, setKnownPaletteError] = useState<string>('')
  const [knownPaletteStatus, setKnownPaletteStatus] = useState<string>('')
  const [result, setResult] = useState<DetectionResult | null>(null)

  const threshold = useMemo(() => Number.parseFloat(rawThreshold), [rawThreshold])
  const zipResults = useMemo(
    () =>
      zipExtractedPalettes
        .map((imagePalette) => {
          try {
            return {
              fileName: imagePalette.fileName,
              detection: detectColorblindFriendlyPalette(
                imagePalette.colors,
                knownPalettes,
                threshold,
              ),
            }
          } catch {
            return null
          }
        })
        .filter((entry): entry is { fileName: string; detection: DetectionResult } => entry !== null),
    [knownPalettes, threshold, zipExtractedPalettes],
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(
        KNOWN_PALETTES_STORAGE_KEY,
        JSON.stringify(knownPalettes),
      )
    } catch {
      // Ignore storage failures and keep app behavior in-memory.
    }
  }, [knownPalettes])

  useEffect(() => {
    try {
      window.localStorage.setItem(KNOWN_PALETTES_EDITOR_STORAGE_KEY, rawKnownPalettes)
    } catch {
      // Ignore storage failures and keep app behavior in-memory.
    }
  }, [rawKnownPalettes])

  const runDetection = () => {
    setError('')
    setCopyStatus('')

    try {
      if (!Number.isFinite(threshold) || threshold < 0) {
        throw new Error('Threshold must be a non-negative number.')
      }

      const inputColors = parseHexArrayInput(rawInput)
      const detection = detectColorblindFriendlyPalette(
        inputColors,
        knownPalettes,
        threshold,
      )

      setResult(detection)
    } catch (caught) {
      setResult(null)
      setError(caught instanceof Error ? caught.message : 'Unexpected error during detection.')
    }
  }

  const setGoodExample = () => {
    setRawInput(formatExampleJson(GOOD_EXAMPLE_PALETTE))
    setCopyStatus('')
    setError('')
  }

  const setPoorExample = () => {
    setRawInput(formatExampleJson(POOR_EXAMPLE_PALETTE))
    setCopyStatus('')
    setError('')
  }

  const copyExample = async (colors: string[]) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(colors))
      setCopyStatus('Example copied to clipboard.')
    } catch {
      setCopyStatus('Copy failed. You can still use the example buttons.')
    }
  }

  const applyKnownPalettes = () => {
    setKnownPaletteError('')
    setKnownPaletteStatus('')

    try {
      const parsedPalettes = parseKnownPalettesInput(rawKnownPalettes)
      setKnownPalettes(parsedPalettes)
      setKnownPaletteStatus('Known safe palettes updated in this session.')
    } catch (caught) {
      setKnownPaletteError(
        caught instanceof Error ? caught.message : 'Failed to parse known palettes JSON.',
      )
    }
  }

  const resetKnownPalettes = () => {
    setKnownPalettes(KNOWN_COLORBLIND_FRIENDLY_PALETTES)
    setRawKnownPalettes(formatKnownPalettesJson(KNOWN_COLORBLIND_FRIENDLY_PALETTES))
    setKnownPaletteError('')
    setKnownPaletteStatus('Known safe palettes reset to defaults.')
  }

  const handleZipUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setZipError('')
    setZipStatus('Processing ZIP file...')

    try {
      const extraction = await extractPaletteFromZip(file)

      setRawInput(formatExampleJson(extraction.images[0].colors))
      setZipExtractedPalettes(extraction.images)
      setResult(null)

      const skippedMessage =
        extraction.skippedImages > 0
          ? ` (${extraction.skippedImages} image(s) skipped due to processing limit).`
          : '.'

      setZipStatus(
        `Extracted palettes for ${extraction.processedImages} image(s)${skippedMessage}`,
      )
    } catch (caught) {
      setZipError(
        caught instanceof Error ? caught.message : 'Failed to extract colors from ZIP file.',
      )
      setZipStatus('')
      setZipExtractedPalettes([])
    }
  }

  return (
    <main className="page">
      <header className="card">
        <h1>Colorblind Palette Detector</h1>
        <p>
          Similarity-based detector using Professor Chen&apos;s method: HEX to CIELAB conversion,
          Delta E nearest-color matching to known safe palettes, and threshold classification.
        </p>
      </header>

      <section className="card">
        <h2>1. Input Palette</h2>
        <label htmlFor="palette-json" className="field-label">
          Enter a JSON array of hex colors:
        </label>
        <textarea
          id="palette-json"
          className="json-input"
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
          rows={8}
          spellCheck={false}
        />

        <div className="controls-row">
          <label htmlFor="threshold" className="inline-label">
            Threshold
          </label>
          <input
            id="threshold"
            type="number"
            min="0"
            step="0.1"
            value={rawThreshold}
            onChange={(event) => setRawThreshold(event.target.value)}
            className="threshold-input"
          />
          <button onClick={runDetection} className="primary-btn" type="button">
            Run Detection
          </button>
        </div>

        <div className="controls-row examples-row">
          <button onClick={setGoodExample} type="button">
            Use Near-Match Example
          </button>
          <button onClick={setPoorExample} type="button">
            Use Poor-Match Example
          </button>
          <button onClick={() => copyExample(GOOD_EXAMPLE_PALETTE)} type="button">
            Copy Near-Match JSON
          </button>
          <button onClick={() => copyExample(POOR_EXAMPLE_PALETTE)} type="button">
            Copy Poor-Match JSON
          </button>
        </div>

        {copyStatus && <p className="hint">{copyStatus}</p>}
        {error && <p className="error">{error}</p>}

        <label htmlFor="zip-upload" className="field-label">
          Or upload a ZIP of images to auto-extract colors:
        </label>
        <input
          id="zip-upload"
          className="file-input"
          type="file"
          accept=".zip,application/zip"
          onChange={handleZipUpload}
        />
        {zipStatus && <p className="success">{zipStatus}</p>}
        {zipError && <p className="error">{zipError}</p>}

        {zipExtractedPalettes.length > 0 && (
          <div className="palette-list zip-preview">
            {zipExtractedPalettes.map((palette) => (
              <article className="palette-card" key={palette.fileName}>
                <h3>{palette.fileName}</h3>
                <PaletteSwatches colors={palette.colors} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>2. Known Safe Palettes</h2>
        <p className="hint">
          You can edit known safe palettes directly here as JSON, then click <strong>Apply</strong>.
          Applied palettes are saved in your browser local storage.
        </p>

        <label htmlFor="known-palettes-json" className="field-label">
          Known safe palettes JSON (each item like <code>{'{"name":"Palette","colors":["#4477AA"]}'}</code>):
        </label>
        <textarea
          id="known-palettes-json"
          className="json-input"
          value={rawKnownPalettes}
          onChange={(event) => setRawKnownPalettes(event.target.value)}
          rows={12}
          spellCheck={false}
        />
        <div className="controls-row">
          <button onClick={applyKnownPalettes} type="button">
            Apply Known Palettes
          </button>
          <button onClick={resetKnownPalettes} type="button">
            Reset to Default Palettes
          </button>
        </div>
        {knownPaletteStatus && <p className="success">{knownPaletteStatus}</p>}
        {knownPaletteError && <p className="error">{knownPaletteError}</p>}

        <div className="palette-list">
          {knownPalettes.map((palette) => (
            <article className="palette-card" key={palette.name}>
              <h3>{palette.name}</h3>
              <PaletteSwatches colors={palette.colors} />
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>3. Results</h2>
        {!result && <p className="hint">Run detection to see pass/fail status and palette ranking.</p>}

        {result && (
          <div className="results-wrap">
            <div className="status-row">
              <span className={result.isLikelyColorblindFriendly ? 'status pass' : 'status fail'}>
                {result.isLikelyColorblindFriendly ? 'Likely Colorblind-Friendly' : 'Not a Close Match'}
              </span>
              <span>
                Best Match: <strong>{result.bestMatch.paletteName}</strong>
              </span>
              <span>
                Best Score: <strong>{result.bestMatch.averageDistance.toFixed(2)}</strong>
              </span>
            </div>

            <div className="comparison-grid">
              <article className="palette-card">
                <h3>Input Palette</h3>
                <PaletteSwatches colors={result.inputColors} />
              </article>
              <article className="palette-card">
                <h3>Best Matched Safe Palette</h3>
                <PaletteSwatches colors={result.bestMatch.paletteColors} />
              </article>
            </div>

            <h3>Ranking (lower score is better)</h3>
            <ol className="ranking-list">
              {result.ranking.map((score) => (
                <li key={score.paletteName}>
                  <span>{score.paletteName}</span>
                  <strong>{score.averageDistance.toFixed(2)}</strong>
                </li>
              ))}
            </ol>

            {!result.isLikelyColorblindFriendly && (
              <p className="hint">
                Suggestion: adjust the known safe palette set in section 2 (web editor) so it better
                represents your target style before re-running detection.
              </p>
            )}
          </div>
        )}

        {zipResults.length > 0 && (
          <>
            <h3>ZIP Results By Image</h3>
            <div className="palette-list">
              {zipResults.map(({ fileName, detection }) => (
                <article className="palette-card zip-result-card" key={fileName}>
                  <div className="status-row">
                    <strong>{fileName}</strong>
                    <span
                      className={
                        detection.isLikelyColorblindFriendly ? 'status pass' : 'status fail'
                      }
                    >
                      {detection.isLikelyColorblindFriendly ? 'Likely Friendly' : 'Not a Close Match'}
                    </span>
                  </div>
                  <p className="zip-result-summary">
                    Best Match: <strong>{detection.bestMatch.paletteName}</strong> with score{' '}
                    <strong>{detection.bestMatch.averageDistance.toFixed(2)}</strong>
                  </p>
                  <div className="comparison-grid">
                    <article className="palette-card">
                      <h3>Extracted Palette</h3>
                      <PaletteSwatches colors={detection.inputColors} />
                    </article>
                    <article className="palette-card">
                      <h3>Best Matched Safe Palette</h3>
                      <PaletteSwatches colors={detection.bestMatch.paletteColors} />
                    </article>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default App
