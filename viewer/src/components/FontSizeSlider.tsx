// @purpose Font size slider - drives html.style.fontSize (rem root), persists; fill width via --font-slider-fill in themeStyle store.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Slider, SliderThumb, SliderTrack } from 'react-aria-components'
import { Type } from 'lucide-react'
import { updateTheme } from '../themeStyle'

const STORAGE_KEY = 'devlogger.fontsize'
const MIN     = 9
const MAX     = 28
const DEFAULT = 13

function readSaved(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT
    const n = Number(raw)
    if (Number.isFinite(n) && n >= MIN && n <= MAX) return n
  } catch { /* ignore */ }
  return DEFAULT
}

function applyFontSize(size: number) {
  updateTheme({ '--root-font-size': size.toFixed(1) + 'px' })
  // Sygnal dla useViewportClass - po zmianie skali UI prog mobile/desktop
  // (60rem) wyrazony w px sie przesuwa, wiec trzeba przeliczyc.
  document.dispatchEvent(new CustomEvent('devlogger:fontsize', { detail: { size } }))
}

export function FontSizeSlider() {
  const [value, setValue] = useState<number>(() => readSaved())
  const isFirstRun = useRef(true)

  useEffect(() => {
    applyFontSize(value)
    if (!isFirstRun.current) {
      try { localStorage.setItem(STORAGE_KEY, String(value)) } catch { /* ignore */ }
    }
    isFirstRun.current = false
  }, [value])

  useLayoutEffect(() => {
    const pct = ((value - MIN) / (MAX - MIN)) * 100
    updateTheme({ '--font-slider-fill': `${pct.toFixed(2)}%` })
  }, [value])

  return (
    <div className="FontSizeSlider">
      <Slider
        className="FontSizeSlider_slider"
        value={value}
        onChange={(v) => setValue(typeof v === 'number' ? v : v[0])}
        minValue={MIN}
        maxValue={MAX}
        step={0.2}
        aria-label="UI base font size"
      >
        <Type className="FontSizeSlider_iconSmall" size={10} aria-hidden="true" />
        <SliderTrack className="FontSizeSlider_track">
          <span className="FontSizeSlider_fill" />
          <SliderThumb className="FontSizeSlider_thumb" />
        </SliderTrack>
        <Type className="FontSizeSlider_iconLarge" size={16} aria-hidden="true" />
      </Slider>
    </div>
  )
}
