# @dariuszsikorski/devlogger

Structured, scope-aware console logger built for LLM-readable terminal output. Works in Node.js, modern bundlers, and plain browsers from a single import.

## At a glance - how devlogger differs from `console.log`

Same call site, different output. The scope tag (and a per-call counter when bursts collapse) makes terminal output instantly traceable to its source - especially useful for AI agents reading logs to reason about what happened.

```ts
// Same code on both sides:
log('Welcome in App!')
log('user signed in', { id: 42 })
for (let i = 0; i < 5; i++) log('frame tick')
```

```text
console.log                                  devlogger (scope = 'main.ts')
-----------------------------------          -----------------------------------
Welcome in App!                              [main.ts] Welcome in App!
user signed in { id: 42 }                    [main.ts] user signed in { id: 42 }
frame tick                                   [main.ts] frame tick
frame tick                                   [main.ts] frame tick (x5)
frame tick
frame tick
frame tick
```

Scope tags are on by default. Turn them off globally when you don't want them:

```ts
import { configure } from '@dariuszsikorski/devlogger'
configure({ showScope: false })
```

## Why `exec()` exists - tracing call graphs

`exec()` is a deliberately structured second form of logging. Instead of free-form `log(...)`, you describe the call as `{ by, target, args, msg }`:

```ts
log.exec({ by: 'main', target: 'init', args: { mode: 'dev' } })
// -> [main.ts] main called init with args: { mode: 'dev' }
```

The reason it looks "stiff" is intentional. When an AI agent (or a human) writes logs this way, every line carries the same fields: who called what, with what, why. That regularity lets you do things free-form `console.log` cannot:

- **Reconstruct call trees** from raw log streams - `by` is the parent, `target` is the child.
- **Subscribe** to the event stream (`subscribe(...)`) and render it live in vis.js, Cytoscape, D3, or any graph library - each entry already has the edge endpoints.
- **Enforce** the format at file or project level via `configure({ exec: { required: ['by','target'] } })` so contributors (or LLM coders) can't silently drop the tracking fields.
- **Diff and replay** sessions because the schema is stable.

Use plain `log(...)` for ad-hoc messages. Use `log.exec(...)` whenever you want the call to participate in the call graph or be inspectable as structured data.

## Why this exists

`console.log` is fine for humans skimming a stream. It is poor for AI agents that read terminal output trying to reconstruct what happened, and poor for noisy UIs that log the same thing 60 times per second. devlogger keeps the ergonomics of `console` while adding what is missing:

- Scope tags so logs from different parts of the app are distinguishable at a glance.
- Intelligent throttling so identical bursts collapse into one line with an `(xN)` counter, while genuinely different lines stay separate.
- A strict `exec()` form that enforces caller/target tracking when you opt in - useful for tracing call chains across modules.
- Per-scope and per-level muting so you can silence the noise without commenting out code.
- A pub/sub subscriber API so an in-app dev panel can render the same stream the terminal sees.
- Auto dev/prod detection with a manual `setEnabled()` escape hatch.

## Install

```sh
npm install @dariuszsikorski/devlogger
# or pnpm / yarn / bun
```

## Use

### Default singleton (drop-in for `console.log`)

```ts
import devLog from '@dariuszsikorski/devlogger'

devLog('hello')                // calls console.log
devLog.info('user signed in', { id: 42 })
devLog.warn('rate limit close')
devLog.error(new Error('boom'))
devLog.debug('frame', 17)
devLog.group('batch'); devLog.log('a'); devLog.log('b'); devLog.groupEnd()
```

Calling the logger with no method (`devLog(...)`) is equivalent to `devLog.log(...)` - the surface mirrors `console` exactly, so it is safe to swap in.

### Scoped logger

```ts
import { createDevLog } from '@dariuszsikorski/devlogger'

const log = createDevLog('Auth')
log('login attempt', { user: 'ada' })   // -> "[Auth] login attempt { user: 'ada' }"
log.warn('token expiring')
```

### Per-file scope pattern (recommended convention)

Register one scope at the top of every file - that file's name (or the module's role) becomes the tag prepended to every line it emits. The pattern keeps logs traceable to their origin without any caller-detection magic.

```ts
// auth-service.ts
import { createDevLog } from '@dariuszsikorski/devlogger'
const log = createDevLog('AuthService')

export async function login(creds) {
  log('login start', { user: creds.user })
  const ok = await verify(creds)
  if (!ok) { log.warn('login failed'); return null }
  log.info('login ok')
  return ok
}
```

```ts
// cart-store.ts
import { createDevLog } from '@dariuszsikorski/devlogger'
const log = createDevLog('CartStore')

export function addItem(item) {
  log('addItem', { sku: item.sku })
  // ...
}
```

Each file declares its own `log` once and uses it everywhere inside. Because every log line carries the file's scope, you can later silence or solo-focus one file globally:

```ts
import { muteScope } from '@dariuszsikorski/devlogger'
muteScope('CartStore')  // hides every line from cart-store.ts
```

Or via startup config:

```ts
configure({ mutedScopes: ['CartStore', 'Telemetry'] })
```

### exec() - call-chain tracking with optional enforcement

```ts
const log = createDevLog('Cart')

log.exec({ by: 'CheckoutPage', target: 'addItem', args: { sku: 'X' } })
// -> [Cart] CheckoutPage called addItem with args: { sku: 'X' }

// Wrap a real function call - logs it, runs it, returns the result.
const total = log.exec({
  by: 'CheckoutPage',
  target: 'computeTotal',
  args: [items],
  fn: (xs) => xs.reduce((s, x) => s + x.price, 0),
})
// -> [Cart] CheckoutPage called computeTotal with args: [ ... ]
//    (computeTotal is then executed and its return value is returned through)
```

The output format adapts to what you supply - missing pieces are dropped gracefully:

```text
{ by: 'main', target: 'init' }                              -> main called init
{ by: 'main', target: 'init', args: { mode: 'dev' } }       -> main called init with args: { mode: 'dev' }
{ by: 'main', target: 'init', msg: 'startup' }              -> main called init | startup
{ by: 'main', target: 'init', msg: 'x', args: { ... } }     -> main called init | x with args: { ... }
{ target: 'init' }                                          -> init                       (no "X called")
{ by: 'main' }                                              -> main
{}                                                          -> <exec>                     (fallback)
```

Empty args (`{}` or `[]`) suppress the `with args:` suffix - only meaningful payloads are surfaced. The actual `args` object is passed as a separate console argument so DevTools and Node keep it inspectable instead of stringifying it.

You can require fields globally - missing fields produce a `console.error` and the call is skipped (the wrapped fn, if any, still runs so app flow never breaks):

```ts
import { configure } from '@dariuszsikorski/devlogger'

configure({ exec: { required: ['by', 'target'] } })
```

### Throttling

Throttling is on by default with a 200 ms window. Identical-shape calls within the window are folded:

```ts
for (let i = 0; i < 50; i++) log('frame', { n: i })
// terminal:
//   [Cart] frame { n: 0 }
//   [Cart] frame { n: 49 } (x50)
```

"Identical shape" means the same level, same scope, same first-string argument, and the same set of object keys / argument types. Different content prints normally:

```ts
log('apple'); log('banana'); log('cherry')
// three separate lines, no merging
```

Disable or change the window:

```ts
configure({ throttleMs: 0 })   // off
configure({ throttleMs: 500 }) // slower window
```

### Muting

```ts
import { muteScope, unmuteScope, muteLevel } from '@dariuszsikorski/devlogger'

muteScope('Noisy')        // hide every log from createDevLog('Noisy')
muteLevel('debug')        // hide all .debug() across scopes

log.mute(); log.unmute()  // per-instance toggle
```

Configure mutes at startup:

```ts
configure({
  mutedScopes: ['Noisy', 'Pings'],
  mutedLevels: ['debug'],
})
```

### Subscribers

Stream every entry to a custom sink - dev panel, file writer, remote log shipper:

```ts
import { subscribe } from '@dariuszsikorski/devlogger'

const off = subscribe((entry) => {
  // entry: { level, scope, args, timestamp, count }
  panel.append(entry)
})

// later
off()
```

### Manual on/off

```ts
import { setEnabled, isEnabled } from '@dariuszsikorski/devlogger'

setEnabled(false)         // hard kill - nothing emits
setEnabled(true)
```

By default, devlogger is enabled. It tries to detect `import.meta.env.DEV` (Vite, modern bundlers) and `process.env.NODE_ENV === 'production'` (Node, Next.js), and disables itself in production builds. When detection cannot decide, it stays on - logs are visible until you explicitly say otherwise.

### Browser via CDN

For pages without a bundler:

```html
<script src="https://unpkg.com/@dariuszsikorski/devlogger"></script>
<script>
  const { default: devLog, createDevLog } = DevLogger
  devLog('hello from a plain script tag')
  const log = createDevLog('Page')
  log.info('ready')
</script>
```

The IIFE bundle exposes a global named `DevLogger` containing the full module.

## API reference

| Export | What it does |
|---|---|
| `devLog` (default) | Unscoped singleton. Callable + `.log` `.info` `.warn` `.error` `.debug` `.group` `.groupEnd` `.exec` `.mute` `.unmute` |
| `createDevLog(scope?)` | Build a scoped logger with the same surface |
| `configure(input)` | Update global config: `enabled`, `throttleMs`, `emoji`, `showScope`, `exec.required`, `mutedScopes`, `mutedLevels` |
| `setEnabled(bool)` | Toggle the global kill switch |
| `isEnabled()` | Current enabled state |
| `getConfig()` | Read-only view of the active config object |
| `subscribe(handler)` | Attach a listener; returns an unsubscribe fn |
| `unsubscribeAll()` | Drop every listener |
| `muteScope(name)` / `unmuteScope(name)` | Per-scope mute |
| `muteLevel(level)` / `unmuteLevel(level)` | Per-level mute |
| `getMutedScopes()` / `getMutedLevels()` | Current mute lists |
| `clearMutes()` | Wipe all mutes |
| `flushAll(emit?)` | Force-emit any pending throttled summaries |
| `resetThrottle()` | Drop throttle state without emitting (for tests) |

## Self-test

Every feature has a section in [selftest.mjs](./selftest.mjs). Run it after building:

```sh
pnpm build
pnpm selftest
```

Each section prints `EXPECT:` followed by the actual output, so an LLM (or you) can scan the terminal and confirm behavior without writing assertion-based tests. There is also a CJS smoke (`node selftest.cjs`).

## Build

```sh
pnpm install
pnpm build
```

Outputs:

- `dist/index.mjs` - ESM, for modern bundlers and Node ESM
- `dist/index.cjs` - CommonJS, for older Node and tooling
- `dist/index.global.js` - IIFE with global name `DevLogger`, for `<script>` tags
- `dist/index.d.ts` (+ `.d.cts`) - TypeScript types

## Project layout

```
src/
  index.ts        public exports + default singleton
  devlog.ts       createDevLog factory
  types.ts        shared type definitions
  env.ts          dev/prod auto-detection
  config.ts       global config singleton
  format.ts       prefix builder + structural arg hash
  throttle.ts     intelligent batch with (xN) summary
  mute.ts         scope and level mute registry
  subscribe.ts    pub/sub
  exec.ts         exec() with required-field enforcement
```

Files are kept small and single-purpose to make future tests and contributions straightforward.

## Author and license

Dariusz Sikorski - https://www.dariuszsikorski.pl

Released under the MIT License - see [LICENSE](./LICENSE).
