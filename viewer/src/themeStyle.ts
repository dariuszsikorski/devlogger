// @purpose Centralized CSS-var store - all dynamic theme variables (surface, semantic colors, text, slider fills) are written into ONE dedicated <style id="theme-vars"> tag. Single source of truth, no inline element styles, no scattered style tags.
const TAG_ID = 'theme-vars'

const state: Map<string, string> = new Map()

function ensureTag(): HTMLStyleElement {
  let el = document.getElementById(TAG_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = TAG_ID
    document.head.appendChild(el)
  }
  return el
}

function render() {
  const lines: string[] = []
  for (const [key, value] of state) lines.push(`  ${key}: ${value};`)
  ensureTag().textContent = ':root {\n' + lines.join('\n') + '\n}'
}

export function updateTheme(partial: Record<string, string>): void {
  let changed = false
  for (const key in partial) {
    const value = partial[key]
    if (state.get(key) !== value) { state.set(key, value); changed = true }
  }
  if (changed) render()
}
