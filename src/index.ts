// @purpose Public entry point. Re-exports the API and provides the unscoped default singleton.
import { createDevLog, type DevLog } from './devlog'

export type {
  LogLevel,
  LogEntry,
  ExecField,
  ExecCall,
  Config,
  Listener,
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

/** Default unscoped logger. Calling it directly is equivalent to `.log()`. */
const devLog: DevLog = createDevLog(null)
export default devLog
