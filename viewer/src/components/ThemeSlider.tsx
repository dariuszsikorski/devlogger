// @purpose Brightness slider - writes --surface-base and slider fill percent through themeStyle store, dispatches devlogger:brightness for downstream listeners.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Slider, SliderOutput, SliderThumb, SliderTrack } from 'react-aria-components'
import { Moon, Sun } from 'lucide-react'
import { updateTheme } from '../themeStyle'

const STORAGE_KEY = 'devlogger.brightness'
const MIN     = 0.10
const MAX     = 1.0
const DEFAULT = 0.18
const THEME_LIGHT_THRESHOLD = 0.67

function readSaved(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT
    const n = Number(raw)
    if (Number.isFinite(n) && n >= MIN && n <= MAX) return n
  } catch { /* ignore */ }
  return DEFAULT
}

function applyBrightness(L: number) {
  updateTheme({ '--surface-base': `oklch(${L.toFixed(3)} 0.005 255)` })

  const root = document.documentElement
  root.classList.toggle('theme-dark',  L <  THEME_LIGHT_THRESHOLD)
  root.classList.toggle('theme-light', L >= THEME_LIGHT_THRESHOLD)

  document.dispatchEvent(new CustomEvent('devlogger:brightness', { detail: { L } }))
}

export function ThemeSlider() {
  const [value, setValue] = useState<number>(() => readSaved())
  const isFirstRun = useRef(true)

  useEffect(() => {
    applyBrightness(value)
    if (!isFirstRun.current) {
      try { localStorage.setItem(STORAGE_KEY, String(value)) } catch { /* ignore */ }
    }
    isFirstRun.current = false
  }, [value])

  useLayoutEffect(() => {
    const pct = ((value - MIN) / (MAX - MIN)) * 100
    updateTheme({ '--theme-slider-fill': `${pct.toFixed(2)}%` })
  }, [value])

  return (
    <Slider
      className="ThemeSlider"
      value={value}
      onChange={(v) => setValue(typeof v === 'number' ? v : v[0])}
      minValue={MIN}
      maxValue={MAX}
      step={0.01}
      aria-label="UI brightness"
    >
      <Moon className="ThemeSlider_iconLeft" size={12} aria-hidden="true" />
      <SliderTrack className="ThemeSlider_track">
        <span className="ThemeSlider_fill" />
        <SliderThumb className="ThemeSlider_thumb" />
      </SliderTrack>
      <Sun className="ThemeSlider_iconRight" size={12} aria-hidden="true" />
      <SliderOutput className="ThemeSlider_value">
        {({ state }) => state.getThumbValue(0).toFixed(2)}
      </SliderOutput>
    </Slider>
  )
}
