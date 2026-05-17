// @purpose Fake notifier - fan-out to push + email (parallel).
import { createDevLog } from '../../logger/dist/index.mjs'
import { randDelay } from './util.mjs'

const log = createDevLog('notifier.mjs')

async function fcmSend() {
  await randDelay(100, 300)
  return { delivered: true }
}

async function sendPush(uid) {
  return log.exec({
    by: 'notifier.dispatch',
    target: 'fcm.send',
    args: { uid },
    fn: fcmSend,
  })
}

async function sendgridSend() {
  await randDelay(200, 500)
  return { queued: true }
}

async function sendEmail(uid) {
  return log.exec({
    by: 'notifier.dispatch',
    target: 'sendgrid.send',
    args: { uid },
    fn: sendgridSend,
  })
}

export async function dispatch(uid) {
  async function fanOut() {
    const [push, email] = await Promise.all([sendPush(uid), sendEmail(uid)])
    return { push, email }
  }

  return log.exec({
    by: 'notifier.dispatch',
    target: 'fan-out(push,email)',
    args: { uid },
    fn: fanOut,
  })
}
