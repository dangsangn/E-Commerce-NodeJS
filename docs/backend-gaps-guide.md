# Backend Gaps — Diagnosis & Fix Guide

> **Audience:** A backend engineer who will fix two defects blocking the seller-dashboard frontend.
> **Scope:** This document *teaches* the two bugs — root cause, mechanism, and the exact fix — so you fix them correctly and never reintroduce the class of error. It does **not** apply the fixes; the frontend (M1–M4) is built to tolerate both until the backend lands.
> **Stack:** Express **5.2.1**, TypeScript, MongoDB/Mongoose, `class-validator`, custom envelope responses.
>
> **The two gaps:**
> 1. `PATCH /user/me/avatar` **hangs** — the controller builds a response object but never sends it. Blocks M2 avatar upload.
> 2. `/discount` is missing **update / delete / query** routes — the service and DTOs exist but nothing is wired. Blocks M4 discount management.

---

# Part 0 — How to read this guide

Each gap is a full mentoring walkthrough:

- **What & why** — the symptom and the underlying engineering concept.
- **Mechanism** — what actually happens at runtime (the interesting part).
- **The fix** — exact file, exact code, with the *reasoning*.
- **Traps** — what looks like a fix but isn't, and the Express-5-specific landmine.

You'll get more out of this if you read the *mechanism* sections even where the fix looks like a one-liner. The avatar bug in particular is a one-line fix hiding a concept every backend engineer must own: **the HTTP response lifecycle and what "a hanging request" really is.**

---

# Part 1 — The avatar endpoint hangs (`PATCH /user/me/avatar`)

## 1.1 Overview

**What:** A client uploads an avatar. The image is validated, pushed to Cloudinary, the user document is updated, the old image is destroyed — everything the feature promises actually happens. And then the HTTP request **never completes**. The browser (or `fetch`) sits waiting until *it* gives up (client timeout), even though the server did all the work.

**Why it exists:** A single missing method call. The controller constructs a response object and returns it to the framework instead of *sending* it over the socket.

**The problem it causes:** From the outside it looks like the server is broken or slow. From the database's side, the write already happened. This split — "work done, response never sent" — is one of the most confusing failure modes for a frontend engineer, because retrying re-does the work (re-uploads, re-destroys) while still never returning.

**Where:** [`src/features/user/controllers/index.ts`](../src/features/user/controllers/index.ts), method `updateAvatar`.

## 1.2 Mental model

Think of an HTTP handler as a **letter you must physically mail**.

- `new OkResponse({ ... })` — you *wrote* the letter and sealed the envelope.
- `.send(res)` — you *dropped it in the mailbox*.

`updateAvatar` writes and seals a beautiful letter... and leaves it on the desk. The recipient (the browser) is standing at their mailbox forever. Nothing was mailed.

In Express terms: **an HTTP response is only "finished" when something writes to the socket and ends it** (`res.json()`, `res.send()`, `res.end()`). Returning a value from an Express handler does *nothing* — Express ignores handler return values entirely. The response is a side effect on the `res` object, never a return value.

## 1.3 First principles — why "returning" isn't "responding"

Express predates `async/await` and promises. Its core contract is:

> A middleware/handler receives `(req, res, next)` and is responsible for **either** ending the response (`res.*`) **or** calling `next()`. Its return value is discarded.

This is deliberate. A single request can pass through many handlers (middleware chain). If Express treated "the first returned value" as the response, composition would break. So the framework watches the **`res` object**, not the call stack.

Concretely, the response is considered complete when the underlying Node `http.ServerResponse` stream is ended. `res.json(body)` does three things:

1. Sets `Content-Type: application/json` (if not already set).
2. Serializes `body` with `JSON.stringify`.
3. Calls `res.end(payload)` — which flushes headers + body to the TCP socket and marks the response finished.

If none of that happens, the socket stays open. Node keeps the connection alive (HTTP keep-alive), the event loop moves on, and the request is simply... pending. Forever. There is no error, no log, no crash — which is exactly why this bug is easy to ship and hard to notice in code review.

## 1.4 Internal implementation — the exact code path

Here is the current method (abridged to the relevant lines):

```ts
// src/features/user/controllers/index.ts
static updateAvatar = async (req: Request, res: Response) => {
  const userId = req.user?.userId
  if (!req.file) throw new BadRequestError('Missing file upload')
  const result = await UserService.updateAvatar({ userId, file: req.file })
  return new OkResponse({          // ← builds the response object
    message: 'Upload file success',
    data: result,
  })                                // ← ...and returns it. No .send(res). Nothing is written.
}
```

Compare with its sibling `upgradeToShop` **in the same file**, which is correct:

```ts
return new OkResponse({
  message: 'Upgraded to shop',
  data: { roles, tokens },
}).send(res)                        // ← the response is actually mailed
```

The bug is purely the absence of `.send(res)`.

Trace of what happens at runtime, step by step:

```
Client ── PATCH /user/me/avatar (multipart) ──► Express
  │
  ├─ multer parses the file            → req.file populated
  ├─ authentication middleware         → req.user populated
  ├─ updateAvatar():
  │    ├─ validateImageBuffer(...)      ✓
  │    ├─ Cloudinary upload             ✓ (network write happened)
  │    ├─ user.save()                   ✓ (DB write COMMITTED)
  │    ├─ destroy(oldPublicId)          ✓ (old image deleted)
  │    └─ return new OkResponse({...})  ← object created, RETURNED to asyncHandler
  │
  ├─ asyncHandler awaits the promise, gets the OkResponse instance, discards it
  │  (asyncHandler only cares about *rejections*, not resolved values)
  │
  └─ res is never ended → socket stays open → CLIENT WAITS until its own timeout
```

The critical insight: **the side effects (upload, DB write, delete) all succeeded and are irreversible.** Only the acknowledgement is missing.

## 1.5 The `OkResponse` contract (why two call styles exist)

From [`src/core/success.response.ts`](../src/core/success.response.ts):

```ts
class SuccessResponse<T> {
  send(res: Response) {                       // instance method — mails the letter
    return res.status(this.statusCode).json(this)
  }
}
class OkResponse<T> extends SuccessResponse<T> {
  static send<T>(res, { message, data }) {    // static helper — build + mail in one call
    return new OkResponse({ message, data }).send(res)
  }
}
```

So the codebase has **two idioms**, both valid:

| Idiom | Example | Used by |
|---|---|---|
| Instance | `new OkResponse({ message, data }).send(res)` | `upgradeToShop` |
| Static | `OkResponse.send(res, { message, data })` | `ProductController`, `DiscountController` |

`updateAvatar` used *neither* completely — it built the instance but forgot to send. Either idiom fixes it.

## 1.6 The fix

**File:** `src/features/user/controllers/index.ts`

```ts
static updateAvatar = async (req: Request, res: Response) => {
  const userId = req.user?.userId
  if (!req.file) throw new BadRequestError('Missing file upload')
  const result = await UserService.updateAvatar({ userId, file: req.file })
  return new OkResponse({
    message: 'Upload file success',
    data: result,
  }).send(res)                       // ← ADD THIS. That is the entire fix.
}
```

Equivalent, if you prefer the style the product/discount controllers use:

```ts
  return OkResponse.send(res, {
    message: 'Upload file success',
    data: result,
  })
```

Nothing else changes. The service layer is already correct.

## 1.7 Common mistakes (how this class of bug is born — and mis-fixed)

- **"I'll just add `res.json(result)` at the top."** Now you send *twice* — once with your ad-hoc line, once if someone later adds `.send()`. The second write throws `ERR_HTTP_HEADERS_SENT`. Fix it in exactly one place, using the project's envelope helper, so the response shape stays consistent (`{ message, statusCode, data }`) — the frontend's `apiFetch` unwraps `data` and depends on that shape.
- **"Returning the object should be enough — other functions return things."** Express discards handler return values. Returning is for *your* control flow, never for responding.
- **Confusing it with a slow endpoint.** A slow endpoint eventually responds; a hung one never does. If a request pends until the *client's* timeout with no server error logged, suspect a missing `res.*`, not performance.
- **Trusting the happy path in review.** The upload works, the DB row changes — a reviewer eyeballing the logic sees "correct." Only exercising the endpoint end-to-end (and watching it never return) reveals it. This is why an integration smoke test that asserts on the HTTP status catches it and a unit test of the service does not.

## 1.8 How to verify the fix

```bash
# With the server running and a valid session (x-api-key + x-client-id + authorization):
curl -i -X PATCH http://localhost:5000/api/v1/user/me/avatar \
  -H "x-api-key: <key>" -H "x-client-id: <userId>" -H "authorization: <accessToken>" \
  -F "avatar=@./some-image.jpg"
```

Before the fix: `curl` hangs until *its* timeout, no status line.
After the fix: an immediate `HTTP/1.1 200 OK` with `{"message":"Upload file success","statusCode":200,"data":{"avatar":"https://..."}}`.

## 1.9 Senior notes

- **Add a "response not sent" guardrail.** In a mature service, a tail middleware or an `res.on('finish')` check can log handlers that returned without ending the response. Even simpler: a lint rule / code-review checklist item — "every controller path ends in `.send(res)` or throws." The framework won't catch this for you; Express's flexibility is precisely what lets the bug exist.
- **Irreversible side effects before the response** are the real hazard here. Because the Cloudinary upload and the old-image `destroy` already ran, a client that retries on timeout causes duplicate uploads and a redundant destroy. If you ever make this endpoint idempotent-sensitive, order matters: do reversible work first, side-effectful work last, respond immediately after.
- **`asyncHandler` only rescues throws, not silence.** It wraps the handler so a rejected promise reaches the error middleware. A handler that *resolves* without sending slips right through — there is nothing to catch.

---

# Part 2 — Discount is missing update / delete / query routes

## 2.1 Overview

**What:** `DiscountService` fully implements `updateDiscount`, `deleteDiscount` (soft delete), and `queryDiscounts` (paginated). The DTOs `UpdateDiscountDTO` and `QueryDiscountDTO` exist and are complete. But the **router** wires only three endpoints: create, get-by-code, get-by-shop. The other three capabilities are dead code — reachable by no HTTP request.

**Why it exists:** Incomplete wiring. In a layered architecture (route → controller → service → repository), someone finished the lower layers and stopped before the top. The business logic is done; the *exposure* is missing.

**The problem it causes:** The frontend (M4) can create and view discounts but cannot edit or delete them, and has no admin-style query. M4 deliberately ships without those buttons because the routes 404.

**Where:** [`src/features/discount/routes/index.ts`](../src/features/discount/routes/index.ts) (missing routes) and [`src/features/discount/controller/discount.controller.ts`](../src/features/discount/controller/discount.controller.ts) (missing controller methods). The service — [`src/features/discount/services/discount.service.ts`](../src/features/discount/services/discount.service.ts) — is already done.

## 2.2 Mental model — the four layers, and where the wire is cut

```
HTTP request
   │
   ▼
[ routes/index.ts ]   ── maps a URL+verb to a controller method   ◄── MISSING for update/delete/query
   │
   ▼
[ controller ]        ── reads req, calls the service, sends the envelope  ◄── MISSING methods
   │
   ▼
[ service ]           ── business rules (ownership, validation, dates)     ✓ DONE
   │
   ▼
[ repository ]        ── Mongo queries                                      ✓ DONE
```

The lower two floors of the building are furnished; there's no staircase to reach them. You're adding the staircase (routes) and the doorway (controller methods).

## 2.3 What already exists (so you don't rewrite it)

`DiscountService` (verified) exposes:

```ts
updateDiscount(discountId: string, shopId: string, updateDto: UpdateDiscountDTO)
  // - throws BadRequestError('Discount not found.') if missing
  // - throws BadRequestError('You are not authorized to update this discount.')
  //   if discount_shop_id !== shopId  (ownership enforced HERE)
  // - re-validates value range and date window
  // - returns the transformed discount

deleteDiscount(discountId: string, shopId: string)
  // - ownership-checked, then soft delete (repository.softDelete)
  // - returns void

queryDiscounts(query: QueryDiscountDTO)
  // - paginated: returns { data, pagination-ish fields } via repository.findWithPagination
```

Ownership is enforced in the **service**, keyed on `shopId` — which means the controller must pass `req.user.userId`. Do **not** trust a `shopId` from the request body/query for mutations.

## 2.4 The fix — controller methods

**File:** `src/features/discount/controller/discount.controller.ts` — add three methods to the class (mirroring the existing `createDiscount` style, using `OkResponse.send`):

```ts
updateDiscount = async (req: Request, res: Response) => {
  const { id } = req.params
  const shopId = req.user?.userId              // ownership source of truth
  const data = await this.discountService.updateDiscount(id as string, shopId as string, req.body)
  return OkResponse.send(res, { data })
}

deleteDiscount = async (req: Request, res: Response) => {
  const { id } = req.params
  const shopId = req.user?.userId
  await this.discountService.deleteDiscount(id as string, shopId as string)
  return OkResponse.send(res, { data: { deleted: true } })
}

queryDiscounts = async (req: Request, res: Response) => {
  // NOTE: read from req.query directly — see the Express 5 trap in §2.6.
  const data = await this.discountService.queryDiscounts(req.query as unknown as QueryDiscountDTO)
  return OkResponse.send(res, { data })
}
```

Add the import for the type used above:

```ts
import { QueryDiscountDTO } from '../dtos'
```

`deleteDiscount` returns `{ deleted: true }` rather than nothing, so the frontend gets a definite success payload to unwrap (the envelope always carries a `data`).

## 2.5 The fix — routes

**File:** `src/features/discount/routes/index.ts`. The current file:

```ts
router.get('/code/:code', asyncHandler(discountController.getDiscountByCode))     // public
router.get('/shop/:shopId', asyncHandler(discountController.getDiscountsByShop))  // public

router.use(authentication)                                                        // ↓ everything below needs a session

router.post('/', validationMiddleware(CreateDiscountDTO, 'body'),
  asyncHandler(discountController.createDiscount))
```

Add the three routes **below** `router.use(authentication)` — update and delete require a shop identity, and query is a management operation:

```ts
router.patch(
  '/:id',
  validationMiddleware(UpdateDiscountDTO, 'body'),
  asyncHandler(discountController.updateDiscount),
)
router.delete('/:id', asyncHandler(discountController.deleteDiscount))
router.get('/', asyncHandler(discountController.queryDiscounts))  // see §2.6 — do NOT use validationMiddleware(..., 'query') here
```

Add the DTO import:

```ts
import { CreateDiscountDTO, UpdateDiscountDTO } from '../dtos'
```

### Route-ordering caveat (real, subtle)

`GET /` is added under the authenticated block, so **querying discounts requires a session**, while `GET /shop/:shopId` and `GET /code/:code` stay public. That's an intentional access-control decision — if the product needs public discount querying, move it above `router.use(authentication)`. Also note Express matches routes top-to-bottom: `/code/:code` and `/shop/:shopId` are declared before `/:id`-style routes on other verbs, so there is no collision (they're different verbs/paths), but keep new specific paths above generic `/:id` if you ever add more `GET` routes.

## 2.6 The Express 5 trap — do NOT validate `query` with the current middleware

This is the single most important thing in Part 2.

The shared `validationMiddleware` ([`src/middlewares/validation.middleware.ts`](../src/middlewares/validation.middleware.ts)) ends with:

```ts
req[value] = object   // reassigns req.body / req.query / req.params with the validated instance
```

Reassigning `req.body` is fine. **Reassigning `req.query` is not — in Express 5.** In Express 5, `req.query` was changed from a plain writable property to a **lazy getter with no setter** (it's computed from the URL on access). Assigning to it throws at runtime:

```
TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
```

So if you naively wire the query route the same way the create route is wired —

```ts
// ❌ WILL THROW at request time in Express 5:
router.get('/', validationMiddleware(QueryDiscountDTO, 'query'),
  asyncHandler(discountController.queryDiscounts))
```

— the endpoint 500s on every call. The bug won't show at boot; it fires on the first request, which is exactly the kind of thing that passes a shallow "does it start?" check and fails in QA.

**Three correct options** (pick one):

1. **Simplest — skip middleware for query, coerce in the service/controller.** Read `req.query` directly (as in §2.4). `QueryDiscountDTO` already declares `@Transform` coercions and defaults (`page`, `limit`, `sort`); you can `plainToInstance(QueryDiscountDTO, req.query)` *inside* the controller without ever writing back to `req.query`:

   ```ts
   import { plainToInstance } from 'class-transformer'
   queryDiscounts = async (req, res) => {
     const dto = plainToInstance(QueryDiscountDTO, req.query)
     const data = await this.discountService.queryDiscounts(dto)
     return OkResponse.send(res, { data })
   }
   ```

2. **Make a query-safe middleware variant** that validates but does not reassign `req.query` — instead attach to a namespaced field (`res.locals.query = object`) the controller reads. This keeps validation centralized without touching the read-only getter.

3. **Validate in place without mutation** — call `validate(plainToInstance(...))` and `next()` without the `req[value] = object` line for the `'query'` case.

Option 1 is the least code and matches how a controller "owns" its query parsing. Whatever you choose, **never reassign `req.query` under Express 5.**

> **Bonus:** this same landmine affects any *future* route that wants `validationMiddleware(SomeDTO, 'query')`. Consider fixing the shared middleware to branch: for `'query'`, attach to `res.locals` instead of reassigning. That turns a repeated footgun into a one-time fix.

## 2.7 Common mistakes

- **Trusting `shopId` from the request for mutations.** Ownership must come from `req.user.userId` (the authenticated identity), never from a body/query field a caller can spoof. The service already checks ownership — but only against whatever `shopId` you pass it. Pass the token's userId.
- **Using `validationMiddleware(..., 'query')`** — the Express 5 trap above. This is the mistake most likely to be made, because copying the create route is the obvious move.
- **Putting query/update/delete above `authentication`.** They'd become public; delete-by-id with no session is a data-loss hole. Keep them under `router.use(authentication)`.
- **Returning `void` from delete.** The envelope expects a `data`. Return an explicit `{ deleted: true }` so the frontend has an unambiguous success signal.
- **Forgetting soft-delete semantics.** `deleteDiscount` calls `repository.softDelete` — the row still exists (flagged), so `findByCode`/queries must exclude soft-deleted rows. Verify the repository's read queries filter out deleted discounts, or "deleted" discounts will still resolve by code.

## 2.8 How to verify

```bash
# Update (auth required):
curl -i -X PATCH http://localhost:5000/api/v1/discount/<id> \
  -H "x-api-key: <key>" -H "x-client-id: <userId>" -H "authorization: <token>" \
  -H "content-type: application/json" \
  -d '{"discount_value": 15}'
# → 200 with the updated discount; 400 "not authorized" if <id> belongs to another shop.

# Delete (auth):
curl -i -X DELETE http://localhost:5000/api/v1/discount/<id> \
  -H "x-api-key: <key>" -H "x-client-id: <userId>" -H "authorization: <token>"
# → 200 {"...","data":{"deleted":true}}

# Query (auth):
curl -i "http://localhost:5000/api/v1/discount/?page=1&limit=10&discount_type=percentage" \
  -H "x-api-key: <key>" -H "x-client-id: <userId>" -H "authorization: <token>"
# → 200 with paginated data — and crucially, NO 500 (proves you avoided the req.query trap).
```

## 2.9 Senior notes

- **RBAC still applies.** Other resources (e.g. `product`) gate writes with `protect('product')` grants loaded from the DB. Discounts currently guard only with `authentication` + in-service ownership. Decide deliberately whether discount mutations should also pass an `accesscontrol` grant (`protect('discount')`). If the `shop` role's discount grants aren't seeded, adding `protect` will 403 every call — the same seeding dependency the product feature has. Consistency vs. friction is a real trade-off here; document whichever you choose.
- **Dead code is a smell with a cost.** `updateDiscount`/`deleteDiscount`/`queryDiscounts` sitting unused in the service is why this gap was invisible — TypeScript is happy, tests (if any) pass, nothing complains. A "no unreferenced exported service method" audit, or wiring routes in the same PR as the service method, prevents the whole class.
- **Idempotency of delete.** Soft-delete twice should be a no-op, not an error. Confirm `deleteDiscount` on an already-deleted id behaves sanely (returns success or a clear message), because the frontend may retry.

---

# Part 3 — Order detail & cancel read the wrong route param

## 3.1 Overview

**What:** `GET /order/:id` (order detail) and `PATCH /order/:id/cancel` (cancel) always fail with `'Order not found'`, even for a real order the caller owns. The order *list* (`GET /order`) works fine.

**Why:** The route declares the URL parameter as `:id`, but the controller reads `req.params.orderId`. Express only populates the param under the name in the route pattern, so `req.params.orderId` is `undefined` → `findById(undefined)` → `null` → `NotFoundError('Order not found')`.

**Where:** [`src/features/order/routes/index.ts`](../src/features/order/routes/index.ts) vs [`src/features/order/controller/index.ts`](../src/features/order/controller/index.ts).

**Impact:** Storefront U3 — the customer cannot view a single order via its own endpoint, and the "Cancel order" button errors. U3 works around detail by rendering everything from the working list; cancel is wired to the real route and degrades to an error toast until this is fixed.

## 3.2 Mental model

A route parameter is a **named slot**. `router.get('/:id', ...)` creates a slot called `id`. The controller asks for a slot called `orderId` — a slot that was never created — and gets `undefined`. The names on both sides must be the **same string**; Express does not match by position.

## 3.3 The mismatch, exactly

Routes ([routes/index.ts](../src/features/order/routes/index.ts)):
```ts
router.patch('/:id/cancel', asyncHandler(OrderController.cancelOrder))
router.get('/:id', asyncHandler(OrderController.getOrderDetail))
```
Controller ([controller/index.ts](../src/features/order/controller/index.ts)):
```ts
getOrderDetail = async (req, res) => {
  const data = await OrderService.getOrderDetail({
    orderId: req.params.orderId as string,   // ← undefined: the route slot is `id`
    userId: req.user?.userId,
  })
  ...
}
cancelOrder = async (req, res) => {
  const data = await OrderService.cancelOrder({
    orderId: req.params.orderId as string,   // ← undefined
    userId: req.user?.userId,
  })
  ...
}
```

The `as string` cast is what let this compile — it asserts a value TypeScript couldn't verify, hiding the `undefined`. A lesson: casts on `req.params.*` silence exactly the check that would have caught this.

## 3.4 The fix

Pick **one** side and make the names match. Simplest — read the param the route actually defines:

```ts
// controller/index.ts — read `id`, matching the route pattern
getOrderDetail = async (req, res) => {
  const data = await OrderService.getOrderDetail({
    orderId: req.params.id as string,
    userId: req.user?.userId,
  })
  return OkResponse.send(res, { data })
}
cancelOrder = async (req, res) => {
  const data = await OrderService.cancelOrder({
    orderId: req.params.id as string,
    userId: req.user?.userId,
  })
  return OkResponse.send(res, { data })
}
```

Equivalent alternative — rename the route slots to `:orderId` (keep the controller as-is):
```ts
router.patch('/:orderId/cancel', asyncHandler(OrderController.cancelOrder))
router.get('/:orderId', asyncHandler(OrderController.getOrderDetail))
```
Either works; do not do both half-way. The service and repository are already correct.

## 3.5 Also: `GET /order` ignores pagination

[`controller/index.ts`](../src/features/order/controller/index.ts) `getOrdersByUser` passes only `{ userId }` to the service, dropping `req.query.page`/`limit`, so the list is always page 1 (default limit). The service + repository accept `page`/`limit`. Thread them through if you want real pagination:
```ts
getOrdersByUser = async (req, res) => {
  const data = await OrderService.getOrdersByUser({
    userId: req.user?.userId,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
  })
  return OkResponse.send(res, { data })
}
```

## 3.6 Verify

```bash
# Detail (auth) — should return the order, not "Order not found":
curl -i http://localhost:5000/api/v1/order/<orderId> \
  -H "x-api-key: <key>" -H "x-client-id: <userId>" -H "authorization: <token>"

# Cancel a pending order (auth):
curl -i -X PATCH http://localhost:5000/api/v1/order/<orderId>/cancel \
  -H "x-api-key: <key>" -H "x-client-id: <userId>" -H "authorization: <token>"
# → 200 with order_status "cancelled"; 400 if not pending / not yours.
```

## 3.7 Senior notes
- **Prefer a single source of truth for param names.** A shared constant or typed route table avoids the name drift between router and controller. At minimum, avoid `as string` on `req.params.*` — let TS force you to handle the possibly-undefined value, which surfaces this bug at compile time.
- **The list "hid" the detail bug.** Because the list works and returns full order objects, the app *looks* functional; only fetching one order reveals the break. When a detail endpoint mirrors data already in a list, add a smoke test that hits the detail route specifically.

---

# Appendix — Frontend behavior while these are unfixed

The frontend (seller M2/M4, storefront U3) is built to degrade gracefully so you can ship the backend fix independently:

| Gap | Frontend behavior today | After your fix |
|---|---|---|
| Avatar hang | Upload aborts after a 10s client timeout and shows "Avatar upload is temporarily unavailable." | Remove nothing — the action already handles a real 200; it will simply succeed and toast "Avatar updated." |
| Discount update/delete/query | Not surfaced (no edit/delete buttons; M4 is create + view only). | A future frontend milestone can add edit/delete UI against the new routes. |
| Order detail/cancel param mismatch (Part 3) | Storefront U3 renders order history from the working list (no detail page); the "Cancel order" button calls the real route and shows an error toast. | Cancel starts working immediately — the button moves a pending order to "cancelled" with no frontend change. |

No frontend change is *required* when you land these fixes; the avatar path and order-cancel start succeeding automatically. Coordinate a frontend follow-up only if/when discount editing UI is wanted.
