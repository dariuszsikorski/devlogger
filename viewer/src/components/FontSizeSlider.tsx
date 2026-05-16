// @purpose Font size slider - drives html.style.fontSize (rem root), persists, clickable reset indicator.
import { useEffect, useRef, useState } from 'react'
import { Slider, SliderThumb, SliderTrack } from 'react-aria-components'
import { Type } from 'lucide-react'

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
  document.documentElement.style.fontSize = size.toFixed(1) + 'px'
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

  const percent = Math.round((value / DEFAULT) * 100)

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
          {({ state }) => (
            <>
              <span
                className="FontSizeSlider_fill"
                style={{ width: `${state.getThumbPercent(0) * 100}%` }}
              />
              <SliderThumb className="FontSizeSlider_thumb" />
            </>
          )}
        </SliderTrack>
        <Type className="FontSizeSlider_iconLarge" size={16} aria-hidden="true" />
      </Slider>
      <button
        type="button"
        className="FontSizeSlider_reset"
        onClick={() => setValue(DEFAULT)}
        title="reset to 100%"
        aria-label="reset font size"
      >
        <span className="FontSizeSlider_resetPx">{value.toFixed(1)}px</span>
        <span className="FontSizeSlider_resetPct">{percent}%</span>
      </button>
    </div>
  )
}
