// @purpose Fake notifier - fan-out to push + email (parallel).
import { createDevLog } from '../../logger/dist/index.mjs'
import { randDelay } from './util.mjs'

const log = createDevLog('notifier')

async function sendPush(uid) {
  return log.exec({
    by: 'notifier.dispatch',
    target: 'fcm.send',
    args: { uid },
    fn: async () => { await randDelay(20, 60); return { delivered: true } },
  })
}

async function sendEmail(uid) {
  return log.exec({
    by: 'notifier.dispatch',
    target: 'sendgrid.send',
    args: { uid },
    fn: async () => { await randDelay(30, 90); return { queued: true } },
  })
}

export async function dispatch(uid) {
  return log.exec({
    by: 'notifier.dispatch',
    target: 'fan-out(push,email)',
    args: { uid },
    fn: async () => {
      const [push, email] = await Promise.all([sendPush(uid), sendEmail(uid)])
      return { push, email }
    },
  })
}
