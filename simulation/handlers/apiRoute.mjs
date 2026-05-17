// @purpose Fake top-level API route - orchestrates the whole chain.
// Each cross-module call is wrapped in its own log.exec so the viewer can draw
// explicit edges from apiRoute.handleGetProduct into the function in the target module.
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

const log = createDevLog('apiRoute.mjs')

const CALLER = 'apiRoute.handleGetProduct'

export async function handleGetProduct(req) {
  const callValidate = () => validatePayload(req.params)
  const callVerifyToken = () => verifyToken(req.headers.authorization)
  const callCacheGet = () => cacheGet(`product:${req.params.id}`)
  const callFindProduct = () => findProduct(req.params.id)

  async function runHandler() {
    await log.exec({ by: CALLER, target: 'validator.validatePayload', args: { keys: Object.keys(req.params) }, fn: callValidate })
    const user = await log.exec({ by: CALLER, target: 'auth.verifyToken', args: { tokenHead: req.headers.authorization?.slice(0, 6) }, fn: callVerifyToken })

    const cached = await log.exec({ by: CALLER, target: 'cache.get', args: { key: `product:${req.params.id}` }, fn: callCacheGet })
    const product = cached ?? await log.exec({ by: CALLER, target: 'db.findProduct', args: { id: req.params.id }, fn: callFindProduct })

    const callApplyDiscount = () => applyDiscount(product, user.role)
    const callCheckStock = () => checkStock(req.params.id)

    const [priced, stock] = await Promise.all([
      log.exec({ by: CALLER, target: 'pricing.applyDiscount', args: { sku: product.id, role: user.role }, fn: callApplyDiscount }),
      log.exec({ by: CALLER, target: 'inventory.checkStock', args: { productId: req.params.id }, fn: callCheckStock }),
    ])

    const callBuildResponse = () => buildResponse(priced, stock)
    const response = await log.exec({ by: CALLER, target: 'response.build', args: { sku: product.id }, fn: callBuildResponse })

    const callNotify = () => notifyDispatch(user.uid)
    const callAudit = () => auditRecord('product.viewed', { uid: user.uid })

    await Promise.all([
      log.exec({ by: CALLER, target: 'notifier.dispatch', args: { uid: user.uid }, fn: callNotify }),
      log.exec({ by: CALLER, target: 'audit.record',     args: { uid: user.uid }, fn: callAudit }),
    ])

    log.info('request complete', { sku: req.params.id })
    return response
  }

  return log.exec({
    by: 'GET /api/product/:id',
    target: CALLER,
    args: { id: req.params.id },
    fn: runHandler,
  })
}
