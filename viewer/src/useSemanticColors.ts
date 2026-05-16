// @purpose React hook - subscribes to brightness changes and writes okhsl-derived semantic colors to <html> per the base graph + per-color tuned delta curves from the palette.
import { useLayoutEffect } from 'react'
import { useMode, modeOkhsl, modeRgb, formatHex } from 'culori/fn'
import { getColorParams } from './colorGraph'
import { PALETTE, OFFSET_LEVELS, getColorDelta } from './colorPalette'

useMode(modeRgb)
useMode(modeOkhsl)

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
  const root = document.documentElement
  for (const color of PALETTE) {
    const sat     = color.forceS ?? S
    const tunedL  = clamp01(baseL + getColorDelta(color, surfaceL))
    const baseHex = okhslToHex(tunedL, sat, color.H)
    root.style.setProperty(`--color-${color.name}`,      baseHex)
    root.style.setProperty(`--color-${color.name}-base`, baseHex)
    for (const { key, delta } of OFFSET_LEVELS) {
      root.style.setProperty(`--color-${color.name}-${key}`, okhslToHex(clamp01(tunedL + delta), sat, color.H))
    }
  }
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
