// @purpose Hand-tuned color graph - okhsl (L, S) for semantic text against surface L. Piecewise linear interpolation over two segments separated by a deliberate light-text/dark-text discontinuity around surface L 0.725.

interface ColorPoint {
  surfaceL: number
  L:        number
}

const LIGHT_TEXT_POINTS: ReadonlyArray<ColorPoint> = [
  { surfaceL: 0.00, L: 0.65 },
  { surfaceL: 0.10, L: 0.65 },
  { surfaceL: 0.20, L: 0.65 },
  { surfaceL: 0.30, L: 0.60 },
  { surfaceL: 0.40, L: 0.67 },
  { surfaceL: 0.48, L: 0.70 },
  { surfaceL: 0.55, L: 0.75 },
  { surfaceL: 0.60, L: 0.80 },
  { surfaceL: 0.67, L: 0.90 },
]

const DARK_TEXT_POINTS: ReadonlyArray<ColorPoint> = [
  { surfaceL: 0.67, L: 0.35 },
  { surfaceL: 0.80, L: 0.45 },
  { surfaceL: 0.85, L: 0.50 },
  { surfaceL: 0.90, L: 0.57 },
  { surfaceL: 0.95, L: 0.60 },
  { surfaceL: 0.98, L: 0.62 },
  { surfaceL: 1.00, L: 0.63 },
]

const DARK_TEXT_THRESHOLD = 0.67
const SATURATION = 1

function interpolateL(points: ReadonlyArray<ColorPoint>, surfaceL: number): number {
  const first = points[0]
  if (surfaceL <= first.surfaceL) return first.L

  const last = points[points.length - 1]
  if (surfaceL >= last.surfaceL) return last.L

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const isInSpan = surfaceL >= a.surfaceL && surfaceL <= b.surfaceL
    if (!isInSpan) continue
    const span = b.surfaceL - a.surfaceL
    const t    = span === 0 ? 0 : (surfaceL - a.surfaceL) / span
    return a.L + t * (b.L - a.L)
  }
  return last.L
}

export function getColorParams(surfaceL: number): { L: number; S: number } {
  const useDarkText = surfaceL >= DARK_TEXT_THRESHOLD
  const segment     = useDarkText ? DARK_TEXT_POINTS : LIGHT_TEXT_POINTS
  return { L: interpolateL(segment, surfaceL), S: SATURATION }
}
