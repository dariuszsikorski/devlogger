// @purpose Mute registry - controls which scopes and levels are silenced globally.
import type { LogLevel } from './types'
import { getConfig } from './config'

export function muteScope(scope: string): void {
  if (!scope) return
  getConfig().mutedScopes.add(scope)
}

export function unmuteScope(scope: string): void {
  if (!scope) return
  getConfig().mutedScopes.delete(scope)
}

export function muteLevel(level: LogLevel): void {
  getConfig().mutedLevels.add(level)
}

export function unmuteLevel(level: LogLevel): void {
  getConfig().mutedLevels.delete(level)
}

export function isScopeMuted(scope: string | null | undefined): boolean {
  if (!scope) return false
  return getConfig().mutedScopes.has(scope)
}

export function isLevelMuted(level: LogLevel): boolean {
  return getConfig().mutedLevels.has(level)
}

export function getMutedScopes(): string[] {
  return Array.from(getConfig().mutedScopes)
}

export function getMutedLevels(): LogLevel[] {
  return Array.from(getConfig().mutedLevels)
}

export function clearMutes(): void {
  getConfig().mutedScopes.clear()
  getConfig().mutedLevels.clear()
}
