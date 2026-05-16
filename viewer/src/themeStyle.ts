// @purpose Centralized CSS-var store - wszystkie dynamiczne zmienne motywu (surface, semantic colors, text, slider fills) trafiaja do JEDNEGO <style id="theme-vars">.
// Single source of truth. Tag jest re-appendowany na koniec <head> przy kazdym renderze, dzieki czemu wygrywa kaskade z fallbackami z tokens.scss/App.scss (Vite wstrzykuje style komponentow PO boot scripcie, wiec bez re-append boot tag tonie). Dzieki temu obywamy sie bez !important.
const TAG_ID = 'theme-vars'

const state: Map<string, string> = new Map()

function ensureTagAtEnd(): HTMLStyleElement {
  let el = document.getElementById(TAG_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = TAG_ID
  }
  // appendChild na juz przylaczonym wezle = przesun na koniec; nowy = wstaw.
  document.head.appendChild(el)
  return el
}

function render() {
  const lines: string[] = []
  for (const [key, value] of state) lines.push(`  ${key}: ${value};`)
  ensureTagAtEnd().textContent = ':root {\n' + lines.join('\n') + '\n}'
}

export function updateTheme(partial: Record<string, string>): void {
  let changed = false
  for (const key in partial) {
    const value = partial[key]
    if (state.get(key) !== value) { state.set(key, value); changed = true }
  }
  if (changed) render()
}
