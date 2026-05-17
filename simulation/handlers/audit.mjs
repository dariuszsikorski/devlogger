// @purpose Fake audit log - fast write.
import { createDevLog } from '../../logger/dist/index.mjs'
import { randDelay } from './util.mjs'

const log = createDevLog('audit.mjs')

async function insertAuditRow(event) {
  await randDelay(20, 60)
  log.debug('audit row written', { event })
  return { written: true }
}

export async function record(event, payload) {
  return log.exec({
    by: 'audit.record',
    target: 'auditTable.insert',
    args: { event, uid: payload.uid },
    fn: () => insertAuditRow(event),
  })
}
