# devlogger / simulation

Fake call-chain simulator. Verifies devlogger end-to-end:

- Local pub/sub via `subscribe()` (in-process listener counts entries).
- Remote transport via WS to `devlogger-viewer` broker (compares broker `totalRelayed` delta against the local count - they must match).
- Optional headless WS consumer (mimics what the browser viewer does).

## Layout

```
simulation/
├── handlers/
│   ├── apiRoute.mjs        - top-level entry, orchestrates the chain
│   ├── auth.mjs            - token verification
│   ├── cache.mjs           - redis-style get
│   ├── db.mjs              - SELECT (slowest leaf)
│   ├── validator.mjs       - zod-style parse, ~5% soft-failures
│   ├── pricing.mjs         - discount rules
│   ├── inventory.mjs       - external HTTP simulation
│   ├── notifier.mjs        - fan-out push + email in Promise.all
│   ├── audit.mjs           - audit row insert
│   ├── responseBuilder.mjs - JSON shaping
│   └── util.mjs            - sleep + randDelay + maybeFail
├── run.mjs                 - orchestrator + verification
└── headless-consumer.mjs   - subscribes to /stream and writes a JSON report
```

## Run

1. (optional) Start the broker + viewer:
   ```bash
   cd ../viewer
   pnpm start
   ```
   A browser tab opens at `http://127.0.0.1:9777` automatically.

2. Run the simulation from the devlogger root:
   ```bash
   node simulation/run.mjs
   ```

## What it does

- Fires `SIM_REQUESTS` (default 10) fake `GET /api/product/:id` calls, staggered 150 ms apart.
- Each call walks the chain: validate -> auth -> cache -> db -> (pricing || inventory) -> response -> (notifier || audit).
- Every step uses `dlog.exec({ by, target, fn })` so the viewer shows the full call graph.
- All delays are randomized in realistic ranges (1-180 ms per step).
- A local `subscribe()` listener counts every `LogEntry` notified.
- After completion, the script reads broker `/health` to compare totals.

## Pass criteria

- `local subscribe(): PASS` - `notify()` fired at least once.
- `broker relay parity: PASS` - broker relayed exactly the same number of entries as the local subscriber received. Mismatch means transport lost/duplicated something.

If the broker is unreachable, only the local check is enforced; the broker step is skipped.
