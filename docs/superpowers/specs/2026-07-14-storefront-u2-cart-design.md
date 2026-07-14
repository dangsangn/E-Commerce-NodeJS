# U2 Design — Cart

> **Milestone:** U2 of the customer storefront. See [STATUS](../../frontend-seller-dashboard-STATUS.md).
> **Branch:** `feature/frontend-seller-dashboard`
> **Date:** 2026-07-14
> **Prereq:** U1 (storefront foundation + browse) done.

## 1. Goal

Let a logged-in customer add products to a cart, view the cart, change line quantities, remove lines, and clear the cart — over the existing Express `/cart` API. Second of four customer milestones (U1 browse ✓ → **U2 cart** → U3 checkout+orders → U4 reviews).

## 2. Architecture & auth

Same BFF pattern (Server Components read, Server Actions write). Cart is **auth-only**:
- `proxy.ts` matcher gains `/cart/:path*` → reaching `/cart` requires login (reuses the `/seller` login-redirect + token-refresh path). The shop-role gate (`shouldGateShop`) stays `/seller`-only, so `/cart` needs only a session, not the `shop` role.
- The add-to-cart Server Action runs from the **public** product page, so it checks the session itself: anonymous → `redirect('/login?redirect=/products/<id>')` (reuses the existing login `?redirect`).

## 3. Backend contract (verified in source)

All routes under `authentication`.
- `GET /cart` → `{ cart_products: CartProduct[], cart_count_product: number, cart_state, ... }`. If the user has no cart: `{ cart_products: [], cart_count_product: 0 }`. `CartProduct = { productId, shopId, name, thumb, price, quantity }` (`price` stored as Number).
- `POST /cart` body `{ productId, quantity }` → adds/increments. Validates the product is **published** and stock ≥ requested (`getProductPublishedById`); errors: `'Product not found or not published!'`, `'Product quantity is not enough!'`. Returns the cart. Status 201.
- `PATCH /cart/quantity` body `{ productId, oldQuantity, newQuantity }` → **optimistic concurrency**: the update only applies if the stored quantity equals `oldQuantity`, else `ConflictRequestError('Cart was updated by other request. Please request and try again')`. `newQuantity === 0` removes the line. Stock-checked (`'Only N items in stock'`).
- `DELETE /cart` **with a JSON body** `{ productId, oldQuantity }` → remove a line (CAS, same conflict error).
- `DELETE /cart/clear` → delete the whole cart.

**Consequences for the FE:**
1. Every mutation carries the line's current `quantity` as `oldQuantity`. After each mutation the action `revalidatePath('/cart')`, so the page re-fetches and the displayed quantities re-sync to the server — a conflict just means the toast shows the backend message and the refetch corrects the view.
2. `apiFetch` must send a **body on DELETE** — it already serializes `body` for any method when `method` is set explicitly.

## 4. Files

| File | New/Modify | Responsibility |
|---|---|---|
| `types/cart.ts` | Create | `Cart`, `CartProduct` |
| `lib/products/price.ts` | Modify | + `toPriceNumber(value)` (additive; numeric coercion for math) |
| `lib/cart/summary.ts` (+test) | Create | `cartSubtotal(products)` — pure |
| `actions/cart.actions.ts` | Create | `addToCartAction`, `updateCartQuantityAction`, `removeFromCartAction`, `clearCartAction` |
| `components/store/add-to-cart.tsx` | Create | Client: quantity + "Add to cart" (product detail) |
| `components/store/cart-line.tsx` | Create | Client: − / + stepper + remove |
| `app/(store)/cart/page.tsx` | Create | Cart page — Server Component (auth) |
| `components/store/store-header.tsx` | Modify | + cart icon + `cart_count_product` badge |
| `app/(store)/products/[id]/page.tsx` | Modify | + `<AddToCart productId quantityAvailable/>` |
| `proxy.ts` | Modify | matcher += `'/cart/:path*'` |
| STATUS.md | Modify | Mark U2 done |

Reuses U1/M3 `types/product`, `toPriceString`. No new shadcn; cart/icon via lucide `ShoppingCart` (already the icon lib).

## 5. Key behaviors

### 5.1 Add to cart (`add-to-cart.tsx`, on the public product detail page)
- Client: a small quantity `<input type="number" min=1>` (default 1) + "Add to cart" via `useActionState(addToCartAction)`; toast on result.
- `addToCartAction(prev, formData)`: read `productId`, `quantity`. `getClientId()` → if absent, `redirect('/login?redirect=/products/' + productId)`. Else `POST /cart { productId, quantity }` with `auth:true`; on success `revalidatePath('/cart')` + `{ ok:true, message:'Added to cart' }`; on error `{ ok:false, message: errorMessage(...) }` (stock/publish messages surface).

### 5.2 Cart page (`/cart`)
- Server Component: `GET /cart` (auth). Renders each product as `<CartLine>`, a subtotal via `cartSubtotal(cart_products)`, and a Clear-cart form (`clearCartAction`). Empty state: "Your cart is empty." + a link to `/`.
- Fetch failure → inline message.
- No "Proceed to checkout" (U3).

### 5.3 Cart line (`cart-line.tsx`, client)
- Props `{ productId, name, thumb, price, quantity }`.
- Renders thumb, name, unit price, a stepper (`−` sets `newQuantity = quantity-1`; `+` sets `quantity+1`), the current quantity, a line total (`price × quantity`), and a Remove control.
- `−`/`+` post to `updateCartQuantityAction` (hidden `productId`, `oldQuantity=quantity`, `newQuantity`); Remove posts to `removeFromCartAction` (hidden `productId`, `oldQuantity=quantity`). `−` at quantity 1 sends `newQuantity=0` → backend removes the line (acceptable UX; Remove is also available).
- Uses `useActionState` for the update path and the remove path; `useEffect` toasts any error. Success needs no toast — the `revalidatePath('/cart')` re-render is the feedback.

### 5.4 Header badge (`store-header.tsx`)
- When `payload` exists, fetch `GET /cart` (try/catch; default count 0 on failure) and render a `ShoppingCart` icon linking to `/cart` with a small badge showing `cart_count_product` (hidden when 0). Anonymous: the icon still links to `/cart` (→ login on click), no badge.
- `apiFetch` is `no-store`, so the badge is fresh on every navigation.

## 6. Error handling
- Actions catch `ApiError` → `{ ok, message }` → toast. Conflict, stock, and not-published messages surface verbatim (all actionable).
- The header cart fetch never throws up to the page (try/catch → count 0).

## 7. Testing
- **Unit (pure):** `cartSubtotal` — sums `price × quantity` across mixed number/`{$numberDecimal}` prices; empty cart → 0. `toPriceNumber` — number / string / Decimal128 / garbage → finite number (0 fallback).
- No network tests for actions.
- ⚠️ Vitest runner still Node-blocked (20.9.0 `styleText`); tests pass on ≥ 20.12.
- Static gates typecheck/lint/build clean; new route `/cart`; proxy matcher includes `/cart`.

## 8. Pitfalls (verified)
- **Send `oldQuantity` on update/remove** — the backend CAS rejects mismatches; the post-mutation `revalidatePath('/cart')` re-syncs the view so retries use fresh values.
- **DELETE carries a JSON body** (`productId`, `oldQuantity`) — pass `method:'DELETE'` + `body` to `apiFetch`.
- **Add-to-cart from a public page** — the action must detect anonymous and redirect to login; the page itself isn't gated.
- **`price` may serialize as Decimal128 or Number** — use `toPriceNumber`/`toPriceString`, never raw arithmetic on the field.
- **Header cart fetch adds one backend call per store page** — acceptable; must be try/catch so it can't break the layout.
- **Known limitation (accepted):** after adding while staying on the product page, the header badge updates on the next navigation, not instantly (no client cart context in U2 — YAGNI).
- **`'use server'` files export only async functions**; types in `types/cart.ts`, helpers in `lib/`.

## 9. Out of scope
- Checkout + place order + order history (U3); reviews (U4).
- Client-side cart context / instant badge updates.
- Multi-select bulk remove, save-for-later, per-shop grouping.
