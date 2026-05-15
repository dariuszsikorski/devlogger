// @purpose Best-effort detection of dev vs prod across Vite, Next.js, Node.js, and plain browsers.
// Uses `new Function` so neither CJS nor non-ESM browsers throw at parse time.

interface ImportMetaEnv {
  DEV?: boolean
  MODE?: string
  NODE_ENV?: string
}

function readImportMetaEnv(): ImportMetaEnv | null {
  try {
    const meta = new Function('try { return import.meta } catch { return null }')() as { env?: ImportMetaEnv } | null
    return meta && meta.env ? meta.env : null
  } catch {
    return null
  }
}

function readProcessEnv(): Record<string, string | undefined> | null {
  try {
    const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    return p && p.env ? p.env : null
  } catch {
    return null
  }
}

/**
 * Returns true when running in a development-like environment, false in production.
 * When detection cannot determine the environment, defaults to true (the safer choice
 * for a dev tool - logs are visible until explicitly disabled).
 */
export function detectDev(): boolean {
  const meta = readImportMetaEnv()
  if (meta) {
    if (typeof meta.DEV === 'boolean') return meta.DEV
    if (meta.MODE === 'production' || meta.NODE_ENV === 'production') return false
    if (meta.MODE === 'development' || meta.NODE_ENV === 'development') return true
  }

  const proc = readProcessEnv()
  if (proc) {
    if (proc.NODE_ENV === 'production') return false
    if (proc.NODE_ENV === 'development' || proc.NODE_ENV === 'test') return true
  }

  return true
}
