// @purpose Fake inventory check - external HTTP call (simulated).
import { createDevLog } from '../../logger/dist/index.mjs'
import { randDelay } from './util.mjs'

const log = createDevLog('inventory')

export async function checkStock(productId) {
  return log.exec({
    by: 'inventory.checkStock',
    target: 'GET warehouse-api/stock',
    args: { productId },
    fn: async () => {
      await randDelay(60, 180)
      const available = Math.floor(Math.random() * 100)
      log.info('stock fetched', { available })
      if (available < 5) log.warn('low stock', { available })
      return { productId, available }
    },
  })
}
