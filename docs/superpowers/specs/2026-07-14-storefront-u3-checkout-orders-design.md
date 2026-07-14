# U3 Design — Checkout + Orders

> **Milestone:** U3 of the customer storefront. See [STATUS](../../frontend-seller-dashboard-STATUS.md).
> **Branch:** `feature/frontend-seller-dashboard`
> **Date:** 2026-07-14
> **Prereq:** U1 (browse) + U2 (cart) done.

## 1. Goal

Let a logged-in customer check out the cart (review totals → enter address/payment → place order) and view order history with the ability to cancel a pending order — over the Express `/checkout` and `/order` APIs. Third customer milestone (U1 ✓ U2 ✓ → **U3** → U4 reviews).

## 2. Architecture & auth

Same BFF pattern. Checkout + orders are **auth-only**: `proxy.ts` matcher gains `/checkout/:path*` and `/orders/:path*` (login required; shop-role gate stays `/seller`-only). Checkout is a **single `/checkout` route with a client 3-step wizard** (review → address → confirm) — multi-step UX without multi-route state juggling. The page fetches the cart + runs the review server-side; the wizard collects address/payment and posts the order.

## 3. Backend contract (verified in source)

- `POST /checkout/review` (auth) body `{ shop_order_ids: ShopOrderItem[] }` where `ShopOrderItem = { shopId, shop_discounts: [{code,shopId}], item_products: [{ productId, quantity, price }] }`. Returns `{ shop_order_ids, shop_order_ids_new: [{ shopId, item_products:[{productId,price,quantity,name,thumb}], price_raw, price_apply_discount }], checkout_order: { totalPrice, totalDiscount, feeShip, totalCheckout } }`.
  - **Server re-validates price**: `item.price !== Number(product.product_price)` → `'Product <name> price has changed. Please refresh.'`. **`shopId` must equal `product.product_shop`** → else `'... does not belong to this shop'`. Both come straight from the cart's stored `price`/`shopId`.
  - Idempotent, no side effects (review passes `isView=true` so discount usage isn't incremented).
- `POST /order` (auth) body `{ shop_order_ids, user_address: {street,city,state,country}, user_payment: {method} }` → re-runs review, reserves inventory atomically (`$gte`+`$inc`; out-of-stock → `'Product <name> is out of stock...'`), creates the order (status `pending`), removes ordered items from the cart, returns the order. Status 201.
- `GET /order` (auth) → `{ data: Order[], pagination }`. ⚠️ The controller passes only `userId` (ignores `page`/`limit` query) → always page 1, default limit 10. `Order = { _id, order_userId, order_checkout:{totalPrice,totalDiscount,feeShip,totalCheckout}, order_shipping, order_payment, order_products: ShopOrderNew[], order_status, createdAt }`.
- ⚠️ **`GET /order/:id` and `PATCH /order/:id/cancel` are broken**: the controller reads `req.params.orderId`, but the routes are declared with `:id` → `orderId` is `undefined` → always `'Order not found'`. FE wires cancel to the real route (`PATCH /order/<id>/cancel`); it will surface that error until the backend is fixed. **No `/orders/[id]` detail page** is built (that route is equally broken); order history renders full detail from the working list.

### `ORDER_STATUS`
`pending | confirmed | shipping | delivered | cancelled | failed`. Only `pending` orders are cancellable.

## 4. Files

| File | New/Modify | Responsibility |
|---|---|---|
| `types/order.ts` | Create | `Order`, `OrderProduct`, `ShopOrderItem`, `CheckoutReview`, `ORDER_STATUSES` |
| `lib/checkout/build-shop-orders.ts` (+test) | Create | Pure: group `CartProduct[]` → `ShopOrderItem[]` |
| `actions/order.actions.ts` | Create | `placeOrderAction`, `cancelOrderAction` |
| `components/store/checkout-wizard.tsx` | Create | Client 3-step wizard |
| `components/store/order-card.tsx` | Create | Client: order card + cancel |
| `app/(store)/checkout/page.tsx` | Create | Server: cart → shop_order_ids → review → wizard |
| `app/(store)/orders/page.tsx` | Create | Server: `GET /order` → order cards |
| `app/(store)/cart/page.tsx` | Modify | + "Proceed to checkout" link |
| `proxy.ts` | Modify | matcher += `/checkout/:path*`, `/orders/:path*` |
| STATUS.md, backend-gaps-guide.md | Modify | U3 done + order param-mismatch gap |

Reuses `toPriceString`/`toPriceNumber`, `CartProduct`. No new shadcn (payment method uses the existing `Select`).

## 5. Key behaviors

### 5.1 `/checkout` page (server)
1. `GET /cart` (auth). Empty cart → "Your cart is empty" + browse link.
2. `buildShopOrders(cart.cart_products)` → `ShopOrderItem[]` (group by `shopId`; `shop_discounts: []`; each item `{ productId, quantity, price: toPriceNumber(cartPrice) }`).
3. `POST /checkout/review { shop_order_ids }`. On error (price changed / not published / shop mismatch) → show the message + "Back to cart" (the cart may be stale; the user re-adds).
4. Render `<CheckoutWizard shopOrderIds={...} review={checkout_order} lines={flattened shop_order_ids_new items} />`.

### 5.2 `<CheckoutWizard>` (client, `useState` step 0–2)
- **Step 0 — Review:** line items (thumb/name/qty/price) + totals (`totalPrice`, `totalDiscount`, `feeShip`, `totalCheckout`). "Continue".
- **Step 1 — Address:** `street`, `city`, `state`, `country` inputs + payment method `<Select>` (`COD`/`CARD`/`MOMO`, default `COD`). "Back" / "Continue" (require the 4 address fields non-empty client-side).
- **Step 2 — Confirm:** summary + `<form action={placeOrderFormAction}>` with hidden `shop_order_ids` (JSON), `street`/`city`/`state`/`country`, `paymentMethod`. `SubmitButton` "Place order". Toast on error.
- `placeOrderAction`: parse hidden fields; `POST /order { shop_order_ids, user_address, user_payment:{method} }`; on success `revalidatePath('/orders')` + `redirect('/orders')`; on error `{ ok:false, message }`.

### 5.3 `/orders` page (server) + `<OrderCard>`
- `GET /order` → `data`. Empty → "No orders yet." + browse link.
- `<OrderCard>` (client, for the cancel action): status `Badge` (color by status: pending=default, confirmed/shipping=secondary, delivered=success-ish, cancelled/failed=destructive), created date, flattened `order_products[].item_products` (thumb/name/qty/`toPriceString(price)`), and `order_checkout.totalCheckout`. If `order_status === 'pending'`, a Cancel button (`cancelOrderAction`, hidden `orderId`) → `revalidatePath('/orders')` + toast; surfaces the backend error until the param fix.

### 5.4 Cart → checkout
- `/cart` gains a "Proceed to checkout" `<Link>` to `/checkout` (only when the cart is non-empty), next to the subtotal. (U2 deliberately omitted this; U3 adds it.)

## 6. Error handling
- Actions catch `ApiError` → `{ ok, message }` → toast. Price-changed, out-of-stock, and cancel errors surface verbatim.
- Review failure on `/checkout` renders inline with a route back to the cart.

## 7. Testing
- **Unit (pure):** `buildShopOrders` — single shop; multiple shops grouped correctly; `productId`/`quantity`/`price` carried through (price via `toPriceNumber`); empty cart → `[]`.
- No network tests for actions.
- ⚠️ Vitest runner still Node-blocked (20.9.0); tests pass on ≥ 20.12.
- Static gates clean; new routes `/checkout`, `/orders`; matcher includes both.

## 8. Pitfalls (verified)
- **Item `price` must equal `Number(product_price)`** and **`shopId` must match the product's shop** — build both from the cart; surface the "price has changed" message rather than silently retrying.
- **Order detail + cancel are backend-broken** (`req.params.orderId` vs route `:id`) — don't build a detail page; wire cancel to the real route and let it degrade; document the fix.
- **`GET /order` ignores paging** — show page 1 only; note it.
- **Multi-step is client-only state** — no route/URL state; the wizard holds address/step in `useState`, posts everything in the confirm form.
- **`shop_order_ids` flows page → wizard prop → hidden JSON field → action** (same pattern as M3 create images).
- **`'use server'` files export only async functions**; types in `types/order.ts`, helpers in `lib/`.

## 9. Backend gap to document (append to backend-gaps-guide.md)
**Order detail & cancel param mismatch** — `src/features/order/controller/index.ts` reads `req.params.orderId` in `getOrderDetail`/`cancelOrder`, but `src/features/order/routes/index.ts` declares `/:id` and `/:id/cancel`. `orderId` is `undefined` → `findById(undefined)` → `'Order not found'`. Fix: either rename the route params to `:orderId`, or read `req.params.id` in the controller. Also `getOrdersByUser` ignores `page`/`limit` query (always page 1) — thread them through if pagination is needed.

## 10. Out of scope
- Reviews (U4).
- Discount codes at checkout (deferred — send empty `shop_discounts`).
- Order-status transitions from the customer side beyond cancel; seller order management.
- Real payment integration (method is a snapshot field only).
- Order pagination beyond page 1 (backend limitation).
