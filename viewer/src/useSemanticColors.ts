// @purpose React hook - subscribes to brightness changes and writes okhsl-derived semantic colors + body text vars through the central themeStyle store.
import { useLayoutEffect } from 'react'
import { useMode, modeOkhsl, modeRgb, formatHex } from 'culori/fn'
import { getColorParams } from './colorGraph'
import { PALETTE, OFFSET_LEVELS, getColorDelta } from './colorPalette'
import { updateTheme } from './themeStyle'

useMode(modeRgb)
useMode(modeOkhsl)

const THEME_LIGHT_THRESHOLD = 0.67

function okhslToHex(L: number, S: number, H: number): string {
  return formatHex({ mode: 'okhsl', l: L, s: S, h: H }) ?? '#000000'
}

function clamp01(v: number): number {
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function applyForSurface(surfaceL: number) {
  const { L: baseL, S } = getColorParams(surfaceL)
  const partial: Record<string, string> = {}

  const isLightSurface = surfaceL >= THEME_LIGHT_THRESHOLD
  partial['--color-text']       = isLightSurface ? 'oklch(0.20 0.005 255)' : 'oklch(0.94 0.005 255)'
  partial['--color-text-muted'] = isLightSurface ? 'oklch(0.32 0.005 255)' : 'oklch(0.65 0.005 255)'

  for (const color of PALETTE) {
    const sat     = color.forceS ?? S
    const tunedL  = clamp01(baseL + getColorDelta(color, surfaceL))
    const baseHex = okhslToHex(tunedL, sat, color.H)
    partial[`--color-${color.name}`]      = baseHex
    partial[`--color-${color.name}-base`] = baseHex
    for (const { key, delta } of OFFSET_LEVELS) {
      partial[`--color-${color.name}-${key}`] = okhslToHex(clamp01(tunedL + delta), sat, color.H)
    }
  }
  updateTheme(partial)
}

function readInitialSurfaceL(): number {
  try {
    const raw = localStorage.getItem('devlogger.brightness')
    const n   = Number(raw)
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n
  } catch { /* ignore */ }
  return 0.18
}

export function useSemanticColors() {
  useLayoutEffect(() => {
    applyForSurface(readInitialSurfaceL())
    function onBrightnessChange(e: Event) {
      applyForSurface((e as CustomEvent<{ L: number }>).detail.L)
    }
    document.addEventListener('devlogger:brightness', onBrightnessChange as EventListener)
    return () => document.removeEventListener('devlogger:brightness', onBrightnessChange as EventListener)
  }, [])
}
