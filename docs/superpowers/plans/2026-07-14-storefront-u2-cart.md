# U2 — Cart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A logged-in customer can add to cart, view the cart, change quantities (− / + stepper), remove lines, and clear the cart, over the Express `/cart` API.

**Architecture:** BFF pattern. Cart is auth-only (`proxy.ts` matcher gains `/cart`). Server Actions call `/cart/*` with `auth:true`; each mutation `revalidatePath('/cart')` so the page re-syncs (handles the backend's optimistic-concurrency). Header shows a `no-store` cart badge (fresh per navigation).

**Tech Stack:** Next.js 16, React 19, TS, Tailwind, shadcn (Base UI), lucide, `sonner`. No new shadcn.

**Spec:** [2026-07-14-storefront-u2-cart-design.md](../specs/2026-07-14-storefront-u2-cart-design.md)

**Working directory:** `e-commerce-nextjs/`.

## Context every task needs

- **Reuse:** `apiFetch<T>(path, opts)`/`ApiError` (`lib/api/server-client.ts`) — supports `method`, `body`, `auth`, `signal`; sends a JSON body whenever `body` is set (incl. DELETE). `errorMessage` (`lib/api/error-message.ts`); `ActionState`/`initialActionState` (`actions/state.ts`); `getClientId`/`getAccessPayload` (`lib/auth/session.ts`); `toPriceString` (`lib/products/price.ts`); `SubmitButton` (`components/auth/submit-button.tsx`); UI from `components/ui/` (`Card*`, `Input`, `Label`, `Button`, `buttonVariants`, `Badge`).
- **Backend facts (verified):**
  - `GET /cart` → `{ cart_products: [{ productId, shopId, name, thumb, price, quantity }], cart_count_product, ... }` or `{ cart_products: [], cart_count_product: 0 }`.
  - `POST /cart` `{ productId, quantity }` → add/increment (published + stock checked). 201.
  - `PATCH /cart/quantity` `{ productId, oldQuantity, newQuantity }` → CAS on `oldQuantity`; `newQuantity:0` removes; conflict → `'Cart was updated by other request...'`; stock → `'Only N items in stock'`.
  - `DELETE /cart` **body** `{ productId, oldQuantity }` → remove line (CAS).
  - `DELETE /cart/clear` → empty cart.
- **Conventions:** English copy, imperative buttons, sentence case, empathetic errors. `params`/`searchParams` async. `'use server'` files export only async functions.
- **Login redirect:** `/login?redirect=<path>` is supported (login page reads `redirect` searchParam → `loginAction` redirects there).
- **Vitest runner** blocked on Node 20.9.0 (`styleText`) — run `pnpm typecheck` when the runner won't start.
- **Git:** controller handles commits; implement + verify. Never touch `.agents/`/`skills-lock.json`.

## File structure

| File | Responsibility |
|---|---|
| `types/cart.ts` | Cart types |
| `lib/products/price.ts` | + `toPriceNumber` |
| `lib/cart/summary.ts` (+test) | `cartSubtotal` |
| `actions/cart.actions.ts` | 4 actions |
| `components/store/add-to-cart.tsx` | Add-to-cart (client) |
| `components/store/cart-line.tsx` | Line stepper + remove (client) |
| `app/(store)/cart/page.tsx` | Cart page |
| `components/store/store-header.tsx` | + cart icon/badge (modify) |
| `app/(store)/products/[id]/page.tsx` | + `<AddToCart/>` (modify) |
| `proxy.ts` | matcher += `/cart` (modify) |
| STATUS.md | U2 done |

---

### Task 1: Cart types

**File:** Create `types/cart.ts`.

- [ ] **Step 1:**
```ts
import type { Decimal } from '@/types/product'

export interface CartProduct {
  productId: string
  shopId?: string
  name: string
  thumb: string
  price: Decimal
  quantity: number
}

export interface Cart {
  cart_products: CartProduct[]
  cart_count_product: number
  cart_state?: string
}
```
- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** (commit by controller.)

---

### Task 2: Price number helper + cart subtotal

**Files:** Modify `lib/products/price.ts`; create `lib/cart/summary.ts`, `lib/cart/__tests__/summary.test.ts`.

- [ ] **Step 1:** Add to `lib/products/price.ts` (keep `toPriceString` as-is):
```ts
// Numeric coercion for math (line totals, subtotals). Mirrors toPriceString's parsing.
export function toPriceNumber(value: Decimal): number {
  let n: number
  if (typeof value === 'number') n = value
  else if (typeof value === 'string') n = Number(value)
  else if (value && typeof value === 'object' && '$numberDecimal' in value) n = Number(value.$numberDecimal)
  else n = NaN
  return Number.isFinite(n) ? n : 0
}
```
(Ensure `import type { Decimal } from '@/types/product'` exists at the top — `toPriceString` already imports it.)

- [ ] **Step 2: Write the failing test** — `lib/cart/__tests__/summary.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { cartSubtotal } from '@/lib/cart/summary'

describe('cartSubtotal', () => {
  it('sums price * quantity', () => {
    expect(cartSubtotal([
      { productId: 'a', name: 'A', thumb: '', price: 10, quantity: 2 },
      { productId: 'b', name: 'B', thumb: '', price: 5.5, quantity: 1 },
    ])).toBe(25.5)
  })
  it('handles Decimal128 prices', () => {
    expect(cartSubtotal([
      { productId: 'a', name: 'A', thumb: '', price: { $numberDecimal: '9.99' }, quantity: 3 },
    ])).toBeCloseTo(29.97, 2)
  })
  it('returns 0 for an empty cart', () => {
    expect(cartSubtotal([])).toBe(0)
  })
})
```

- [ ] **Step 3: Implement** — `lib/cart/summary.ts`:
```ts
import { toPriceNumber } from '@/lib/products/price'
import type { CartProduct } from '@/types/cart'

export function cartSubtotal(products: CartProduct[]): number {
  return products.reduce((sum, p) => sum + toPriceNumber(p.price) * p.quantity, 0)
}
```

- [ ] **Step 4:** Re-run test (3 pass) or `pnpm typecheck`. **Step 5:** (commit by controller.)

---

### Task 3: Cart Server Actions

**File:** Create `actions/cart.actions.ts`.

- [ ] **Step 1:**
```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { apiFetch } from '@/lib/api/server-client'
import { errorMessage } from '@/lib/api/error-message'
import { getClientId } from '@/lib/auth/session'
import type { ActionState } from '@/actions/state'

export async function addToCartAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get('productId') ?? '')
  const quantity = Number(formData.get('quantity') ?? 1)
  if (!productId) return { ok: false, message: 'Missing product' }
  if (!Number.isFinite(quantity) || quantity < 1) return { ok: false, message: 'Quantity must be at least 1' }

  const clientId = await getClientId()
  if (!clientId) redirect(`/login?redirect=/products/${productId}`)

  try {
    await apiFetch('/cart', { auth: true, body: { productId, quantity } })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not add to cart') }
  }
  revalidatePath('/cart')
  return { ok: true, message: 'Added to cart' }
}

export async function updateCartQuantityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get('productId') ?? '')
  const oldQuantity = Number(formData.get('oldQuantity'))
  const newQuantity = Number(formData.get('newQuantity'))
  if (!productId) return { ok: false, message: 'Missing product' }
  try {
    await apiFetch('/cart/quantity', { method: 'PATCH', auth: true, body: { productId, oldQuantity, newQuantity } })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not update quantity') }
  }
  revalidatePath('/cart')
  return { ok: true }
}

export async function removeFromCartAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get('productId') ?? '')
  const oldQuantity = Number(formData.get('oldQuantity'))
  if (!productId) return { ok: false, message: 'Missing product' }
  try {
    await apiFetch('/cart', { method: 'DELETE', auth: true, body: { productId, oldQuantity } })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not remove item') }
  }
  revalidatePath('/cart')
  return { ok: true, message: 'Item removed' }
}

export async function clearCartAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await apiFetch('/cart/clear', { method: 'DELETE', auth: true })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not clear the cart') }
  }
  revalidatePath('/cart')
  return { ok: true, message: 'Cart cleared' }
}
```

> Note: `redirect()` throws internally, so it must be outside the try/catch (it is — before the try). The `updateCartQuantityAction` returns `{ ok: true }` with no message (success is silent; the revalidate re-render is the feedback).

- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** (commit by controller.)

---

### Task 4: Add-to-cart component

**File:** Create `components/store/add-to-cart.tsx`.

- [ ] **Step 1:**
```tsx
'use client'
import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { addToCartAction } from '@/actions/cart.actions'
import { initialActionState } from '@/actions/state'
import { SubmitButton } from '@/components/auth/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AddToCart({ productId, max }: { productId: string; max?: number }) {
  const [state, formAction] = useActionState(addToCartAction, initialActionState)

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message)
    else if (!state.ok && state.message) toast.error(state.message)
  }, [state])

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="productId" value={productId} />
      <div className="w-24 space-y-2">
        <Label htmlFor="quantity">Quantity</Label>
        <Input id="quantity" name="quantity" type="number" min={1} max={max} defaultValue={1} />
      </div>
      <SubmitButton>Add to cart</SubmitButton>
    </form>
  )
}
```

- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** (commit by controller.)

---

### Task 5: Cart line component

**File:** Create `components/store/cart-line.tsx`.

- [ ] **Step 1:**
```tsx
'use client'
import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { updateCartQuantityAction, removeFromCartAction } from '@/actions/cart.actions'
import { initialActionState } from '@/actions/state'
import { toPriceString } from '@/lib/products/price'
import { Button } from '@/components/ui/button'
import type { CartProduct } from '@/types/cart'

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" size="icon" aria-label={label} disabled={pending}>
      {children}
    </Button>
  )
}

export function CartLine({ product }: { product: CartProduct }) {
  const { productId, name, thumb, price, quantity } = product
  const [qtyState, qtyAction] = useActionState(updateCartQuantityAction, initialActionState)
  const [rmState, rmAction] = useActionState(removeFromCartAction, initialActionState)

  useEffect(() => {
    if (!qtyState.ok && qtyState.message) toast.error(qtyState.message)
  }, [qtyState])
  useEffect(() => {
    if (!rmState.ok && rmState.message) toast.error(rmState.message)
    else if (rmState.ok && rmState.message) toast.success(rmState.message)
  }, [rmState])

  const lineTotal = toPriceString(
    typeof price === 'number' ? price * quantity : (Number((price as { $numberDecimal?: string })?.$numberDecimal ?? price) || 0) * quantity,
  )

  return (
    <div className="flex items-center gap-4 border-b py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumb} alt={name} className="h-16 w-16 rounded-md border object-cover" />
      <div className="flex-1">
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{toPriceString(price)} each</p>
      </div>
      <div className="flex items-center gap-2">
        <form action={qtyAction}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="oldQuantity" value={quantity} />
          <input type="hidden" name="newQuantity" value={quantity - 1} />
          <IconButton label="Decrease quantity">−</IconButton>
        </form>
        <span className="w-8 text-center tabular-nums">{quantity}</span>
        <form action={qtyAction}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="oldQuantity" value={quantity} />
          <input type="hidden" name="newQuantity" value={quantity + 1} />
          <IconButton label="Increase quantity">+</IconButton>
        </form>
      </div>
      <div className="w-20 text-right tabular-nums">{lineTotal}</div>
      <form action={rmAction}>
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="oldQuantity" value={quantity} />
        <Button type="submit" variant="ghost" size="sm">Remove</Button>
      </form>
    </div>
  )
}
```

> Both `−` and `+` forms share the same `qtyAction` from one `useActionState`; the difference is the hidden `newQuantity`. `−` at quantity 1 sends `newQuantity=0`, which the backend treats as a remove. `size="icon"` / `size="sm"` come from the button `cva` variants (verified in `components/ui/button.tsx`).

- [ ] **Step 2:** `pnpm typecheck`. Confirm `Button` supports `size="icon"` and `size="sm"` (it does — from M2/M3 usage). **Step 3:** (commit by controller.)

---

### Task 6: Cart page

**File:** Create `app/(store)/cart/page.tsx`.

- [ ] **Step 1:**
```tsx
import Link from 'next/link'
import { apiFetch } from '@/lib/api/server-client'
import { toPriceString } from '@/lib/products/price'
import { cartSubtotal } from '@/lib/cart/summary'
import { clearCartAction } from '@/actions/cart.actions'
import { CartLine } from '@/components/store/cart-line'
import { Button } from '@/components/ui/button'
import type { Cart } from '@/types/cart'

export default async function CartPage() {
  let cart: Cart = { cart_products: [], cart_count_product: 0 }
  let error: string | null = null
  try {
    cart = await apiFetch<Cart>('/cart', { auth: true })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load your cart'
  }

  const items = cart.cart_products ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Your cart</h1>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Your cart is empty. <Link href="/" className="text-primary hover:underline">Browse products</Link>
        </p>
      ) : (
        <div className="space-y-6">
          <div>
            {items.map((p) => (
              <CartLine key={p.productId} product={p} />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <form action={clearCartAction}>
              <Button type="submit" variant="ghost">Clear cart</Button>
            </form>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Subtotal</p>
              <p className="text-xl font-semibold tabular-nums">{toPriceString(cartSubtotal(items))}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

> `clearCartAction` is used as a form action directly (it matches the `(prev, formData) => Promise<ActionState>` shape; when used as a plain `<form action>` its return is ignored, which is fine — the `revalidatePath` refreshes the page). Note `toPriceString` accepts a number (`cartSubtotal` returns a number) — verified: `toPriceString` handles `number`.

- [ ] **Step 2:** `pnpm typecheck && pnpm build` — expect route `/cart`. **Step 3:** (commit by controller.)

---

### Task 7: Gate /cart in proxy

**File:** Modify `proxy.ts`.

- [ ] **Step 1:** Change the matcher:
```ts
export const config = {
  matcher: ['/seller/:path*', '/cart/:path*'],
}
```
No other change — `shouldGateShop` already returns `false` for non-`/seller` paths, so `/cart` only requires a session (login), not the `shop` role. The existing token-refresh + login-redirect logic applies to `/cart` automatically.

- [ ] **Step 2:** `pnpm typecheck && pnpm build` — build shows `ƒ Proxy (Middleware)`; `/cart` present. **Step 3:** (commit by controller.)

---

### Task 8: Header cart badge

**File:** Modify `components/store/store-header.tsx`.

- [ ] **Step 1:** Add the cart icon + badge. Fetch the cart only when logged in; guard with try/catch. Add imports and a cart fetch, then render the icon in the nav.

Add near the top:
```tsx
import { apiFetch } from '@/lib/api/server-client'
import { ShoppingCart } from 'lucide-react'
import type { Cart } from '@/types/cart'
```

Inside `StoreHeader`, after computing `payload`/`isShop`, fetch the count:
```tsx
  let cartCount = 0
  if (payload) {
    try {
      const cart = await apiFetch<Cart>('/cart', { auth: true })
      cartCount = cart.cart_count_product ?? 0
    } catch {
      cartCount = 0
    }
  }
```

In the `<nav>`, add a cart link **before** the account block (visible to everyone):
```tsx
        <Link href="/cart" aria-label="Cart" className="relative text-muted-foreground hover:text-foreground">
          <ShoppingCart className="size-5" />
          {cartCount > 0 ? (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {cartCount}
            </span>
          ) : null}
        </Link>
```

- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** (commit by controller.)

---

### Task 9: Add-to-cart on the product detail page

**File:** Modify `app/(store)/products/[id]/page.tsx`.

- [ ] **Step 1:** Import the component:
```tsx
import { AddToCart } from '@/components/store/add-to-cart'
```

- [ ] **Step 2:** In the detail column, after the stock line (`In stock: {product.product_quantity}`) and description, render:
```tsx
          <AddToCart productId={product._id} max={product.product_quantity} />
```
Place it inside the right-hand `<div className="space-y-4">`, e.g. right after the `In stock` `<p>` or after the description — a sensible spot is right after the price/stock, before attributes, or at the end of the column. Put it after the description block.

- [ ] **Step 3:** `pnpm typecheck && pnpm build` — `/products/[id]` still builds. **Step 4:** (commit by controller.)

---

### Task 10: Full verification + STATUS

- [ ] **Step 1:** `pnpm typecheck && pnpm lint && pnpm build` — typecheck clean; lint 0 errors; build shows `/cart` and `ƒ Proxy (Middleware)`; `/products/[id]`, `/`, seller routes intact. (If typecheck reports a stale `.next/dev/types` error referencing a moved/removed file, `rm -rf .next/dev` and re-run — it's a dev cache artifact.)
- [ ] **Step 2:** `pnpm test:run` — on Node ≥ 20.12 all pass (prior + `cartSubtotal`/`toPriceNumber`). On 20.9.0 record the environmental error.
- [ ] **Step 3:** Update `docs/frontend-seller-dashboard-STATUS.md`: set the U2 row to `✅ **Xong**`; add a "Đã làm — U2" section (files; the CAS/oldQuantity handling; DELETE-with-body; anonymous add→login; header badge on navigation).
- [ ] **Step 4:** (commit by controller.)
- [ ] **Step 5: Manual smoke test (needs backend + API_KEY + a logged-in customer):**
  1. Anonymous on `/products/[id]` → "Add to cart" → redirected to `/login?redirect=…`; after login, back on the product; add again → toast "Added to cart".
  2. Header cart icon shows the count badge; click → `/cart` lists the line(s).
  3. `+`/`−` change quantity; `−` at 1 removes the line; Remove removes; Clear cart empties it. Exceeding stock → "Only N items in stock" toast.
  4. `/cart` while anonymous → redirected to login (proxy gate).

---

## Self-review notes (author)

- **Spec coverage:** types (T1), price/subtotal (T2), 4 actions incl. anonymous-redirect + CAS + DELETE-body (T3), add-to-cart (T4), line stepper/remove (T5), cart page + subtotal + clear (T6), proxy gate (T7), header badge (T8), detail-page wiring (T9), verify+STATUS+smoke (T10). Matches spec §3–§8.
- **Type consistency:** `Cart`/`CartProduct` (T1) used in T2/T5/T6/T8; `toPriceNumber` (T2) used by `cartSubtotal`; action names consistent between T3 and importers (T4/T5/T6); hidden field names (`productId`,`quantity`,`oldQuantity`,`newQuantity`) match the action readers.
- **Placeholders:** all code specified. T9 gives an explicit placement instruction rather than re-pasting the whole detail page.
- **Risk note:** the `−`/`+` share one `useActionState`; correctness rests on the hidden `newQuantity` differing per form — verified in the T5 markup. `clearCartAction`/detail-page `<form action>` usage ignores the return value, which is acceptable (revalidate is the effect).
