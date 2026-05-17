// @purpose Color palette - single registry of semantic colors with hue/saturation overrides and hand-tuned L delta curves; consumed by useSemanticColors and ColorRamps.

interface OffsetPoint { surfaceL: number; delta: number }

const OFFSET_LEVEL_TO_DELTA: Record<number, number> = {
  [-3]: -0.18, [-2]: -0.10, [-1]: -0.04,
  [0]:   0,
  [1]:   0.04, [2]:   0.10, [3]:   0.18,
}

function curve(...points: Array<[number, number]>): ReadonlyArray<OffsetPoint> {
  return points.map(([surfaceL, level]) => ({ surfaceL, delta: OFFSET_LEVEL_TO_DELTA[level] ?? 0 }))
}

// Tuned visually 2026-05-16. Each pair = [surfaceL, offset_level_-3..+3].
const SUCCESS_CURVE = curve(
  [0.10, +1], [0.30, +3], [0.45, +2], [0.61, +1], [0.67, -1],
  [0.75,  0], [0.90, +1], [0.95,  0], [1.00, +1],
)
const WARNING_CURVE = curve(
  [0.10, +2], [0.30, +3], [0.45, +1], [0.61,  0], [0.67,  0],
  [0.75, +1], [0.90, +1], [0.95, +2], [1.00, +1],
)
const ALERT_CURVE = curve(
  [0.10, -1], [0.30,  0], [0.45, -1], [0.61, -1], [0.67, -1],
  [0.75,  0], [0.90,  0], [0.95,  0], [1.00,  0],
)
const INFO_CURVE = curve(
  [0.10,  0], [0.30, +1], [0.45, +1], [0.61,  0], [0.67, -1],
  [0.75, +1], [0.90,  0], [0.95, +2], [1.00, +1],
)
// Estymata 2026-05-17 wzorowana na INFO. Fiolet (H=295) jest perceptualnie
// ciemniejszy od niebieskiego (H=245), wiec na ciemnych tlach (L<=0.45)
// idziemy o jeden poziom wyzej niz info zeby zachowac czytelnosc i odroznienie
// debug vs info. Na jasnych tlach (L>=0.75) o jeden ponizej info, zeby fiolet
// nie zlewal sie z bialym i mial mocniejszy kontrast.
const DEBUG_CURVE = curve(
  [0.10, +1], [0.30, +2], [0.45, +1], [0.61,  0], [0.67, -1],
  [0.75,  0], [0.90,  0], [0.95, +1], [1.00,  0],
)
// Accent = CTA / primary, musi wybijac sie mocniej niz info na kazdym tle.
// Wzorowane na INFO ale z wzmocnionym kontrastem vs surface w strefach gdzie
// info siedzi blisko bg (0.30-0.45 oraz 0.75-1.00).
const ACCENT_CURVE = curve(
  [0.10, +1], [0.30, +2], [0.45, +2], [0.61, +1], [0.67, -1],
  [0.75,  0], [0.90, -1], [0.95,  0], [1.00, -1],
)

export interface SemanticColor {
  name:    string
  H:       number
  forceS?: number
  deltas?: ReadonlyArray<OffsetPoint>
}

export const PALETTE: ReadonlyArray<SemanticColor> = [
  { name: 'success', H: 145,             deltas: SUCCESS_CURVE },
  { name: 'warning', H:  75,             deltas: WARNING_CURVE },
  { name: 'alert',   H:  25,             deltas: ALERT_CURVE   },
  { name: 'info',    H: 245,             deltas: INFO_CURVE    },
  { name: 'debug',   H: 295,             deltas: DEBUG_CURVE   },
  { name: 'neutral', H: 255, forceS: 0,                        },
  { name: 'accent',  H: 245,             deltas: ACCENT_CURVE  },
]

// Step deltas used for L+/-N offset variants exposed on every color as CSS vars.
export const OFFSET_LEVELS: ReadonlyArray<{ level: number; key: string; delta: number }> = [
  { level: -3, key: 'minus-3', delta: -0.18 },
  { level: -2, key: 'minus-2', delta: -0.10 },
  { level: -1, key: 'minus-1', delta: -0.04 },
  { level:  1, key: 'plus-1',  delta:  0.04 },
  { level:  2, key: 'plus-2',  delta:  0.10 },
  { level:  3, key: 'plus-3',  delta:  0.18 },
]

export function getColorDelta(color: SemanticColor, surfaceL: number): number {
  if (!color.deltas || color.deltas.length === 0) return 0
  const points = color.deltas
  if (surfaceL <= points[0].surfaceL) return points[0].delta
  const last = points[points.length - 1]
  if (surfaceL >= last.surfaceL) return last.delta
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (surfaceL >= a.surfaceL && surfaceL <= b.surfaceL) {
      const span = b.surfaceL - a.surfaceL
      const t    = span === 0 ? 0 : (surfaceL - a.surfaceL) / span
      return a.delta + t * (b.delta - a.delta)
    }
  }
  return last.delta
}
