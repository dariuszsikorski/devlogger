// @purpose Global configuration singleton. Mutated via updateConfig() / setEnabled().
import type { Config, ExecField, LogLevel } from './types'
import { detectDev } from './env'

const config: Config = {
  enabled: detectDev(),
  throttleMs: 200,
  emoji: false,
  exec: { required: [] },
  mutedScopes: new Set<string>(),
  mutedLevels: new Set<LogLevel>(),
}

export function getConfig(): Config {
  return config
}

export interface UpdateConfigInput {
  enabled?: boolean
  throttleMs?: number
  emoji?: boolean
  exec?: { required?: ExecField[] }
  mutedScopes?: Iterable<string>
  mutedLevels?: Iterable<LogLevel>
}

/** Shallow-merge user config into the global singleton. */
export function configure(input: UpdateConfigInput): void {
  if (typeof input.enabled === 'boolean') config.enabled = input.enabled
  if (typeof input.throttleMs === 'number' && input.throttleMs >= 0) config.throttleMs = input.throttleMs
  if (typeof input.emoji === 'boolean') config.emoji = input.emoji
  if (input.exec && Array.isArray(input.exec.required)) config.exec.required = [...input.exec.required]
  if (input.mutedScopes) config.mutedScopes = new Set(input.mutedScopes)
  if (input.mutedLevels) config.mutedLevels = new Set(input.mutedLevels)
}

export function setEnabled(enabled: boolean): void {
  config.enabled = !!enabled
}

export function isEnabled(): boolean {
  return config.enabled
}
