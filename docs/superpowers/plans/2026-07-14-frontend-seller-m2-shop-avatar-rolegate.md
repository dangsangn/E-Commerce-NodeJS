# M2 — Upgrade to Shop + Avatar + Role-gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in user upgrade to a shop and manage their avatar, and gate `/seller/*` so only shops can enter (non-shops go to `/seller/account`).

**Architecture:** BFF pattern from M1 — browser ↔ Next.js Server Actions/Components ↔ Express `/api/v1`, tokens in httpOnly cookies. Role-gate logic is a pure edge-safe helper called from `proxy.ts`. Upgrade re-writes the session with the new shop-role tokens. Avatar upload is wrapped in an `AbortController` timeout because the backend endpoint currently hangs.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui (`base-nova` style, lucide icons), Zod, Vitest, `sonner` toasts.

**Spec:** [2026-07-14-frontend-seller-m2-shop-avatar-rolegate-design.md](../specs/2026-07-14-frontend-seller-m2-shop-avatar-rolegate-design.md)

**Working directory for all commands:** `e-commerce-nextjs/` (run `cd e-commerce-nextjs` first).

---

## Context every task needs

- **Existing helpers to reuse (do not reinvent):**
  - `hasRole(payload, role)` in [lib/auth/tokens.ts:31](../../../e-commerce-nextjs/lib/auth/tokens.ts) — edge-safe.
  - `decodeJwt`, `isExpiringSoon`, `COOKIE` in the same file.
  - `setSession`, `clearSession`, `getAccessPayload`, `getClientId` in [lib/auth/session.ts](../../../e-commerce-nextjs/lib/auth/session.ts) — `server-only`.
  - `apiFetch<T>`, `ApiError` in [lib/api/server-client.ts](../../../e-commerce-nextjs/lib/api/server-client.ts) — `server-only`.
  - `ActionState`, `initialActionState` in [actions/state.ts](../../../e-commerce-nextjs/actions/state.ts).
  - `SubmitButton` in [components/auth/submit-button.tsx](../../../e-commerce-nextjs/components/auth/submit-button.tsx).
  - `Tokens`, `JwtPayload` in [types/api.ts](../../../e-commerce-nextjs/types/api.ts).
- **Conventions locked in after M1:** UI copy is **English**; buttons imperative + sentence case; loading ends with `…`; errors empathetic not apologetic. New test `it(...)` descriptions in **English**.
- **`'use server'` files export only async functions** — types/consts go elsewhere.
- **`proxy.ts` runs on Edge** — no `server-only`, no `next/headers`; only pure logic + `fetch`.
- **Vitest runner note:** the runner fails to start on Node 20.9.0 (`node:util` lacks `styleText`). Write tests anyway; they are meant to pass on Node ≥ 20.12. Steps that say "run the test" will show this startup error, not a test failure — that is acceptable and expected until Node is upgraded. Still run `pnpm typecheck` to confirm test files compile.
- **Commit policy:** commit at the end of each task. End every commit message with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```

## File structure

| File | New/Modify | Responsibility |
|---|---|---|
| `lib/auth/gate.ts` | Create | Pure `shouldGateShop(pathname, roles)` — edge-safe gate decision |
| `lib/auth/__tests__/gate.test.ts` | Create | Truth table for `shouldGateShop` |
| `lib/validations/user.ts` | Create | Zod `upgradeShopSchema` |
| `lib/validations/__tests__/user.test.ts` | Create | Schema tests |
| `lib/api/server-client.ts` | Modify | Add `signal?: AbortSignal` to `FetchOptions` + pass to `fetch` |
| `proxy.ts` | Modify | Call `shouldGateShop` after refresh; redirect to `/seller/account` |
| `actions/user.actions.ts` | Create | `upgradeToShopAction`, `updateAvatarAction` |
| `components/ui/avatar.tsx`, `components/ui/form.tsx` | Create (shadcn) | Avatar + form primitives |
| `components/account/upgrade-shop-form.tsx` | Create | Shop card (status or upgrade form) |
| `components/account/avatar-form.tsx` | Create | Profile card (avatar + upload form) |
| `app/(seller)/seller/account/page.tsx` | Create | Account page: reads roles, renders two cards |
| `docs/frontend-seller-dashboard-STATUS.md` | Modify | Mark M2 done |

---

### Task 1: Pure role-gate helper (`shouldGateShop`)

**Files:**
- Create: `e-commerce-nextjs/lib/auth/gate.ts`
- Test: `e-commerce-nextjs/lib/auth/__tests__/gate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `e-commerce-nextjs/lib/auth/__tests__/gate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shouldGateShop } from '@/lib/auth/gate'

describe('shouldGateShop', () => {
  it('does not gate paths outside /seller', () => {
    expect(shouldGateShop('/login', [])).toBe(false)
    expect(shouldGateShop('/', undefined)).toBe(false)
  })
  it('never gates /seller/account (upgrade must stay reachable)', () => {
    expect(shouldGateShop('/seller/account', [])).toBe(false)
    expect(shouldGateShop('/seller/account/anything', [])).toBe(false)
  })
  it('gates /seller for a logged-in non-shop', () => {
    expect(shouldGateShop('/seller', ['user'])).toBe(true)
    expect(shouldGateShop('/seller/products', undefined)).toBe(true)
  })
  it('allows /seller for a shop', () => {
    expect(shouldGateShop('/seller', ['user', 'shop'])).toBe(false)
    expect(shouldGateShop('/seller/products', ['shop'])).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd e-commerce-nextjs && pnpm vitest run lib/auth/__tests__/gate.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth/gate` (or, on Node 20.9.0, the vitest **startup** error re `styleText`). Either confirms the test isn't yet passing.

- [ ] **Step 3: Write minimal implementation**

Create `e-commerce-nextjs/lib/auth/gate.ts`:

```ts
// Pure, edge-safe: decide whether a /seller request should be gated for
// lacking the `shop` role. Kept free of server-only / next/headers so proxy.ts
// (Edge runtime) can import it.
export function shouldGateShop(
  pathname: string,
  roles: string[] | undefined,
): boolean {
  if (!pathname.startsWith('/seller')) return false
  if (pathname === '/seller/account' || pathname.startsWith('/seller/account/')) {
    return false
  }
  return !(roles ?? []).includes('shop')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd e-commerce-nextjs && pnpm vitest run lib/auth/__tests__/gate.test.ts`
Expected: PASS (4 tests). If Node < 20.12, the runner won't start — instead run `pnpm typecheck` and confirm no errors, then move on.

- [ ] **Step 5: Commit**

```bash
cd e-commerce-nextjs && git add lib/auth/gate.ts lib/auth/__tests__/gate.test.ts
git commit -m "$(printf 'feat(m2): pure shouldGateShop role-gate helper\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: Wire the role-gate into `proxy.ts`

**Files:**
- Modify: `e-commerce-nextjs/proxy.ts`

- [ ] **Step 1: Add the import**

At the top of `proxy.ts`, extend the tokens import and add the gate import. Change:

```ts
import { COOKIE, decodeJwt, isExpiringSoon } from '@/lib/auth/tokens'
```
to:
```ts
import { COOKIE, decodeJwt, isExpiringSoon } from '@/lib/auth/tokens'
import { shouldGateShop } from '@/lib/auth/gate'
```

- [ ] **Step 2: Add the gate after the payload is final**

In the `proxy` function, the block currently ends:

```ts
  if (!payload) return redirectToLogin(req)

  return res
}
```

Replace it with:

```ts
  if (!payload) return redirectToLogin(req)

  // Role-gate: non-shops may only reach /seller/account (to upgrade).
  // Runs AFTER refresh so a just-upgraded user is judged by fresh roles.
  if (shouldGateShop(req.nextUrl.pathname, payload.roles)) {
    return NextResponse.redirect(new URL('/seller/account', req.url))
  }

  return res
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `cd e-commerce-nextjs && pnpm typecheck`
Expected: no errors.

Run: `cd e-commerce-nextjs && pnpm build`
Expected: build succeeds; `ƒ Proxy (Middleware)` still listed.

- [ ] **Step 4: Commit**

```bash
cd e-commerce-nextjs && git add proxy.ts
git commit -m "$(printf 'feat(m2): gate /seller by shop role in proxy\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: `upgradeShopSchema` validation

**Files:**
- Create: `e-commerce-nextjs/lib/validations/user.ts`
- Test: `e-commerce-nextjs/lib/validations/__tests__/user.test.ts`

- [ ] **Step 1: Write the failing test**

Create `e-commerce-nextjs/lib/validations/__tests__/user.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { upgradeShopSchema } from '@/lib/validations/user'

describe('upgradeShopSchema', () => {
  it('accepts an omitted shopName (backend defaults to user name)', () => {
    expect(upgradeShopSchema.safeParse({}).success).toBe(true)
  })
  it('accepts an empty shopName', () => {
    expect(upgradeShopSchema.safeParse({ shopName: '' }).success).toBe(true)
  })
  it('accepts a valid shopName', () => {
    const r = upgradeShopSchema.safeParse({ shopName: 'My Store' })
    expect(r.success).toBe(true)
  })
  it('rejects a shopName over 100 chars', () => {
    expect(upgradeShopSchema.safeParse({ shopName: 'x'.repeat(101) }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd e-commerce-nextjs && pnpm vitest run lib/validations/__tests__/user.test.ts`
Expected: FAIL — cannot resolve `@/lib/validations/user` (or vitest startup error on Node < 20.12).

- [ ] **Step 3: Write minimal implementation**

Create `e-commerce-nextjs/lib/validations/user.ts`:

```ts
import { z } from 'zod'

export const upgradeShopSchema = z.object({
  shopName: z.string().trim().max(100, 'Shop name is too long').optional(),
})

export type UpgradeShopInput = z.infer<typeof upgradeShopSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd e-commerce-nextjs && pnpm vitest run lib/validations/__tests__/user.test.ts`
Expected: PASS (4 tests). If Node < 20.12, run `pnpm typecheck` instead and confirm clean.

- [ ] **Step 5: Commit**

```bash
cd e-commerce-nextjs && git add lib/validations/user.ts lib/validations/__tests__/user.test.ts
git commit -m "$(printf 'feat(m2): upgradeShopSchema validation\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: Add `signal` support to `apiFetch`

**Files:**
- Modify: `e-commerce-nextjs/lib/api/server-client.ts`

- [ ] **Step 1: Add `signal` to `FetchOptions`**

In `server-client.ts`, change:

```ts
export interface FetchOptions {
  method?: string
  body?: unknown
  multipart?: FormData
  auth?: boolean
  tags?: string[]
  cache?: RequestCache
}
```
to (add the last field):
```ts
export interface FetchOptions {
  method?: string
  body?: unknown
  multipart?: FormData
  auth?: boolean
  tags?: string[]
  cache?: RequestCache
  signal?: AbortSignal
}
```

- [ ] **Step 2: Pass `signal` into `fetch`**

In the `fetch` call, change:

```ts
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers,
    body: opts.multipart ?? (json ? JSON.stringify(opts.body) : undefined),
    cache: opts.cache ?? 'no-store',
    next: opts.tags ? { tags: opts.tags } : undefined,
  })
```
to (add `signal`):
```ts
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers,
    body: opts.multipart ?? (json ? JSON.stringify(opts.body) : undefined),
    cache: opts.cache ?? 'no-store',
    next: opts.tags ? { tags: opts.tags } : undefined,
    signal: opts.signal,
  })
```

- [ ] **Step 3: Verify typecheck**

Run: `cd e-commerce-nextjs && pnpm typecheck`
Expected: no errors (additive change; existing callers unaffected).

- [ ] **Step 4: Commit**

```bash
cd e-commerce-nextjs && git add lib/api/server-client.ts
git commit -m "$(printf 'feat(m2): support AbortSignal in apiFetch\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: User Server Actions (`upgradeToShopAction`, `updateAvatarAction`)

**Files:**
- Create: `e-commerce-nextjs/actions/user.actions.ts`

- [ ] **Step 1: Write the actions file**

Create `e-commerce-nextjs/actions/user.actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { apiFetch, ApiError } from '@/lib/api/server-client'
import { setSession, getClientId } from '@/lib/auth/session'
import { upgradeShopSchema } from '@/lib/validations/user'
import type { Tokens } from '@/types/api'
import type { ActionState } from '@/actions/state'

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback
}

interface UpgradeData {
  roles: string[]
  tokens: Tokens
}

export async function upgradeToShopAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = upgradeShopSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message }

  const clientId = await getClientId()
  if (!clientId) return { ok: false, message: 'Your session has expired' }

  try {
    const data = await apiFetch<UpgradeData>('/user/me/upgrade-to-shop', {
      auth: true,
      body: parsed.data,
    })
    // Critical: overwrite cookies with the new shop-role tokens, or the proxy
    // keeps seeing the old (non-shop) role and gates the user out of /seller.
    await setSession(data.tokens, clientId)
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not upgrade to a shop') }
  }

  revalidatePath('/seller/account')
  return { ok: true, message: "You're now a shop" }
}

const AVATAR_TIMEOUT_MS = 10_000

export async function updateAvatarAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const file = formData.get('avatar')
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, message: 'Choose an image to upload' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AVATAR_TIMEOUT_MS)
  try {
    await apiFetch('/user/me/avatar', {
      method: 'PATCH',
      multipart: formData,
      auth: true,
      signal: controller.signal,
    })
  } catch (e) {
    // The backend endpoint currently never sends a response (missing .send(res)),
    // so this abort/timeout is the expected path today. See STATUS §6.
    if (e instanceof DOMException && e.name === 'AbortError')
      return { ok: false, message: 'Avatar upload is temporarily unavailable' }
    return { ok: false, message: errorMessage(e, 'Could not update your avatar') }
  } finally {
    clearTimeout(timer)
  }

  revalidatePath('/seller/account')
  return { ok: true, message: 'Avatar updated' }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd e-commerce-nextjs && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd e-commerce-nextjs && git add actions/user.actions.ts
git commit -m "$(printf 'feat(m2): upgrade-to-shop + avatar server actions\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 6: Install shadcn `avatar` and `form`

**Files:**
- Create (generated): `e-commerce-nextjs/components/ui/avatar.tsx`, `e-commerce-nextjs/components/ui/form.tsx`

- [ ] **Step 1: Run the shadcn add command**

Run: `cd e-commerce-nextjs && pnpm dlx shadcn@latest add form avatar`
Expected: creates `components/ui/avatar.tsx` and `components/ui/form.tsx`; may add deps (`@radix-ui/react-avatar`, `react-hook-form`, etc.) to `package.json`. If it prompts to overwrite anything, decline overwrites of existing files.

- [ ] **Step 2: Verify the files exist and build compiles**

Run: `cd e-commerce-nextjs && ls components/ui/avatar.tsx components/ui/form.tsx && pnpm typecheck`
Expected: both files listed; typecheck clean.

> Note: we install `form` per the spec but the account forms use the M1 Server-Action + `useActionState` pattern (no react-hook-form). `avatar.tsx` is used directly; `form.tsx` is available if visual primitives help.

- [ ] **Step 3: Commit**

```bash
cd e-commerce-nextjs && git add components/ui/avatar.tsx components/ui/form.tsx package.json pnpm-lock.yaml
git commit -m "$(printf 'chore(m2): add shadcn avatar + form components\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 7: Shop card component (`upgrade-shop-form.tsx`)

**Files:**
- Create: `e-commerce-nextjs/components/account/upgrade-shop-form.tsx`

- [ ] **Step 1: Write the component**

Create `e-commerce-nextjs/components/account/upgrade-shop-form.tsx`:

```tsx
'use client'
import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { upgradeToShopAction } from '@/actions/user.actions'
import { initialActionState } from '@/actions/state'
import { SubmitButton } from '@/components/auth/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function UpgradeShopForm({ isShop }: { isShop: boolean }) {
  const [state, formAction] = useActionState(upgradeToShopAction, initialActionState)

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message)
    else if (!state.ok && state.message) toast.error(state.message)
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shop</CardTitle>
        <CardDescription>
          {isShop ? 'Your shop is active.' : 'Become a shop to start selling.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isShop ? (
          <p className="text-sm text-muted-foreground">
            You can manage products and discounts from the seller dashboard.
          </p>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shopName">Shop name (optional)</Label>
              <Input id="shopName" name="shopName" placeholder="Defaults to your name" />
            </div>
            <SubmitButton>Upgrade to shop</SubmitButton>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd e-commerce-nextjs && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd e-commerce-nextjs && git add components/account/upgrade-shop-form.tsx
git commit -m "$(printf 'feat(m2): shop upgrade card component\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 8: Profile / avatar card component (`avatar-form.tsx`)

**Files:**
- Create: `e-commerce-nextjs/components/account/avatar-form.tsx`

- [ ] **Step 1: Write the component**

Create `e-commerce-nextjs/components/account/avatar-form.tsx`:

```tsx
'use client'
import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { updateAvatarAction } from '@/actions/user.actions'
import { initialActionState } from '@/actions/state'
import { SubmitButton } from '@/components/auth/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function initials(email: string | undefined): string {
  if (!email) return '?'
  return email.slice(0, 2).toUpperCase()
}

export function AvatarForm({ email, avatarUrl }: { email?: string; avatarUrl?: string }) {
  const [state, formAction] = useActionState(updateAvatarAction, initialActionState)

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message)
    else if (!state.ok && state.message) toast.error(state.message)
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update your avatar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="Your avatar" /> : null}
            <AvatarFallback>{initials(email)}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">{email ?? '—'}</span>
        </div>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="avatar">New avatar</Label>
            <Input id="avatar" name="avatar" type="file" accept="image/*" required />
          </div>
          <SubmitButton>Upload avatar</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd e-commerce-nextjs && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd e-commerce-nextjs && git add components/account/avatar-form.tsx
git commit -m "$(printf 'feat(m2): profile avatar card component\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 9: Account page (`/seller/account`)

**Files:**
- Create: `e-commerce-nextjs/app/(seller)/seller/account/page.tsx`

- [ ] **Step 1: Write the page**

Create `e-commerce-nextjs/app/(seller)/seller/account/page.tsx`:

```tsx
import { getAccessPayload } from '@/lib/auth/session'
import { AvatarForm } from '@/components/account/avatar-form'
import { UpgradeShopForm } from '@/components/account/upgrade-shop-form'

export default async function AccountPage() {
  const payload = await getAccessPayload()
  const isShop = Boolean(payload?.roles?.includes('shop'))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and shop.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <AvatarForm email={payload?.email} />
        <UpgradeShopForm isShop={isShop} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck + build**

Run: `cd e-commerce-nextjs && pnpm typecheck && pnpm build`
Expected: build succeeds; route list now includes `/seller/account`.

- [ ] **Step 3: Commit**

```bash
cd e-commerce-nextjs && git add "app/(seller)/seller/account/page.tsx"
git commit -m "$(printf 'feat(m2): /seller/account page with profile + shop cards\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 10: Full verification + STATUS update

**Files:**
- Modify: `docs/frontend-seller-dashboard-STATUS.md`

- [ ] **Step 1: Run all static gates**

Run: `cd e-commerce-nextjs && pnpm typecheck && pnpm lint && pnpm build`
Expected: typecheck clean; lint 0 errors (pre-existing `.agents/skills` warnings OK); build succeeds with routes `/`, `/login`, `/signup`, `/verify-otp`, `/seller`, `/seller/account`.

- [ ] **Step 2: Run unit tests (best effort)**

Run: `cd e-commerce-nextjs && pnpm test:run`
Expected: on Node ≥ 20.12, all tests pass (M1's 22 + new gate 4 + user-schema 4 = 30). On Node 20.9.0, the runner fails to start (`styleText`) — record this as a known environment gap, not an M2 failure.

- [ ] **Step 3: Update STATUS.md**

In `docs/frontend-seller-dashboard-STATUS.md`:
- In the milestone table (§1), change the M2 row status from `⏳ Chưa làm` to `✅ **Xong**`.
- Append a short "Đã làm — M2" note referencing the new files (`lib/auth/gate.ts`, `actions/user.actions.ts`, `/seller/account`, avatar timeout behavior) and the fact that the avatar feature depends on the backend `.send(res)` fix (STATUS §6).

- [ ] **Step 4: Commit**

```bash
git add docs/frontend-seller-dashboard-STATUS.md
git commit -m "$(printf 'docs(m2): mark M2 done in status\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

- [ ] **Step 5: Manual smoke test (requires backend + API_KEY)**

Not automatable here; document for whoever has the environment:
1. Log in as a fresh (non-shop) user → visiting `/seller` should redirect to `/seller/account`.
2. On `/seller/account`, submit the upgrade form → success toast "You're now a shop"; the Shop card flips to "Your shop is active."; navigating to `/seller` no longer redirects.
3. Avatar upload → after ~10s shows "Avatar upload is temporarily unavailable" (expected until backend `.send(res)` fix).
4. DevTools: cookies still `HttpOnly`; after upgrade, `access_token` decodes to include `shop` in `roles`.

---

## Self-review notes (author)

- **Spec coverage:** role-gate (Tasks 1–2), upgrade action + setSession (Task 5), avatar action + timeout (Tasks 4–5), two-card account page (Tasks 7–9), shadcn install (Task 6), tests (Tasks 1, 3), verification + STATUS (Task 10). All spec §4/§5 files present.
- **Type consistency:** `UpgradeData` uses `Tokens` from types/api; `upgradeShopSchema`/`UpgradeShopInput` names consistent; `shouldGateShop(pathname, roles)` signature identical in test, impl, and proxy call; action names `upgradeToShopAction`/`updateAvatarAction` match component imports.
- **No placeholders:** every code step shows full code; every command shows expected output.
