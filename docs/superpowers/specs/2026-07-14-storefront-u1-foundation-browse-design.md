# U1 Design — Storefront Foundation + Browse

> **Milestone:** U1 of the customer storefront (the "phần user" side). See [STATUS](../../frontend-seller-dashboard-STATUS.md).
> **Branch:** `feature/frontend-seller-dashboard`
> **Date:** 2026-07-14
> **Prereq:** Seller dashboard M1–M4 done.

## 1. Goal

Give customers a public storefront to browse and search published products and view product detail, coexisting with the already-built seller dashboard. First of four customer milestones:

| Milestone | Scope |
|---|---|
| **U1 (this)** | Public store layout, home/catalog (search + pagination), product detail |
| U2 | Cart |
| U3 | Checkout + orders |
| U4 | Reviews |

Same BFF pattern as the seller side: Server Components read via `apiFetch`, tokens in httpOnly cookies, `x-api-key` never reaches the browser.

## 2. Architecture & coexistence

- The store is **public** — no login to browse. `apiFetch` calls public product endpoints **without** `auth`, so only `x-api-key` is sent (required by the backend's global apiKey middleware). No proxy change: the proxy matcher stays `['/seller/:path*']`; store routes aren't gated.
- Auth state is read **server-side only** (`getAccessPayload()`) to personalize the header (Sign in vs account). Anonymous browsing works fully.
- Coexistence with the seller dashboard: a new `app/(store)/` route group with its own layout (store header/footer). The seller area (`/seller/*`), auth (`/login`, `/signup`, `/verify-otp`), and the root layout are untouched.

```
Browser ──► Next.js (store, public) ──(x-api-key)──► Express GET /product, GET /product/:id
   header personalization: getAccessPayload() (server-only, optional)
```

## 3. Routing changes

- **`/` becomes the store home/catalog.** Currently [app/page.tsx](../../../e-commerce-nextjs/app/page.tsx) does `redirect('/seller')`. That file is **removed**; the home moves to `app/(store)/page.tsx` (route groups don't affect the URL, so this resolves to `/`).
- **`/products/[id]`** — product detail (public). Distinct path from the seller's `/seller/products`.
- **Sellers reach their dashboard** via a "Seller dashboard" link in the store header account area, shown only when the JWT `roles` include `shop`. (Previously `/` auto-redirected sellers to `/seller`; now they land on the store and click through — the correct behavior once the store is the front door.)

## 4. Files

| File | New/Modify | Responsibility |
|---|---|---|
| `app/page.tsx` | **Delete** | Root redirect removed (home moves into the store group) |
| `app/(store)/layout.tsx` | Create | Store shell: `<StoreHeader/>` + `<main>` + footer |
| `app/(store)/page.tsx` | Create | Home/catalog — Server Component, reads `?q&page` |
| `app/(store)/products/[id]/page.tsx` | Create | Product detail — Server Component |
| `components/store/store-header.tsx` | Create | Logo + search + account area (server; reads payload) |
| `components/store/search-box.tsx` | Create | Client: search input → navigates with `?q=` |
| `components/store/product-card.tsx` | Create | Grid card: thumb, name, price |
| `components/store/product-grid.tsx` | Create | Grid + prev/next pagination |
| `lib/products/catalog-query.ts` (+test) | Create | Pure `buildCatalogQuery({q,page})` → backend query string |
| `types/product.ts` | Reuse (M3) | `Product`, `ProductListResult`, `Pagination` |
| `lib/products/price.ts` | Reuse (M3) | `toPriceString` (Decimal128) |

No new shadcn components (reuse `card`, `input`, `badge`, `button`, `buttonVariants`). The seller and store **share** the product type + price helper — no duplication.

## 5. Data flow

### 5.1 Catalog (`/`)
- Reads `searchParams` `q` (keyword, optional) and `page` (default 1).
- `buildCatalogQuery({ q, page })` → `?keySearch=<q>&page=<n>&limit=12` (omits `keySearch` when `q` is empty; clamps `page` to ≥ 1). **Backend param is `keySearch`, not `q`** — the URL uses `q` for cleanliness; the helper maps it.
- `apiFetch<ProductListResult>('/product' + query)` — **no `auth`**. Backend returns only `isPublished` products, paginated `{ data, pagination }`.
- Renders `<ProductGrid items pagination baseParams>`; empty state: "No products found." (with or without a search term). Fetch error → inline message.
- `<SearchBox>` (client) submits → `router.push('/?q=<value>')` (resets to page 1).

### 5.2 Product detail (`/products/[id]`)
- `const { id } = await params`; `apiFetch<Product>('/product/' + id)` — **no `auth`** (public route).
- Renders: image gallery (`product_images`; fall back to `product_thumb`), name, `toPriceString(product_price)`, type `Badge`, `product_attributes` (key–value list), quantity/stock, description.
- Not-found / fetch error → friendly inline message + back-to-store link.
- **No "Add to cart" in U1** (cart is U2) — no dead/disabled control.
- ⚠️ Backend caveat: the wired `GET /product/:id` (`getDetailProduct`) does **not** filter to published — a direct link to a draft id would render. The repo has `getProductPublishedById` but it isn't routed. Documented as a backend gap (see [backend-gaps-guide](../../backend-gaps-guide.md) family); U1 renders what the public route returns and does not work around it.

### 5.3 Header
- `store-header.tsx` (Server Component): `const payload = await getAccessPayload()`.
  - Logo → `/`.
  - `<SearchBox>` (client child) with the current `q` as its default value.
  - Account area: anonymous → "Sign in" link (`/login`). Logged-in → the user's email, a "Seller dashboard" link (`/seller`) **iff** `roles` includes `shop`, and a Sign out button (a `<form action={logoutAction}>`, reusing the existing action). Rendered inline (no client dropdown) to keep U1 server-only.

## 6. Error handling
- Every fetch is wrapped; failures render an inline message (matching the seller list pages), never a crash.
- Reuse M1–M4 copy conventions (English, sentence case, empathetic errors).

## 7. Testing
- **Unit (pure):** `buildCatalogQuery` — empty `q` omits `keySearch`; non-empty `q` includes it (URL-encoded); `page` clamps to ≥ 1; default `limit=12`.
- No new network tests (Server Components hit the backend; covered by manual smoke test).
- ⚠️ Vitest runner still Node-blocked (20.9.0 `styleText`); tests pass on ≥ 20.12.
- Static gates: `pnpm typecheck && lint && build` clean; routes `/` and `/products/[id]` registered; the old root redirect gone.

## 8. Pitfalls
- **Backend search param is `keySearch`** — map from the URL's `q`.
- **Don't send `auth` for public browse** — the store must work anonymously; sending session headers when there's no session is harmless but unnecessary, and browsing must never require login.
- **`product_price` is Decimal128** — use `toPriceString`.
- **Removing `app/page.tsx`**: ensure exactly one `/` route exists (the store group's `page.tsx`); two would be a build error.
- **`searchParams`/`params` are async in Next 16** — `await` them.
- **`getAccessPayload` in the header** must tolerate anonymous (returns null) — never gate the store on it.
- **`'use server'`/`server-only`**: `store-header` uses `getAccessPayload` (server-only) so it stays a Server Component; `search-box` is the only client island.

## 9. Out of scope (later customer milestones)
- Cart (U2), checkout + orders (U3), reviews (U4).
- Add-to-cart control (U2).
- Category/facet filtering, sorting beyond the backend default.
- Customer profile/account page beyond header links.
