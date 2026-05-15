// @purpose Fake auth check - lookups user, verifies token.
import { createDevLog } from '../../logger/dist/index.mjs'
import { randDelay } from './util.mjs'

const log = createDevLog('auth')

export async function verifyToken(token) {
  return log.exec({
    by: 'auth.verifyToken',
    target: 'auth.lookupUser',
    args: { tokenHead: token.slice(0, 6) },
    fn: async () => {
      await randDelay(15, 40)
      log.info('token valid', { uid: 42 })
      return { uid: 42, role: 'admin' }
    },
  })
}
