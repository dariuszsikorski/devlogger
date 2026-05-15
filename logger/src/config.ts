// @purpose Global configuration singleton. Mutated via updateConfig() / setEnabled().
import type { Config, ExecField, LogLevel, TransportConfig } from './types'
import { detectDev } from './env'
import { initTransport, stopTransport } from './transport'

function readEnvTransport(): Partial<TransportConfig> {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  const env = proc?.env
  if (!env) return {}
  const url = env.DEVLOGGER_URL ?? null
  const appId = env.DEVLOGGER_APP_ID ?? null
  return {
    enabled: url ? true : false,
    url,
    appId,
  }
}

const envTransport = readEnvTransport()

const config: Config = {
  enabled: detectDev(),
  throttleMs: 200,
  emoji: false,
  showScope: true,
  exec: { required: [] },
  mutedScopes: new Set<string>(),
  mutedLevels: new Set<LogLevel>(),
  transport: {
    enabled: envTransport.enabled ?? false,
    url: envTransport.url ?? null,
    appId: envTransport.appId ?? null,
  },
}

export function getConfig(): Config {
  return config
}

export interface UpdateConfigInput {
  enabled?: boolean
  throttleMs?: number
  emoji?: boolean
  showScope?: boolean
  exec?: { required?: ExecField[] }
  mutedScopes?: Iterable<string>
  mutedLevels?: Iterable<LogLevel>
  transport?: Partial<TransportConfig>
}

/** Shallow-merge user config into the global singleton. */
export function configure(input: UpdateConfigInput): void {
  if (typeof input.enabled === 'boolean') config.enabled = input.enabled
  if (typeof input.throttleMs === 'number' && input.throttleMs >= 0) config.throttleMs = input.throttleMs
  if (typeof input.emoji === 'boolean') config.emoji = input.emoji
  if (typeof input.showScope === 'boolean') config.showScope = input.showScope
  if (input.exec && Array.isArray(input.exec.required)) config.exec.required = [...input.exec.required]
  if (input.mutedScopes) config.mutedScopes = new Set(input.mutedScopes)
  if (input.mutedLevels) config.mutedLevels = new Set(input.mutedLevels)

  if (input.transport) {
    if (typeof input.transport.enabled === 'boolean') config.transport.enabled = input.transport.enabled
    if (typeof input.transport.url === 'string' || input.transport.url === null) config.transport.url = input.transport.url
    if (typeof input.transport.appId === 'string' || input.transport.appId === null) config.transport.appId = input.transport.appId

    if (config.transport.enabled && config.transport.url) initTransport()
    else stopTransport()
  }
}

export function setEnabled(enabled: boolean): void {
  config.enabled = !!enabled
}

export function isEnabled(): boolean {
  return config.enabled
}
