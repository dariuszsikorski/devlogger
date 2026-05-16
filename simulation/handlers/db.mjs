// @purpose Fake DB query - slowest leaf in the chain.
import { createDevLog } from '../../logger/dist/index.mjs'
import { randDelay } from './util.mjs'

const log = createDevLog('db.mjs')

export async function findProduct(id) {
  return log.exec({
    by: 'db.findProduct',
    target: 'pg.SELECT products',
    args: { id },
    fn: async () => {
      await randDelay(200, 600)
      log.info('rows returned', 1)
      return { id, name: 'Widget', price: 19.99 }
    },
  })
}
