// @purpose Brightness slider - sets --surface-base on :root, persists to localStorage.
import { useEffect, useRef, useState } from 'react'
import { Slider, SliderOutput, SliderThumb, SliderTrack } from 'react-aria-components'
import { Moon, Sun } from 'lucide-react'

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

const STYLE_TAG_ID = 'theme-vars'

function ensureThemeStyle(): HTMLStyleElement {
  let el = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_TAG_ID
    document.head.appendChild(el)
  }
  return el
}

function applyBrightness(L: number) {
  ensureThemeStyle().textContent =
    `:root { --surface-base: oklch(${L.toFixed(3)} 0.005 255) !important; }`

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
      <Moon className="ThemeSlider_icon" size={12} aria-hidden="true" />
      <SliderTrack className="ThemeSlider_track">
        {({ state }) => (
          <>
            <span
              className="ThemeSlider_fill"
              style={{ width: `${state.getThumbPercent(0) * 100}%` }}
            />
            <SliderThumb className="ThemeSlider_thumb" />
          </>
        )}
      </SliderTrack>
      <Sun className="ThemeSlider_icon" size={12} aria-hidden="true" />
      <SliderOutput className="ThemeSlider_value">
        {({ state }) => state.getThumbValue(0).toFixed(2)}
      </SliderOutput>
    </Slider>
  )
}
