// @purpose Tunnel orchestrator - spawns broker (built viewer) + Cloudflare quick tunnel, prints public URL.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const distDir = join(__dirname, 'dist')

const PORT = process.env.DEVLOGGER_PORT ?? '9777'
const isWindows = process.platform === 'win32'

function resolveCloudflared() {
  if (process.env.CLOUDFLARED && existsSync(process.env.CLOUDFLARED)) return process.env.CLOUDFLARED
  const probeCmd = isWindows ? 'where' : 'which'
  const probe = spawnSync(probeCmd, ['cloudflared'], { encoding: 'utf8' })
  const onPath = probe.status === 0 ? probe.stdout.split(/\r?\n/).find(Boolean) : null
  if (onPath) return onPath
  if (isWindows) {
    const home = process.env.LOCALAPPDATA ?? ''
    const pkgRoot = join(home, 'Microsoft', 'WinGet', 'Packages')
    if (existsSync(pkgRoot)) {
      const folder = readdirSync(pkgRoot).find((name) => name.startsWith('Cloudflare.cloudflared'))
      if (folder) {
        const candidate = join(pkgRoot, folder, 'cloudflared.exe')
        if (existsSync(candidate)) return candidate
      }
    }
  }
  return null
}

const isDistMissing = !existsSync(join(distDir, 'index.html'))
if (isDistMissing) {
  console.error('[devlogger-tunnel] viewer/dist missing. Run: pnpm viewer:build')
  process.exit(1)
}

const cloudflared = resolveCloudflared()
if (!cloudflared) {
  console.error('[devlogger-tunnel] cloudflared not found. Install:')
  console.error('  Windows: winget install Cloudflare.cloudflared')
  console.error('  macOS:   brew install cloudflared')
  console.error('  Linux:   see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/')
  console.error('  Or set CLOUDFLARED env var to its absolute path.')
  process.exit(1)
}

const env = { ...process.env, DEVLOGGER_NO_OPEN: '1', DEVLOGGER_PORT: PORT, DEVLOGGER_HOST: '127.0.0.1' }
const spawnOpts = { stdio: 'inherit', shell: true, cwd: repoRoot, env }

console.log(`[devlogger-tunnel] starting broker on http://127.0.0.1:${PORT} ...`)
const broker = spawn('tsx viewer/server.ts', spawnOpts)

console.log('[devlogger-tunnel] starting Cloudflare quick tunnel ...')
const tunnel = spawn(`"${cloudflared}" tunnel --no-autoupdate --url http://127.0.0.1:${PORT}`, spawnOpts)

let shuttingDown = false
function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  try { broker.kill() } catch { /* ignore */ }
  try { tunnel.kill() } catch { /* ignore */ }
  process.exit(code)
}

process.on('SIGINT',  () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
broker.on('exit', (c) => shutdown(c ?? 0))
tunnel.on('exit', (c) => shutdown(c ?? 0))
