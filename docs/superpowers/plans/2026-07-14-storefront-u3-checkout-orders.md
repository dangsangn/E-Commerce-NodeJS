# U3 — Checkout + Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Checkout the cart (review → address/payment → place order) and view order history with cancel-if-pending, over the Express `/checkout` and `/order` APIs.

**Architecture:** BFF pattern. Checkout + orders auth-gated (proxy matcher += `/checkout`, `/orders`). `/checkout` is one route with a client 3-step wizard; the page fetches the cart + runs the review server-side.

**Tech Stack:** Next.js 16, React 19, TS, Tailwind, shadcn (Base UI), `sonner`. No new shadcn.

**Spec:** [2026-07-14-storefront-u3-checkout-orders-design.md](../specs/2026-07-14-storefront-u3-checkout-orders-design.md)

**Working directory:** `e-commerce-nextjs/`.

## Context every task needs

- **Reuse:** `apiFetch`/`ApiError`; `errorMessage`; `ActionState`/`initialActionState`; `getClientId`; `toPriceString`/`toPriceNumber` (`lib/products/price.ts`); `SubmitButton`; `Cart`/`CartProduct` (`types/cart.ts`); UI (`Card*`, `Input`, `Label`, `Button`, `buttonVariants`, `Badge`, `Select`+parts).
- **Backend facts (verified):**
  - `POST /checkout/review` body `{ shop_order_ids: [{ shopId, shop_discounts, item_products:[{productId,quantity,price}] }] }` → `{ shop_order_ids_new:[{ shopId, item_products:[{productId,price,quantity,name,thumb}], price_raw, price_apply_discount }], checkout_order:{ totalPrice, totalDiscount, feeShip, totalCheckout } }`. Item `price` must equal `Number(product_price)`; `shopId` must match the product's shop.
  - `POST /order` body `{ shop_order_ids, user_address:{street,city,state,country}, user_payment:{method} }` → 201, order created (status `pending`), stock reserved, cart items removed.
  - `GET /order` → `{ data: Order[], pagination }` (page 1 only — controller ignores paging).
  - `GET /order/:id` + `PATCH /order/:id/cancel` — **broken** (controller reads `req.params.orderId`, route is `:id`). Wire cancel to `PATCH /order/<id>/cancel` anyway; it errors until BE fix. No detail page.
- **Conventions:** English copy, sentence case, empathetic errors; `params`/`searchParams` async; `'use server'` files export only async functions.
- **Vitest runner** blocked on Node 20.9.0 — run `pnpm typecheck` when it won't start.
- **Git:** controller handles commits; implement + verify. Never touch `.agents/`/`skills-lock.json`.

## File structure

| File | Responsibility |
|---|---|
| `types/order.ts` | Order + checkout types + `ORDER_STATUSES` |
| `lib/checkout/build-shop-orders.ts` (+test) | Group cart → `shop_order_ids` |
| `actions/order.actions.ts` | `placeOrderAction`, `cancelOrderAction` |
| `components/store/checkout-wizard.tsx` | 3-step wizard (client) |
| `components/store/order-card.tsx` | Order card + cancel (client) |
| `app/(store)/checkout/page.tsx` | Checkout (server) |
| `app/(store)/orders/page.tsx` | Order history (server) |
| `app/(store)/cart/page.tsx` | + checkout link (modify) |
| `proxy.ts` | matcher += `/checkout`, `/orders` (modify) |
| STATUS.md, backend-gaps-guide.md | U3 done + order gap |

---

### Task 1: Order types

**File:** Create `types/order.ts`.

- [ ] **Step 1:**
```ts
import type { Decimal } from '@/types/product'

export const ORDER_STATUSES = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'failed'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

// Sent to the backend (grouped by shop).
export interface ShopOrderItem {
  shopId: string
  shop_discounts: { code: string; shopId: string }[]
  item_products: { productId: string; quantity: number; price: number }[]
}

// A validated product snapshot returned by review / stored on the order.
export interface OrderProduct {
  productId: string
  price: Decimal
  quantity: number
  name: string
  thumb: string
}

export interface ShopOrderNew {
  shopId: string
  shop_discounts?: { code: string; shopId: string }[]
  item_products: OrderProduct[]
  price_raw: number
  price_apply_discount: number
}

export interface CheckoutOrder {
  totalPrice: number
  totalDiscount: number
  feeShip: number
  totalCheckout: number
}

export interface CheckoutReview {
  shop_order_ids_new: ShopOrderNew[]
  checkout_order: CheckoutOrder
}

export interface Order {
  _id: string
  order_checkout: CheckoutOrder
  order_shipping?: { street?: string; city?: string; state?: string; country?: string }
  order_payment?: { method?: string }
  order_products: ShopOrderNew[]
  order_status: OrderStatus
  createdAt?: string
}
```
- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** (commit by controller.)

---

### Task 2: buildShopOrders helper

**Files:** Create `lib/checkout/build-shop-orders.ts`, `lib/checkout/__tests__/build-shop-orders.test.ts`.

- [ ] **Step 1: Write the failing test:**
```ts
import { describe, it, expect } from 'vitest'
import { buildShopOrders } from '@/lib/checkout/build-shop-orders'
import type { CartProduct } from '@/types/cart'

const p = (over: Partial<CartProduct>): CartProduct => ({
  productId: 'p', shopId: 's1', name: 'n', thumb: '', price: 10, quantity: 1, ...over,
})

describe('buildShopOrders', () => {
  it('groups items by shopId', () => {
    const out = buildShopOrders([
      p({ productId: 'a', shopId: 's1', price: 10, quantity: 2 }),
      p({ productId: 'b', shopId: 's1', price: 5, quantity: 1 }),
      p({ productId: 'c', shopId: 's2', price: 7, quantity: 3 }),
    ])
    expect(out).toHaveLength(2)
    const s1 = out.find((s) => s.shopId === 's1')!
    expect(s1.item_products).toHaveLength(2)
    expect(s1.shop_discounts).toEqual([])
    expect(s1.item_products[0]).toEqual({ productId: 'a', quantity: 2, price: 10 })
  })
  it('coerces Decimal128 price to a number', () => {
    const out = buildShopOrders([p({ productId: 'a', price: { $numberDecimal: '9.99' }, quantity: 1 })])
    expect(out[0].item_products[0].price).toBeCloseTo(9.99, 2)
  })
  it('returns [] for an empty cart', () => {
    expect(buildShopOrders([])).toEqual([])
  })
})
```

- [ ] **Step 2:** Run the test (expect module-not-found or environmental error).

- [ ] **Step 3: Implement** — `lib/checkout/build-shop-orders.ts`:
```ts
import { toPriceNumber } from '@/lib/products/price'
import type { CartProduct } from '@/types/cart'
import type { ShopOrderItem } from '@/types/order'

export function buildShopOrders(products: CartProduct[]): ShopOrderItem[] {
  const byShop = new Map<string, ShopOrderItem>()
  for (const p of products) {
    const shopId = p.shopId ?? ''
    let group = byShop.get(shopId)
    if (!group) {
      group = { shopId, shop_discounts: [], item_products: [] }
      byShop.set(shopId, group)
    }
    group.item_products.push({ productId: p.productId, quantity: p.quantity, price: toPriceNumber(p.price) })
  }
  return [...byShop.values()]
}
```

- [ ] **Step 4:** Re-run test (3 pass) or `pnpm typecheck`. **Step 5:** (commit by controller.)

---

### Task 3: Order actions

**File:** Create `actions/order.actions.ts`.

- [ ] **Step 1:**
```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { apiFetch } from '@/lib/api/server-client'
import { errorMessage } from '@/lib/api/error-message'
import type { ActionState } from '@/actions/state'
import type { ShopOrderItem } from '@/types/order'

export async function placeOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let shopOrderIds: ShopOrderItem[]
  try {
    shopOrderIds = JSON.parse(String(formData.get('shop_order_ids') ?? '[]'))
  } catch {
    return { ok: false, message: 'Your cart could not be read. Please try again.' }
  }
  if (!Array.isArray(shopOrderIds) || shopOrderIds.length === 0)
    return { ok: false, message: 'Your cart is empty' }

  const user_address = {
    street: String(formData.get('street') ?? ''),
    city: String(formData.get('city') ?? ''),
    state: String(formData.get('state') ?? ''),
    country: String(formData.get('country') ?? ''),
  }
  if (!user_address.street || !user_address.city || !user_address.state || !user_address.country)
    return { ok: false, message: 'Enter your full shipping address' }

  const user_payment = { method: String(formData.get('paymentMethod') ?? 'COD') }

  try {
    await apiFetch('/order', { auth: true, body: { shop_order_ids: shopOrderIds, user_address, user_payment } })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not place your order') }
  }
  revalidatePath('/orders')
  redirect('/orders')
}

export async function cancelOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = String(formData.get('orderId') ?? '')
  if (!orderId) return { ok: false, message: 'Missing order id' }
  try {
    await apiFetch(`/order/${orderId}/cancel`, { method: 'PATCH', auth: true, body: {} })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not cancel the order') }
  }
  revalidatePath('/orders')
  return { ok: true, message: 'Order cancelled' }
}
```

- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** (commit by controller.)

---

### Task 4: Checkout wizard

**File:** Create `components/store/checkout-wizard.tsx`.

- [ ] **Step 1:**
```tsx
'use client'
import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { placeOrderAction } from '@/actions/order.actions'
import { initialActionState } from '@/actions/state'
import { toPriceString } from '@/lib/products/price'
import { SubmitButton } from '@/components/auth/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CheckoutOrder, OrderProduct, ShopOrderItem } from '@/types/order'

export function CheckoutWizard({
  shopOrderIds,
  review,
  lines,
}: {
  shopOrderIds: ShopOrderItem[]
  review: CheckoutOrder
  lines: OrderProduct[]
}) {
  const [step, setStep] = useState(0)
  const [address, setAddress] = useState({ street: '', city: '', state: '', country: '' })
  const [method, setMethod] = useState('COD')
  const [state, formAction] = useActionState(placeOrderAction, initialActionState)

  useEffect(() => {
    if (!state.ok && state.message) toast.error(state.message)
  }, [state])

  const addressComplete = address.street && address.city && address.state && address.country
  const set = (k: keyof typeof address) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [k]: e.target.value }))

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          {step === 0 ? 'Review your order' : step === 1 ? 'Shipping & payment' : 'Confirm'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.productId} className="flex items-center gap-3 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.thumb} alt={l.name} className="h-12 w-12 rounded border object-cover" />
                  <span className="flex-1">{l.name}</span>
                  <span className="text-muted-foreground">× {l.quantity}</span>
                  <span className="tabular-nums">{toPriceString(l.price)}</span>
                </div>
              ))}
            </div>
            <dl className="space-y-1 border-t pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{toPriceString(review.totalPrice)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">−{toPriceString(review.totalDiscount)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd className="tabular-nums">{toPriceString(review.feeShip)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular-nums">{toPriceString(review.totalCheckout)}</dd></div>
            </dl>
            <Button onClick={() => setStep(1)}>Continue</Button>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="street">Street</Label><Input id="street" value={address.street} onChange={set('street')} /></div>
              <div className="space-y-2"><Label htmlFor="city">City</Label><Input id="city" value={address.city} onChange={set('city')} /></div>
              <div className="space-y-2"><Label htmlFor="state">State</Label><Input id="state" value={address.state} onChange={set('state')} /></div>
              <div className="space-y-2"><Label htmlFor="country">Country</Label><Input id="country" value={address.country} onChange={set('country')} /></div>
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COD">Cash on delivery</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="MOMO">MoMo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={() => setStep(2)} disabled={!addressComplete}>Continue</Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="shop_order_ids" value={JSON.stringify(shopOrderIds)} />
            <input type="hidden" name="street" value={address.street} />
            <input type="hidden" name="city" value={address.city} />
            <input type="hidden" name="state" value={address.state} />
            <input type="hidden" name="country" value={address.country} />
            <input type="hidden" name="paymentMethod" value={method} />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Ship to</p>
              <p className="text-muted-foreground">{address.street}, {address.city}, {address.state}, {address.country}</p>
              <p className="text-muted-foreground">Payment: {method}</p>
            </div>
            <p className="text-lg font-semibold tabular-nums">Total {toPriceString(review.totalCheckout)}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
              <SubmitButton>Place order</SubmitButton>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** (commit by controller.)

---

### Task 5: Order card

**File:** Create `components/store/order-card.tsx`.

- [ ] **Step 1:**
```tsx
'use client'
import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { cancelOrderAction } from '@/actions/order.actions'
import { initialActionState } from '@/actions/state'
import { toPriceString } from '@/lib/products/price'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Order, OrderProduct } from '@/types/order'

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'cancelled' || status === 'failed') return 'destructive'
  if (status === 'pending') return 'default'
  return 'secondary'
}

function formatDate(s?: string): string {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

export function OrderCard({ order }: { order: Order }) {
  const [state, formAction] = useActionState(cancelOrderAction, initialActionState)
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message)
    else if (!state.ok && state.message) toast.error(state.message)
  }, [state])

  const products: OrderProduct[] = order.order_products.flatMap((s) => s.item_products)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Badge variant={statusVariant(order.order_status)}>{order.order_status}</Badge>
          <span className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</span>
        </div>
        <span className="font-semibold tabular-nums">{toPriceString(order.order_checkout?.totalCheckout ?? 0)}</span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.productId} className="flex items-center gap-3 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt={p.name} className="h-10 w-10 rounded border object-cover" />
              <span className="flex-1">{p.name}</span>
              <span className="text-muted-foreground">× {p.quantity}</span>
              <span className="tabular-nums">{toPriceString(p.price)}</span>
            </div>
          ))}
        </div>
        {order.order_status === 'pending' ? (
          <form action={formAction}>
            <input type="hidden" name="orderId" value={order._id} />
            <Button type="submit" variant="outline" size="sm">Cancel order</Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** (commit by controller.)

---

### Task 6: Checkout page

**File:** Create `app/(store)/checkout/page.tsx`.

- [ ] **Step 1:**
```tsx
import Link from 'next/link'
import { apiFetch } from '@/lib/api/server-client'
import { buildShopOrders } from '@/lib/checkout/build-shop-orders'
import { CheckoutWizard } from '@/components/store/checkout-wizard'
import type { Cart } from '@/types/cart'
import type { CheckoutReview } from '@/types/order'

export default async function CheckoutPage() {
  let cart: Cart = { cart_products: [], cart_count_product: 0 }
  try {
    cart = await apiFetch<Cart>('/cart', { auth: true })
  } catch (e) {
    return <p className="text-sm text-destructive">{e instanceof Error ? e.message : 'Could not load your cart'}</p>
  }

  const items = cart.cart_products ?? []
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Your cart is empty. <Link href="/" className="text-primary hover:underline">Browse products</Link>
      </p>
    )
  }

  const shopOrderIds = buildShopOrders(items)
  let review: CheckoutReview
  try {
    review = await apiFetch<CheckoutReview>('/checkout/review', { auth: true, body: { shop_order_ids: shopOrderIds } })
  } catch (e) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <p className="text-sm text-destructive">{e instanceof Error ? e.message : 'Could not review your order'}</p>
        <Link href="/cart" className="text-sm text-primary hover:underline">← Back to cart</Link>
      </div>
    )
  }

  const lines = review.shop_order_ids_new.flatMap((s) => s.item_products)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Checkout</h1>
      <CheckoutWizard shopOrderIds={shopOrderIds} review={review.checkout_order} lines={lines} />
    </div>
  )
}
```

- [ ] **Step 2:** `pnpm typecheck && pnpm build` — route `/checkout`. **Step 3:** (commit by controller.)

---

### Task 7: Orders page

**File:** Create `app/(store)/orders/page.tsx`.

- [ ] **Step 1:**
```tsx
import Link from 'next/link'
import { apiFetch } from '@/lib/api/server-client'
import { OrderCard } from '@/components/store/order-card'
import type { Order } from '@/types/order'

interface OrdersResult { data: Order[] }

export default async function OrdersPage() {
  let orders: Order[] = []
  let error: string | null = null
  try {
    const result = await apiFetch<OrdersResult>('/order', { auth: true })
    orders = result.data ?? []
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load your orders'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Your orders</h1>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No orders yet. <Link href="/" className="text-primary hover:underline">Browse products</Link>
        </p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <OrderCard key={o._id} order={o} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2:** `pnpm typecheck && pnpm build` — route `/orders`. **Step 3:** (commit by controller.)

---

### Task 8: Cart checkout link + proxy matcher

**Files:** Modify `app/(store)/cart/page.tsx` and `proxy.ts`.

- [ ] **Step 1: proxy** — matcher:
```ts
  matcher: ['/seller/:path*', '/cart/:path*', '/checkout/:path*', '/orders/:path*'],
```

- [ ] **Step 2: cart page** — add a "Proceed to checkout" link next to the subtotal. In `app/(store)/cart/page.tsx`, add the import `import { buttonVariants } from '@/components/ui/button'` (if not present) and, in the subtotal block, add below the subtotal:
```tsx
              <Link href="/checkout" className={buttonVariants()}>Proceed to checkout</Link>
```
Place it inside the right-hand `text-right` div (below the subtotal amount) so it only renders when the cart is non-empty (that block is already inside the `items.length > 0` branch). Ensure `Link` is imported (it is).

- [ ] **Step 3:** `pnpm typecheck && pnpm build`. **Step 4:** (commit by controller.)

---

### Task 9: Full verification + STATUS + backend gap

- [ ] **Step 1:** `pnpm typecheck && pnpm lint && pnpm build` — clean; routes `/checkout`, `/orders`; `ƒ Proxy (Middleware)`. (If a stale `.next/dev/types` error appears, `rm -rf .next/dev` and re-run.)
- [ ] **Step 2:** `pnpm test:run` — on Node ≥ 20.12 all pass (prior + `buildShopOrders`). On 20.9.0 record the environmental error.
- [ ] **Step 3:** Update `docs/frontend-seller-dashboard-STATUS.md`: set U3 row to `✅ **Xong**`; add a "Đã làm — U3" section (files; checkout price/shopId validation; multi-step wizard; broken order detail/cancel + graceful handling; page-1-only orders).
- [ ] **Step 4:** Append to `docs/backend-gaps-guide.md` a new part documenting the **order detail/cancel param mismatch** (`req.params.orderId` vs route `:id`) with the fix (rename params to `:orderId` or read `req.params.id`), plus the `GET /order` ignore-paging note.
- [ ] **Step 5:** (commit by controller.)
- [ ] **Step 6: Manual smoke test (needs backend + API_KEY + a logged-in customer with cart items):**
  1. `/cart` → "Proceed to checkout" → `/checkout`.
  2. Step 0 shows items + totals; Continue → address form; fill address + method; Continue → confirm; Place order → redirected to `/orders`, order appears as `pending`, cart emptied.
  3. `/orders` lists orders with status/date/products/total. Cancel on a pending order → (until BE fix) shows the "Order not found" error; after the fix → moves to `cancelled`.
  4. `/checkout` and `/orders` while anonymous → redirected to login (proxy gate).

---

## Self-review notes (author)

- **Spec coverage:** types (T1), buildShopOrders (T2), place/cancel actions (T3), wizard (T4), order card + cancel (T5), checkout page incl. review (T6), orders page (T7), cart link + proxy (T8), verify+STATUS+gap doc (T9). Matches spec §3–§9.
- **Type consistency:** `ShopOrderItem`/`CheckoutOrder`/`CheckoutReview`/`Order`/`OrderProduct` (T1) used across T2/T4/T5/T6/T7; `buildShopOrders` return feeds the wizard's hidden `shop_order_ids` and the action's parse; action names consistent between T3 and importers; hidden field names (`shop_order_ids`,`street`,`city`,`state`,`country`,`paymentMethod`,`orderId`) match the action readers.
- **Placeholders:** all code specified. T8 gives an explicit placement instruction for the cart link rather than re-pasting the page.
- **Risk note:** cancel is wired to a backend-broken route by design (documented); it degrades to an error toast until the BE param fix — not an FE defect.
