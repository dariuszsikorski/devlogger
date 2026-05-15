// @purpose Public entry point. Re-exports the API and provides the unscoped default singleton.
import { createDevLog, type DevLog } from './devlog'
import { getConfig } from './config'
import { initTransport } from './transport'

export type {
  LogLevel,
  LogEntry,
  ExecField,
  ExecCall,
  Config,
  Listener,
  TransportConfig,
} from './types'

export type { DevLog } from './devlog'
export type { UpdateConfigInput } from './config'

export { createDevLog } from './devlog'
export { configure, setEnabled, isEnabled, getConfig } from './config'
export {
  muteScope,
  unmuteScope,
  muteLevel,
  unmuteLevel,
  isScopeMuted,
  isLevelMuted,
  getMutedScopes,
  getMutedLevels,
  clearMutes,
} from './mute'
export { subscribe, listenerCount, unsubscribeAll } from './subscribe'
export { flushAll, resetThrottle } from './throttle'
export { initTransport, stopTransport, transportStatus } from './transport'

// Auto-start transport if DEVLOGGER_URL was set in the environment at load.
if (getConfig().transport.enabled && getConfig().transport.url) {
  initTransport()
}

/** Default unscoped logger. Calling it directly is equivalent to `.log()`. */
const devLog: DevLog = createDevLog(null)
export default devLog
