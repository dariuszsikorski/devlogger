// @purpose Viewport detection with throttled resize - rem-aware for UI scale support.
// Port from phi/aria-kit/shared/core/hooks/useViewportManager.ts (60rem breakpoint
// scales z aktualnym root font-size, czyli z UI scale-em FontSizeSlider'a).
//
// 60rem = 960px @ 16px base; przy fontSize=13px (default devlogger) prog = 780px,
// przy fontSize=28px (max slider) prog = 1680px. To intencja - wieksza skala UI
// = wczesniej przelaczamy na mobile layout, bo elementy zajmuja wiecej miejsca.
//
// Klasy lecuwa na <html> ORAZ <body> (mirror phiui-shared) - kod nadrzedny moze
// celowac w body[is-mobile] gdyby tag html mial inny scope (np. embed).
import { useEffect, useLayoutEffect, useState } from 'react'

const BREAKPOINT_REM = 60
const THROTTLE_MS = 100

export interface ViewportMode {
  isMobile: boolean
  isDesktop: boolean
  widthRem: number
}

function getViewportMode(): ViewportMode {
  // getComputedStyle czyta aktualnie zaaplikowany font-size - bez animacji na
  // --root-font-size jest spojny z target value FontSizeSlider'a.
  const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const widthRem = Math.round((window.innerWidth / fontSize) * 10) / 10
  return {
    isMobile: widthRem <= BREAKPOINT_REM,
    isDesktop: widthRem > BREAKPOINT_REM,
    widthRem,
  }
}

function updateClasses(isMobile: boolean) {
  const cls = isMobile ? 'is-mobile' : 'is-desktop'
  const html = document.documentElement.classList
  const body = document.body.classList
  html.remove('is-mobile', 'is-desktop')
  body.remove('is-mobile', 'is-desktop')
  html.add(cls)
  body.add(cls)
}

export function useViewportClass(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(() => getViewportMode())

  // useLayoutEffect zeby uniknac FOUC - klasy sa wpiete przed pierwszym paintem.
  useLayoutEffect(() => {
    updateClasses(mode.isMobile)
  }, [mode.isMobile])

  useEffect(() => {
    let lastTime = 0
    let rafId: number | null = null

    const recompute = () => {
      const next = getViewportMode()
      setMode((prev) => {
        if (prev.isMobile !== next.isMobile) {
          updateClasses(next.isMobile)
          return next
        }
        return prev.widthRem !== next.widthRem ? next : prev
      })
    }

    const onResize = () => {
      const now = Date.now()
      if (now - lastTime < THROTTLE_MS) {
        if (rafId) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(onResize)
        return
      }
      lastTime = now
      rafId = null
      recompute()
    }

    window.addEventListener('resize', onResize)
    // FontSizeSlider dispatchuje 'devlogger:fontsize' przy kazdej zmianie -
    // bez tego prog 60rem nie przeliczalby sie po przesunieciu slidera.
    document.addEventListener('devlogger:fontsize', recompute)
    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('devlogger:fontsize', recompute)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return mode
}
