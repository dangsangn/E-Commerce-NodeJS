# Production Logging System — Design Spec

> Status: **Approved** (2026-06-29) — ready for implementation planning.
> Scope: build a production-grade logging system for the Ecommerce-NodeJS API and wire it into the key infrastructure paths, with a documented migration path for the rest. Deliver a senior-mentor-style guide doc alongside it.

---

## 1. Goal & Motivation

The app currently logs via:

- `morgan('dev')` for HTTP lines, and
- **70 scattered `console.*` calls** across features, db init, utils, and tests.

Problems with the current state:

- **No structured output** — logs are free-text, not machine-parseable; cloud log collectors (Loki/ELK/CloudWatch) can't index them.
- **No request correlation** — you cannot trace all log lines belonging to a single request.
- **No persistence/rotation** — nothing is written to disk; restart loses everything when run locally.
- **No level control** — can't turn verbosity up/down per environment.
- **Security leak** — the global error handler returns `err.stack` to the client (information disclosure).

Goal: a single structured logger (Winston) with request correlation, environment-aware formatting, rotating file persistence, secret redaction, and a safe error handler — matching how real production Node services are run.

---

## 2. Decisions (locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Library | **Winston** | De-facto Express logger; flexible transports & formats; well documented. |
| Outputs | **Console + rotating files** | Console for Docker stdout; daily-rotating files for local/history; separate error file. |
| Correlation | **Request ID + AsyncLocalStorage auto-context** | Every log line during a request auto-tagged with `requestId`/`userId`; no manual threading. |
| Scope | **Infra + integrate key paths** | Build full infra; wire app/server/error-handler/db/redis + product feature as example; document migration for the remaining ~65 console calls. |
| Import style | **`@/` path alias** | Configure `tsconfig` `paths` + `tsconfig-paths` runtime loader so `import logger from '@/loggers'` works under ts-node/nodemon. |
| Testing | **Documented manual verification** | Repo has no test runner; no Jest introduced. Verification steps captured in the guide doc. |

---

## 3. Architecture

### 3.1 New file layout

```
src/
├── configs/
│   ├── IConfig.ts              # extend with logging fields
│   ├── index.ts                # read LOG_* env vars
│   └── logger.config.ts        # derived logging config object (level, dir, retention, toFile)
├── loggers/
│   ├── index.ts                # exports the configured singleton logger
│   ├── logger.ts               # winston instance: levels, transports, exception/rejection handlers
│   ├── formats.ts              # dev (colorized) vs prod (JSON) formats + redaction
│   └── context.ts              # AsyncLocalStorage store helpers (run, get, set userId)
├── middlewares/
│   └── logging.middleware.ts   # requestId + context + req start/finish logging (replaces morgan)
└── logs/                        # rotating log files (git-ignored)
```

`src/loggers/` is a new top-level dir, consistent with how the project already separates `core/`, `helpers/`, `middlewares/`.

### 3.2 Request data flow

```
incoming request
  → logging.middleware:
       requestId = req.header('x-request-id') || generated (crypto.randomUUID)
       res.setHeader('x-request-id', requestId)
       context.run({ requestId }, () => next())     # AsyncLocalStorage
       log "request started" (method, url, ip)
  → controller / service code calls logger.info/warn/error
       → format layer pulls requestId (+ userId) from AsyncLocalStorage and stamps each line
  → res 'finish' event:
       log "request finished" (statusCode, durationMs, userId)
  → global error handler (on thrown errors):
       log error + full stack server-side (with requestId)
       respond with safe body (no stack)
```

### 3.3 AsyncLocalStorage context

`context.ts` owns a single `AsyncLocalStorage<LogContext>` where `LogContext = { requestId: string; userId?: string }`.

- `runWithContext(ctx, fn)` — wraps `next()` in the middleware.
- `getContext()` — read current store (returns `undefined` outside a request, e.g. startup logs — handled gracefully).
- `setUserId(id)` — called by the logging middleware after auth populates `req.user` (or by the auth layer), so authenticated requests carry `userId`.

The format layer calls `getContext()` and merges `requestId`/`userId` into every log entry. Logs emitted outside any request (server start, db connect) simply have no `requestId` — that's expected and fine.

---

## 4. Logger API & Levels

### 4.1 Levels (npm standard — Winston default)

| Level | Use for |
|-------|---------|
| `error` | Caught exceptions, failed operations, 5xx |
| `warn` | Recoverable issues, 4xx, deprecations, retries |
| `info` | Business events (order created, user logged in, server started) |
| `http` | Request start/finish (emitted by middleware) |
| `debug` | Verbose diagnostics; on in dev or when `LOG_LEVEL=debug` |

Default level: `debug` in development, `info` in production.

### 4.2 API shape

Message first, structured metadata object second:

```ts
import logger from '@/loggers'

logger.info('Product created', { productId, shopId })
logger.warn('Inventory low', { productId, stock })
logger.error('Failed to publish product', { err, productId })
```

`err` in metadata is serialized to `{ name, message, stack }` by the format layer (Winston's `errors({ stack: true })`), so error objects log their stack server-side.

### 4.3 Formats

- **dev**: colorized, single-line, human-readable.
  `2026-06-29 10:32:01 info  [req:a1b2c3] Product created {"productId":"..."}`
- **prod**: structured JSON, one object per line:
  `{"level":"info","time":"2026-06-29T03:32:01.123Z","msg":"Product created","requestId":"a1b2c3","productId":"..."}`

### 4.4 Secret redaction

Before writing, the format layer deep-scrubs sensitive keys from metadata, replacing values with `[REDACTED]`. Initial denylist (case-insensitive):

`password`, `passwordConfirm`, `token`, `accessToken`, `refreshToken`, `authorization`, `apiKey`, `api-key`, `x-api-key`, `secret`, `clientSecret`, `cloudinaryApiSecret`, `cookie`, `set-cookie`.

The denylist lives in `formats.ts` as an exported constant so it's easy to extend.

---

## 5. Transports, Rotation & Config

### 5.1 Transports

1. **Console** — always on. Pretty (dev) / JSON (prod). Captured by Docker stdout.
2. **Rotating application file** — `${LOG_DIR}/application-%DATE%.log`, all levels.
3. **Rotating error file** — `${LOG_DIR}/error-%DATE%.log`, `error` level only.
4. **exceptionHandlers / rejectionHandlers** — `${LOG_DIR}/exceptions-%DATE%.log` for uncaught exceptions & unhandled rejections, logged before the process exits.

File transports use `winston-daily-rotate-file`: `datePattern: YYYY-MM-DD`, `maxSize: LOG_MAX_SIZE`, `maxFiles: LOG_MAX_FILES`, `zippedArchive: true`. File transports are skipped entirely when `LOG_TO_FILE=false` (so console-only mode works in K8s).

### 5.2 Config (env-driven, extends IConfig)

| Env var | Default (dev / prod) | Meaning |
|---------|----------------------|---------|
| `LOG_LEVEL` | `debug` / `info` | Minimum level emitted |
| `LOG_DIR` | `logs` | Directory for log files |
| `LOG_MAX_FILES` | `14d` | Retention window |
| `LOG_MAX_SIZE` | `20m` | Max size before rotating |
| `LOG_TO_FILE` | `true` | Enable/disable file transports |

`IConfig` gains a `logging` block; `configs/index.ts` reads the env vars; `logger.config.ts` exposes the derived object the logger consumes.

### 5.3 Dependencies & ignores

- Add deps: `winston`, `winston-daily-rotate-file`.
- Add dev dep: `tsconfig-paths` (runtime `@/` alias resolution).
- Remove `morgan` usage from `app.ts` (the dependency can stay in package.json; left as a cleanup note).
- `.gitignore`: add `/logs` and `logs/`.

### 5.4 `@/` path alias

- `tsconfig.json`: add `"baseUrl": "./src"` and `"paths": { "@/*": ["*"] }`.
- Runtime: register `tsconfig-paths` so ts-node/nodemon resolve `@/` — via `nodemon`/`ts-node` `-r tsconfig-paths/register`, applied in the `dev`/`start` scripts (and `migrate` scripts kept working). Exact wiring decided in the implementation plan; the requirement is that `import logger from '@/loggers'` works both at type-check and runtime.

---

## 6. Integration Points (this scope)

1. **`src/app.ts`**
   - Remove `app.use(morgan('dev'))`.
   - Add `app.use(loggingMiddleware)` early (before routes).
   - Rewrite the **global error handler**: log full error + stack server-side with `requestId`; respond with a safe body `{ code, status: 'error', message }` and **no `stack`**. `statusCode >= 500` → `logger.error`; `4xx` → `logger.warn`. (In dev, `stack` MAY be included in the response for convenience, gated on `NODE_ENV`.)
   - Replace the 404 path to flow through the same handler.

2. **`server.ts`** — replace startup/shutdown `console.log`/`console.error` with `logger.info`/`logger.error` (server listening, SIGINT shutdown, startup failure).

3. **DB / Redis / connection helpers** — `src/dbs/init.mongodb.ts`, `src/dbs/init.mongodb.lv0.ts`, `src/utils/redis.util.ts`, `src/helpers/check.connect.ts`: connection success/failure/retry through `logger`.

4. **Product feature (worked example)** — `src/features/product/service/index.ts` and its controller: convert error paths / notable events to `logger.*` as the reference pattern other features copy.

5. **Remaining ~65 `console.*` calls** — left in place; the guide doc gives a copy-paste migration recipe. (Test files under `src/test/**` are explicitly out of scope.)

---

## 7. Error Handling Contract (before / after)

**Before** (`app.ts`):
```ts
return res.status(statusCode).json({
  code: statusCode, message, status: 'error', stack: err.stack,  // ← leaks stack
})
```

**After:**
```ts
// server-side: full detail
logger.error('Unhandled request error', { err, statusCode, path: req.originalUrl })
// client-side: safe
return res.status(statusCode).json({
  code: statusCode,
  status: 'error',
  message: statusCode >= 500 ? 'Internal Server Error' : err.message,
  ...(isDev ? { stack: err.stack } : {}),
})
```

This both fixes the information-disclosure issue and guarantees every error is persisted with its `requestId`.

---

## 8. Testing — Documented Manual Verification

No test framework is introduced. The guide doc includes a verification checklist run against a booted app:

1. **Format** — `npm run dev`, hit `GET /api/v1` → console shows colorized dev line with timestamp + level.
2. **Files** — confirm `logs/application-<date>.log` and `logs/error-<date>.log` are created and appended.
3. **Correlation** — make one request; confirm the "request started", any app logs, and "request finished" lines all share the same `requestId`. Send a custom `X-Request-Id` header → confirm it's honored and echoed back in the response header.
4. **Error path** — trigger a 500 (e.g. force an error) → confirm full stack is in `error-<date>.log` server-side, but the HTTP response body contains **no** `stack` (in prod mode) and `message: 'Internal Server Error'`.
5. **Redaction** — log metadata containing `password`/`token` → confirm value is `[REDACTED]` in output.
6. **Level control** — set `LOG_LEVEL=warn` → confirm `info`/`debug` lines are suppressed.

---

## 9. Documentation Deliverable

`docs/7. logging-system-guide.md`, matching the existing bilingual senior-mentor doc style (What / Why / How / Trade-offs / Performance / Security / Production Experience / Best Practices / Related Concepts). Contents:

- Why structured logging & request correlation matter in production.
- Architecture walkthrough (logger, formats, transports, AsyncLocalStorage context, middleware).
- How to use the logger (levels, API, examples) and the `@/loggers` import.
- Error-handling & redaction rationale (the security fixes).
- Configuration reference (the `LOG_*` env vars).
- **Migration recipe** for converting the remaining `console.*` calls.
- The manual verification checklist from §8.
- Links to related docs (e.g. doc 6 product review).

---

## 10. Out of Scope (YAGNI)

- Shipping logs to external aggregators (Loki/ELK/Datadog) — config is collector-friendly (JSON stdout) but no shipper is wired.
- Migrating `console.*` in `src/test/**` and the remaining non-key features.
- Metrics / tracing (OpenTelemetry) — logging only.
- Removing the `morgan` dependency from `package.json` (usage removed; dep left as a noted cleanup).
- Introducing Jest or any test runner.

---

## 11. Success Criteria

- `import logger from '@/loggers'` works at type-check and runtime (ts-node/nodemon).
- Every HTTP request produces correlated start/finish log lines sharing a `requestId`, echoed in the `X-Request-Id` response header.
- App logs and error logs are written to rotating files and pruned per retention; console output is pretty in dev, JSON in prod.
- The global error handler logs full stacks server-side and never leaks them to clients in prod.
- Secrets in log metadata are redacted.
- `server.ts`, db/redis init, and the product feature use `logger` instead of `console`.
- The guide doc exists and includes the migration recipe + verification checklist.
