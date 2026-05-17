// @purpose Fake cache lookup - hit/miss with delay.
import { createDevLog } from '../../logger/dist/index.mjs'
import { randDelay } from './util.mjs'

const log = createDevLog('cache.mjs')

async function redisGet(key) {
  await randDelay(10, 40)
  const hit = Math.random() > 0.5
  log.debug(hit ? 'cache hit' : 'cache miss', { key })
  return hit ? { cached: true, key } : null
}

export async function get(key) {
  return log.exec({
    by: 'cache.get',
    target: 'redis.GET',
    args: { key },
    fn: () => redisGet(key),
  })
}
