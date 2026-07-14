# M2 Design — Upgrade to Shop + Avatar + Role-gate

> **Milestone:** M2 of the Frontend Seller Dashboard (see [STATUS](../../frontend-seller-dashboard-STATUS.md)).
> **Branch:** `feature/frontend-seller-dashboard`
> **Date:** 2026-07-14
> **Prereq:** M1 (BFF, session, proxy refresh, OTP auth) — done.

## 1. Goal

Let a logged-in user become a **shop** and manage their **avatar**, and gate the `/seller` area so only shops can use it. This is the second milestone of building a best-practice Next.js frontend over the existing Express backend.

Three concerns:

1. **Role-gate** — `/seller/*` requires the `shop` role; non-shops are sent to `/seller/account` to upgrade.
2. **Upgrade-to-shop** — a Server Action that upgrades the account and **re-writes the session with the new tokens** (they carry the `shop` role).
3. **Avatar** — a Server Action that uploads an avatar (multipart), defensively timed out because the backend endpoint is broken today.

## 2. Architecture

Unchanged from M1: browser ↔ Next.js (BFF) ↔ Express `/api/v1`. Tokens live in httpOnly cookies; the browser never sees `x-api-key` or JWTs. Reads happen in Server Components; writes happen in Server Actions and go through the single `apiFetch()` choke point.

```
Browser ──(cookie httpOnly)──► Next.js server ──(x-api-key + x-client-id + authorization)──► Express /api/v1
   │  /seller/account (Server Component reads roles)                                              │
   └─ Server Actions (upgrade / avatar) ◄──── envelope { message, statusCode, data } ◄────────────┘
                    │
                    └─ upgrade: setSession(newTokens) — MUST overwrite cookies with shop-role tokens
```

## 3. Backend contract (verified in source, not assumed)

Both routes are under `router.use(authentication)` → require `x-client-id` + `authorization` (normal auth, **not** refresh headers).

### `POST /user/me/upgrade-to-shop` — works ✅
- File: [src/features/user/controllers/index.ts:8](../../../src/features/user/controllers/index.ts) → [services/index.ts:22](../../../src/features/user/services/index.ts).
- Body: `{ shopName?: string }`. Optional — backend defaults `shop_name` to the user's name.
- Idempotent: `$addToSet` on roles, `ShopModel` created only if absent.
- Response envelope `data`: `{ roles: string[], tokens: { accessToken, refreshToken } }`.
- **`roles` now includes `shop`; `tokens` are freshly reissued with that role in the JWT payload.**

### `PATCH /user/me/avatar` — BROKEN ⚠️
- File: [src/features/user/controllers/index.ts:26](../../../src/features/user/controllers/index.ts).
- Multipart field name **`avatar`** (`uploadImage.single('avatar')`).
- On success the service returns `{ avatar: url }`, **but the controller builds `OkResponse` and never calls `.send(res)`** (line 33–37) → the HTTP response never completes → the request **hangs until the client times out**, on both success and failure.
- Consequence for M2: the timeout path is the *expected* path today. FE must not wait indefinitely. Documented separately in [STATUS §6](../../frontend-seller-dashboard-STATUS.md) as a backend fix; we do **not** edit backend source.

## 4. Components & files

| File | New/edit | Role |
|---|---|---|
| [proxy.ts](../../../e-commerce-nextjs/proxy.ts) | edit | Add shop-role gate after refresh block |
| `lib/auth/gate.ts` | new | Pure `shouldGateShop(pathname, roles)` — edge-safe, unit-tested |
| `lib/validations/user.ts` | new | Zod `upgradeShopSchema` (`{ shopName?: string }`) |
| `actions/user.actions.ts` | new | `upgradeToShopAction`, `updateAvatarAction` (Server Actions) |
| [lib/api/server-client.ts](../../../e-commerce-nextjs/lib/api/server-client.ts) | edit | Add optional `signal?: AbortSignal` to `FetchOptions` (additive) |
| `app/(seller)/seller/account/page.tsx` | new | Server Component: reads roles, renders two cards |
| `components/account/avatar-form.tsx` | new | Profile card: `Avatar` + file input + Server-Action form |
| `components/account/upgrade-shop-form.tsx` | new | Shop card: status or upgrade form |
| `components/ui/avatar.tsx`, `form.tsx` | new | shadcn add (see §7) |
| [STATUS.md](../../frontend-seller-dashboard-STATUS.md) | edit | Mark M2 done, note avatar-timeout behavior |

## 5. Behavior

### 5.1 Role-gate (`proxy.ts` + `lib/auth/gate.ts`)
- Extract the decision into a pure helper so it is testable without a `NextRequest`:
  ```ts
  // lib/auth/gate.ts
  export function shouldGateShop(pathname: string, roles: string[] | undefined): boolean {
    if (!pathname.startsWith('/seller')) return false
    if (pathname === '/seller/account' || pathname.startsWith('/seller/account/')) return false
    return !(roles ?? []).includes('shop')
  }
  ```
- In `proxy.ts`, **after** the proactive-refresh block resolves the final `payload`: if `shouldGateShop(req.nextUrl.pathname, payload?.roles)` → `NextResponse.redirect(new URL('/seller/account', req.url))`.
- Ordering matters: running the gate *after* refresh means a just-upgraded user (new cookies written on `res`) is judged by fresh roles. The matcher stays `['/seller/:path*']`.
- `/seller/account` is exempt → non-shops can reach it to upgrade (prevents redirect loop).

### 5.2 `upgradeToShopAction`
1. `upgradeShopSchema.safeParse(Object.fromEntries(formData))`.
2. `apiFetch<{ roles: string[]; tokens: Tokens }>('/user/me/upgrade-to-shop', { auth: true, body: parsed.data })`.
3. `const clientId = await getClientId()` → `await setSession(data.tokens, clientId!)` — **overwrite cookies with shop-role tokens** (the single most error-prone step of M2).
4. `revalidatePath('/seller/account')`.
5. Return `{ ok: true, message: "You're now a shop" }`. Page shows the shop card in its "active" state + success toast. User stays in place (per decision).

### 5.3 `updateAvatarAction`
1. Receive the multipart `FormData` (field `avatar`) from the form.
2. `const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10_000)` → `apiFetch('/user/me/avatar', { method: 'PATCH', multipart: formData, auth: true, signal: ctrl.signal })`; `finally { clearTimeout(t) }`.
3. On abort/timeout or error → `{ ok: false, message: 'Avatar upload is temporarily unavailable' }`.
4. On the (currently unreachable) success → `revalidatePath('/seller/account')` + `{ ok: true, message: 'Avatar updated' }`.

`apiFetch` gains one additive line: `signal: opts.signal` in the `fetch` init, and `signal?: AbortSignal` on `FetchOptions`. No behavior change for existing callers.

### 5.4 `/seller/account` page (two cards)
- Server Component: `const payload = await getAccessPayload()`; `const isShop = payload?.roles?.includes('shop')`.
- **Profile card** (`avatar-form.tsx`, client): shadcn `Avatar` (fallback = initials from email), email text, file input (`accept="image/*"`, name `avatar`), `SubmitButton`. Uses `useActionState(updateAvatarAction)`; error/success via `toast` like M1.
- **Shop card** (`upgrade-shop-form.tsx`, client): if `isShop` → "Shop active" confirmation (no form); else → `shopName` input (optional) + "Upgrade to shop" button via `useActionState(upgradeToShopAction)`.

## 6. Error handling
- Same as M1: actions catch `ApiError`, return `{ ok, message }`, forms toast the message via `useEffect`.
- Avatar timeout is a first-class expected outcome, not an exception to hide — the copy names it plainly ("temporarily unavailable"), per the writing-guidelines convention adopted after M1 (empathetic, not apologetic).

## 7. shadcn / forms decision
- Install `pnpm dlx shadcn@latest add form avatar` (per user).
- **Forms keep the M1 pattern**: plain `<form action={...}> + useActionState`, no react-hook-form. shadcn's `form` component wraps react-hook-form (client validation); adopting it would introduce a second form paradigm alongside M1's Server-Action forms. We use `Avatar` directly and borrow only visual primitives if useful. Rationale: one consistent form model across the app; validation already lives server-side in Zod. (Approved.)

## 8. Testing
- **Unit (Vitest, edge-safe):** `shouldGateShop` truth table (non-`/seller` path, `/seller/account` exempt incl. subpaths, `/seller` as shop vs non-shop, missing roles); `upgradeShopSchema` (accepts empty/omitted `shopName`, trims/validates when present).
- **No network tests** for the actions (they hit the backend); covered by the M1 smoke-test approach manually.
- ⚠️ The Vitest **runner** currently fails at startup on Node 20.9.0 (`node:util` lacks `styleText`, needed by vitest 4 / rolldown). Tests are written to pass on Node ≥ 20.12; this is a pre-existing environment gap, not an M2 regression.
- **Static gates:** `pnpm typecheck && pnpm lint && pnpm build` must be clean.

## 9. Pitfalls (carried from STATUS + verified)
- **Must `setSession` with the new tokens after upgrade** — old tokens lack `shop`; skipping this leaves the proxy gating the user out of `/seller` right after they upgraded.
- **Gate runs after refresh, and `/seller/account` is exempt** — otherwise redirect loop or stale-role gating.
- **`proxy.ts` is Edge** — `lib/auth/gate.ts` must stay pure (no `server-only`, no `next/headers`).
- **Avatar endpoint hangs** — never `await` it without a timeout.
- **`'use server'` files export only async functions** — `ActionState` type/`initialActionState` stay in `actions/state.ts`.
- **`cookies()` is async** — `await` it; cookies are writable only in Actions/proxy, not Server Components.

## 10. Out of scope
- Backend fixes (avatar `.send(res)`, discount routes) — documented, not coded.
- M3 (products) and M4 (discounts).
- Removing an avatar / choosing shop logo — not in the backend contract.
