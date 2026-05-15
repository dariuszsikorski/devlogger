// @purpose Fake pricing engine - applies discount.
import { createDevLog } from '../../logger/dist/index.mjs'
import { randDelay } from './util.mjs'

const log = createDevLog('pricing')

export async function applyDiscount(product, userRole) {
  return log.exec({
    by: 'pricing.applyDiscount',
    target: 'rulesEngine.run',
    args: { sku: product.id, role: userRole },
    fn: async () => {
      await randDelay(40, 120)
      const discount = userRole === 'admin' ? 0.2 : 0.05
      const finalPrice = product.price * (1 - discount)
      log.info('discount applied', { discount, finalPrice })
      return { ...product, finalPrice }
    },
  })
}
