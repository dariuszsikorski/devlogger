// @purpose Dev orchestrator - spawns Fastify broker (tsx watch) + Vite dev server with HMR.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const env = {
  ...process.env,
  DEVLOGGER_NO_OPEN: '1',
  DEVLOGGER_PORT: process.env.DEVLOGGER_PORT ?? '9777',
  VITE_PORT:      process.env.VITE_PORT      ?? '9778',
}
const spawnOpts = { stdio: 'inherit', shell: true, cwd: repoRoot, env }

console.log('[devlogger-viewer] starting broker + vite dev...')

const brokerCmd = 'tsx watch viewer/server.ts'
const viteCmd   = 'vite --config viewer/vite.config.ts'

const broker = spawn(brokerCmd, spawnOpts)
const vite   = spawn(viteCmd,   spawnOpts)

let shuttingDown = false
function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  try { broker.kill() } catch { /* ignore */ }
  try { vite.kill() } catch { /* ignore */ }
  process.exit(code)
}

process.on('SIGINT',  () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
broker.on('exit', (c) => shutdown(c ?? 0))
vite.on('exit',   (c) => shutdown(c ?? 0))
