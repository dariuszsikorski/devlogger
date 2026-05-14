// @purpose CJS smoke test - confirms the dist/index.cjs build loads via require() in plain CommonJS Node.
const devLog = require('./dist/index.cjs').default
const { createDevLog, configure } = require('./dist/index.cjs')

console.log('## CJS smoke test')
console.log('EXPECT: "[CJS] hello" line below')
configure({ throttleMs: 0 })
const log = createDevLog('CJS')
log('hello')

console.log('EXPECT: default singleton callable line "world" with no scope')
devLog('world')

console.log('CJS smoke ok')
