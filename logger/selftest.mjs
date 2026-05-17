// @purpose Terminal-readable feature walkthrough. Each section prints what was tested
// and what was expected, then runs the code so an LLM (or human) can scan the
// output and verify behavior without writing assertion-based tests.
import devLog, {
  createDevLog,
  configure,
  setEnabled,
  isEnabled,
  subscribe,
  muteScope,
  unmuteScope,
  muteLevel,
  unmuteLevel,
  clearMutes,
  resetThrottle,
  flushAll,
} from './dist/index.mjs'

const HR = () => console.log('\n' + '-'.repeat(72))
const H  = (s) => { HR(); console.log('## ' + s) }
const E  = (s) => console.log('EXPECT: ' + s)
const wait = (ms) => new Promise(r => setTimeout(r, ms))

// Disable throttling for non-throttle sections so output is immediate and linear.
configure({ throttleMs: 0 })

// ---------------------------------------------------------------------------
H('1. Default singleton - callable, no scope')
E('one line: "hello" (no prefix)')
devLog('hello')
E('one line: 1 2 3 (passed-through varargs)')
devLog('numbers:', 1, 2, 3)

// ---------------------------------------------------------------------------
H('2. Default singleton - five levels')
E('5 lines via console.log/info/warn/error/debug (no prefix, native colors)')
devLog.log('level=log')
devLog.info('level=info')
devLog.warn('level=warn')
devLog.error('level=error')
devLog.debug('level=debug')

// ---------------------------------------------------------------------------
H('3. Scoped logger - createDevLog("Auth")')
const auth = createDevLog('Auth')
E('"[Auth] login attempt" with object { user: "ada" }')
auth('login attempt', { user: 'ada' })
E('"[Auth] level=warn" via auth.warn')
auth.warn('level=warn')
E('scope property is "Auth"')
console.log('scope=', auth.scope)

// ---------------------------------------------------------------------------
H('4. Emoji prefixes - opt-in via configure({emoji:true})')
configure({ emoji: true })
E('lines prefixed with "[log]" / "[info]" / "[warn]" / "[error]" / "[debug]" before [Auth]')
auth.log('with emoji')
auth.info('with emoji')
auth.warn('with emoji')
auth.error('with emoji')
auth.debug('with emoji')
configure({ emoji: false })

// ---------------------------------------------------------------------------
H('4b. showScope toggle - hide scope prefix globally')
E('first line "[Auth] before", second line "after" (no scope prefix), third "[Auth] back" after re-enable')
auth('before')
configure({ showScope: false })
auth('after')
configure({ showScope: true })
auth('back')

// ---------------------------------------------------------------------------
H('5. group / groupEnd')
E('one collapsible group "[Auth]" containing two child lines')
auth.group('session block')
auth('inside group line 1')
auth('inside group line 2')
auth.groupEnd()

// ---------------------------------------------------------------------------
H('6. exec() - progressive output, intelligent fallback for missing pieces')
const main = createDevLog('main.ts')
E('"main called init" (only by + target)')
main.exec({ by: 'main', target: 'init' })

E('"main called init with args: { mode: \'dev\' }"  (by + target + args)')
main.exec({ by: 'main', target: 'init', args: { mode: 'dev' } })

E('"main called init | startup" (by + target + msg, no args)')
main.exec({ by: 'main', target: 'init', msg: 'startup' })

E('"main called init | startup with args: { mode: \'dev\' }"  (everything)')
main.exec({ by: 'main', target: 'init', msg: 'startup', args: { mode: 'dev' } })

E('"init"  (only target, no by - drops the "X called" prefix)')
main.exec({ target: 'init' })

E('"main"  (only by, no target)')
main.exec({ by: 'main' })

E('"<exec>"  (nothing supplied)')
main.exec({})

E('NO "with args:" suffix when args is empty {} or []')
main.exec({ by: 'main', target: 'init', args: {} })
main.exec({ by: 'main', target: 'init', args: [] })

E('args as array works: "main called sum with args: [ 1, 2, 3 ]"')
main.exec({ by: 'main', target: 'sum', args: [1, 2, 3] })

// ---------------------------------------------------------------------------
H('7. exec() - REQUIRED FIELDS enforced')
configure({ exec: { required: ['by', 'target'] } })
E('console.error: "exec() missing required field(s): by, target"')
auth.exec({ msg: 'forgot the required fields' })
E('console.error: "exec() missing required field(s): target"')
auth.exec({ by: 'ada' })
E('valid call passes: "ada called logout"')
auth.exec({ by: 'ada', target: 'logout' })
configure({ exec: { required: [] } })

// ---------------------------------------------------------------------------
H('8. exec() - executes wrapped fn and returns value')
function sum(a, b) {
  return a + b
}
const result = auth.exec({
  by: 'ada',
  target: 'sum',
  args: [2, 3],
  fn: sum,
})
E('"sum" log line above this, then "fn returned: 5"')
console.log('fn returned:', result)

// ---------------------------------------------------------------------------
H('9. exec() - wrapped fn that throws is logged and rethrown')
function boom() {
  throw new Error('explode')
}
let caught = null
try {
  auth.exec({
    by: 'ada',
    target: 'boom',
    fn: boom,
  })
} catch (e) {
  caught = e
}
E('console.error "exec() boom threw: explode" + "caught: explode"')
console.log('caught:', caught && caught.message)

// ---------------------------------------------------------------------------
H('10. Throttling - identical-shape logs merge with (xN) counter')
configure({ throttleMs: 100 })
resetThrottle()
const noisy = createDevLog('Noisy')
E('FIRST line "spam" prints immediately, then after 100ms a summary "spam (x5)"')
for (let i = 0; i < 5; i++) noisy('spam')
await wait(150)

// ---------------------------------------------------------------------------
H('11. Throttling - differing-shape logs stay separate')
resetThrottle()
E('three distinct lines (different first-string arg), no merging')
noisy('apple')
noisy('banana')
noisy('cherry')
await wait(150)

// ---------------------------------------------------------------------------
H('12. Throttling - same shape, different values - merged (intelligent)')
resetThrottle()
E('FIRST "click {id:1}" prints, then after window "click {id:5} (x5)" with latest values')
for (let i = 1; i <= 5; i++) noisy('click', { id: i })
await wait(150)
configure({ throttleMs: 0 })
resetThrottle()

// ---------------------------------------------------------------------------
H('13. Subscribe to log entries')
const entries = []
const unsub = subscribe((entry) => entries.push(entry))
E('subscriber collects 3 entries')
auth('one')
auth.warn('two')
auth.error('three')
unsub()
auth('this should NOT appear in entries (already unsubscribed)')
console.log('collected count =', entries.length, '(want 3)')
console.log('first entry =', JSON.stringify({
  level: entries[0]?.level, scope: entries[0]?.scope, args: entries[0]?.args, count: entries[0]?.count,
}))

// ---------------------------------------------------------------------------
H('14. Mute by scope (global)')
E('only the first "[Auth]" line appears - second is silenced after muteScope')
auth('visible before mute')
muteScope('Auth')
auth('SILENCED - scope muted')
unmuteScope('Auth')
auth('visible after unmute')

// ---------------------------------------------------------------------------
H('15. Mute by level (global)')
E('only debug is silenced; log/info/warn/error still print')
muteLevel('debug')
auth.log('log visible')
auth.info('info visible')
auth.warn('warn visible')
auth.error('error visible')
auth.debug('debug SILENCED')
unmuteLevel('debug')

// ---------------------------------------------------------------------------
H('16. Per-instance mute (devLog.mute / devLog.unmute)')
E('only the first and third lines appear')
auth('visible 1')
auth.mute()
auth('SILENCED - instance muted')
auth.unmute()
auth('visible 3')

// ---------------------------------------------------------------------------
H('17. setEnabled(false) - global kill switch')
setEnabled(false)
E('nothing between this line and "re-enabled" prints (besides this expect)')
auth('SILENCED - setEnabled(false)')
auth.error('SILENCED')
setEnabled(true)
console.log('isEnabled now =', isEnabled())
auth('re-enabled')

// ---------------------------------------------------------------------------
H('17b. Console passthrough - table / time / timeEnd / count / trace / assert')
const cart = createDevLog('Cart')
E('table renders rows for two items')
cart.table([{ sku: 'A', qty: 1 }, { sku: 'B', qty: 3 }])
E('time + timeEnd prints "checkout: <ms>"')
cart.time('checkout')
await wait(20)
cart.timeEnd('checkout')
E('count prints "hits: 1" then "hits: 2"')
cart.count('hits'); cart.count('hits')
cart.countReset('hits')
E('trace prints a stack trace under "Trace: drilldown"')
cart.trace('drilldown')
E('assert(false, ...) prints "Assertion failed: nope"; assert(true, ...) is silent')
cart.assert(false, 'nope')
cart.assert(true, 'should be silent')

E('scope mute hides ALL passthrough output too')
muteScope('Cart')
cart.table([{ shouldNot: 'appear' }])
cart.time('hidden'); cart.timeEnd('hidden')
unmuteScope('Cart')
cart('Cart visible again')

// ---------------------------------------------------------------------------
H('18. Cleanup')
clearMutes()
resetThrottle()
console.log('selftest finished')
