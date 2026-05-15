// @purpose Fake top-level API route - orchestrates the whole chain.
import { createDevLog } from '../../logger/dist/index.mjs'
import { verifyToken } from './auth.mjs'
import { get as cacheGet } from './cache.mjs'
import { findProduct } from './db.mjs'
import { validatePayload } from './validator.mjs'
import { applyDiscount } from './pricing.mjs'
import { checkStock } from './inventory.mjs'
import { dispatch as notifyDispatch } from './notifier.mjs'
import { record as auditRecord } from './audit.mjs'
import { build as buildResponse } from './responseBuilder.mjs'

const log = createDevLog('api')

export async function handleGetProduct(req) {
  return log.exec({
    by: 'GET /api/product/:id',
    target: 'apiRoute.handleGetProduct',
    args: { id: req.params.id },
    fn: async () => {
      await validatePayload(req.params)
      const user = await verifyToken(req.headers.authorization)

      const cached = await cacheGet(`product:${req.params.id}`)
      const product = cached ?? await findProduct(req.params.id)

      const [priced, stock] = await Promise.all([
        applyDiscount(product, user.role),
        checkStock(req.params.id),
      ])

      const response = await buildResponse(priced, stock)

      await Promise.all([
        notifyDispatch(user.uid),
        auditRecord('product.viewed', { uid: user.uid }),
      ])

      log.info('request complete', { sku: req.params.id })
      return response
    },
  })
}
