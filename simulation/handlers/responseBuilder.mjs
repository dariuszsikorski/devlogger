// @purpose Fake response builder - shapes final JSON.
import { createDevLog } from '../../logger/dist/index.mjs'
import { randDelay } from './util.mjs'

const log = createDevLog('responseBuilder.mjs')

async function shapeJson(product, stock) {
  await randDelay(5, 15)
  log.info('response shaped')
  return { product, stock, ts: Date.now() }
}

export async function build(product, stock) {
  return log.exec({
    by: 'response.build',
    target: 'jsonShape',
    args: { sku: product.id },
    fn: () => shapeJson(product, stock),
  })
}
