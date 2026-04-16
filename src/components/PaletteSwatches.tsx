interface PaletteSwatchesProps {
  colors: string[]
}

function PaletteSwatches({ colors }: PaletteSwatchesProps) {
  return (
    <div className="swatch-grid">
      {colors.map((color, index) => (
        <div className="swatch-chip" key={`${color}-${index}`}>
          <div className="swatch-color" style={{ backgroundColor: color }} />
          <code>{color}</code>
        </div>
      ))}
    </div>
  )
}

export default PaletteSwatches
