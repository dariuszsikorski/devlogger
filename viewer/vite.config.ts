// @purpose Vite config for devlogger viewer - React + SCSS + WS proxy to Fastify broker
import { createLogger, defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

const logger = createLogger()
const baseError = logger.error.bind(logger)
logger.error = (msg, opts) => {
  if (typeof msg === 'string' && msg.includes('ws proxy')) return
  baseError(msg, opts)
}

const BROKER_PORT = Number(process.env.DEVLOGGER_PORT ?? 9777)
const BROKER_HOST = process.env.DEVLOGGER_HOST ?? '127.0.0.1'
const VITE_PORT   = Number(process.env.VITE_PORT     ?? 9778)
const brokerHttp = `http://${BROKER_HOST}:${BROKER_PORT}`
const brokerWs   = `ws://${BROKER_HOST}:${BROKER_PORT}`

export default defineConfig({
  plugins: [react()],
  customLogger: logger,
  root: import.meta.dirname,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: VITE_PORT,
    strictPort: true,
    open: true,
    proxy: {
      '/health': brokerHttp,
      '/ingest': {
        target: brokerWs, ws: true, changeOrigin: true,
        configure: (proxy) => { proxy.on('error', () => { /* silence benign client aborts */ }) },
      },
      '/stream': {
        target: brokerWs, ws: true, changeOrigin: true,
        configure: (proxy) => { proxy.on('error', () => { /* silence benign client aborts */ }) },
      },
    },
  },
})
