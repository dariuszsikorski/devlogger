// @purpose Fake validator - quick schema check.
import { createDevLog } from '../../logger/dist/index.mjs'
import { randDelay, maybeFail } from './util.mjs'

const log = createDevLog('validator.mjs')

async function zodParse() {
  await randDelay(5, 20)
  try {
    maybeFail(0.05, 'validator')
    return { ok: true }
  } catch (err) {
    log.warn('validation soft-failed', err.message)
    return { ok: false, error: err.message }
  }
}

export async function validatePayload(payload) {
  return log.exec({
    by: 'validator.validatePayload',
    target: 'zod.parse',
    args: { keys: Object.keys(payload) },
    fn: zodParse,
  })
}
