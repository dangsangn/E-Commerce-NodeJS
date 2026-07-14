# U1 — Storefront Foundation + Browse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A public customer storefront — home/catalog (search + pagination) and product detail — coexisting with the seller dashboard. Browsing needs no login.

**Architecture:** BFF pattern from M1–M4. New `app/(store)/` route group with its own layout. Server Components read via `apiFetch` **without `auth`** (public product endpoints). Auth state read server-side only to personalize the header.

**Tech Stack:** Next.js 16, React 19, TS, Tailwind v4, shadcn/ui (Base UI). No new shadcn components — reuse `card`, `input`, `badge`, `button`.

**Spec:** [2026-07-14-storefront-u1-foundation-browse-design.md](../specs/2026-07-14-storefront-u1-foundation-browse-design.md)

**Working directory:** `e-commerce-nextjs/`.

## Context every task needs

- **Reuse:** `apiFetch<T>(path, opts?)`/`ApiError` (`lib/api/server-client.ts`) — call **without** `auth` for public browse (sends only `x-api-key`); `getAccessPayload` (`lib/auth/session.ts`); `logoutAction` (`actions/auth.actions.ts`); `toPriceString` (`lib/products/price.ts`); `Product`/`ProductListResult`/`Pagination` (`types/product.ts`); UI from `components/ui/`: `Card*`, `Input`, `Label`, `Badge`, `Button`, `buttonVariants`.
- **Backend facts (verified):**
  - `GET /product?keySearch=<q>&page=<n>&limit=<n>` (public) → `{ data: Product[], pagination: {...} }`, published only. **Param is `keySearch`, not `q`.**
  - `GET /product/:id` (public) → full `Product` (no published filter — draft ids render; documented caveat, not worked around).
  - Both require `x-api-key` (global middleware) — `apiFetch` sends it automatically.
- **Conventions:** English copy, sentence case, empathetic errors. `searchParams`/`params` are async (`await`). Server Components by default; mark client islands `'use client'`.
- **Vitest runner** blocked on Node 20.9.0 (`styleText`); when a test step's runner won't start, run `pnpm typecheck` and note it.
- **Git:** controller session handles commits; implement + verify, don't commit unless asked. Never touch `.agents/`/`skills-lock.json`.
- **Route groups:** `app/(store)/page.tsx` resolves to `/`. `app/page.tsx` must be deleted so there's exactly one `/`.

## File structure

| File | Responsibility |
|---|---|
| `app/page.tsx` | **Delete** (root redirect removed) |
| `lib/products/catalog-query.ts` (+test) | Pure `buildCatalogQuery` |
| `components/store/search-box.tsx` | Client search input |
| `components/store/product-card.tsx` | Grid card |
| `components/store/product-grid.tsx` | Grid + pagination |
| `components/store/store-header.tsx` | Header (server) |
| `app/(store)/layout.tsx` | Store shell |
| `app/(store)/page.tsx` | Catalog |
| `app/(store)/products/[id]/page.tsx` | Product detail |
| STATUS.md | Add U1 done + storefront roadmap |

---

### Task 1: Catalog query helper

**Files:** Create `lib/products/catalog-query.ts`, `lib/products/__tests__/catalog-query.test.ts`.

- [ ] **Step 1: Write the failing test:**
```ts
import { describe, it, expect } from 'vitest'
import { buildCatalogQuery } from '@/lib/products/catalog-query'

describe('buildCatalogQuery', () => {
  it('omits keySearch when q is empty', () => {
    expect(buildCatalogQuery({ page: 1 })).toBe('?page=1&limit=12')
    expect(buildCatalogQuery({ q: '', page: 1 })).toBe('?page=1&limit=12')
  })
  it('includes url-encoded keySearch when q is present', () => {
    expect(buildCatalogQuery({ q: 'red shirt', page: 1 })).toBe('?page=1&limit=12&keySearch=red%20shirt')
  })
  it('clamps page to at least 1', () => {
    expect(buildCatalogQuery({ page: 0 })).toBe('?page=1&limit=12')
    expect(buildCatalogQuery({ page: -5 })).toBe('?page=1&limit=12')
  })
  it('defaults page to 1 when missing', () => {
    expect(buildCatalogQuery({})).toBe('?page=1&limit=12')
  })
})
```

- [ ] **Step 2:** Run `pnpm vitest run lib/products/__tests__/catalog-query.test.ts` (expect module-not-found or environmental error).

- [ ] **Step 3: Implement** — `lib/products/catalog-query.ts`:
```ts
export const CATALOG_PAGE_SIZE = 12

export function buildCatalogQuery({ q, page }: { q?: string; page?: number }): string {
  const p = Number.isFinite(page) && (page as number) >= 1 ? Math.floor(page as number) : 1
  const params = new URLSearchParams()
  params.set('page', String(p))
  params.set('limit', String(CATALOG_PAGE_SIZE))
  const trimmed = (q ?? '').trim()
  if (trimmed) params.set('keySearch', trimmed)
  return `?${params.toString()}`
}
```

> `URLSearchParams` encodes a space as `+` by default in some environments and `%20` in others; `toString()` uses `+`. The test expects `%20`. To guarantee `%20`, build the string explicitly instead of `URLSearchParams`:
```ts
export const CATALOG_PAGE_SIZE = 12

export function buildCatalogQuery({ q, page }: { q?: string; page?: number }): string {
  const p = Number.isFinite(page) && (page as number) >= 1 ? Math.floor(page as number) : 1
  let s = `?page=${p}&limit=${CATALOG_PAGE_SIZE}`
  const trimmed = (q ?? '').trim()
  if (trimmed) s += `&keySearch=${encodeURIComponent(trimmed)}`
  return s
}
```
Use the second (explicit) implementation — `encodeURIComponent('red shirt') === 'red%20shirt'`, matching the test.

- [ ] **Step 4:** Re-run test (4 pass) or `pnpm typecheck`. **Step 5:** (commit by controller.)

---

### Task 2: Search box (client)

**File:** Create `components/store/search-box.tsx`.

- [ ] **Step 1:**
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'

export function SearchBox({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter()
  return (
    <form
      className="w-full max-w-sm"
      action={(formData) => {
        const q = String(formData.get('q') ?? '').trim()
        router.push(q ? `/?q=${encodeURIComponent(q)}` : '/')
      }}
    >
      <Input name="q" type="search" placeholder="Search products…" defaultValue={defaultValue} aria-label="Search products" />
    </form>
  )
}
```

> Using a form `action` with a function is a client-action pattern (React 19) — on submit it navigates. Pressing Enter in the input submits. No submit button needed (keeps the header compact); the placeholder + Enter is the affordance.

- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** (commit by controller.)

---

### Task 3: Product card + grid

**Files:** Create `components/store/product-card.tsx` and `components/store/product-grid.tsx`.

- [ ] **Step 1: `product-card.tsx`:**
```tsx
import Link from 'next/link'
import { toPriceString } from '@/lib/products/price'
import { Badge } from '@/components/ui/badge'
import type { Product } from '@/types/product'

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product._id}`}
      className="group flex flex-col overflow-hidden rounded-lg border transition-colors hover:bg-muted/40"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={product.product_thumb} alt={product.product_name} className="aspect-square w-full object-cover" />
      <div className="space-y-1 p-3">
        <p className="line-clamp-1 font-medium">{product.product_name}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm">{toPriceString(product.product_price)}</span>
          <Badge variant="secondary">{product.product_type}</Badge>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: `product-grid.tsx`** (grid + prev/next pagination via `?q=&page=` links):
```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { ProductCard } from '@/components/store/product-card'
import type { Pagination, Product } from '@/types/product'

function pageHref(q: string, page: number): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (page > 1) params.set('page', String(page))
  const s = params.toString()
  return s ? `/?${s}` : '/'
}

export function ProductGrid({ items, pagination, q }: { items: Product[]; pagination: Pagination; q: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No products found.</p>
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
      {pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</span>
          <div className="flex gap-2">
            <Link
              href={pageHref(q, pagination.page - 1)}
              aria-disabled={!pagination.hasPreviousPage}
              className={cn(buttonVariants({ variant: 'outline' }), !pagination.hasPreviousPage && 'pointer-events-none opacity-50')}
            >
              Previous
            </Link>
            <Link
              href={pageHref(q, pagination.page + 1)}
              aria-disabled={!pagination.hasNextPage}
              className={cn(buttonVariants({ variant: 'outline' }), !pagination.hasNextPage && 'pointer-events-none opacity-50')}
            >
              Next
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3:** `pnpm typecheck`. **Step 4:** (commit by controller.)

---

### Task 4: Store header

**File:** Create `components/store/store-header.tsx`.

- [ ] **Step 1:**
```tsx
import Link from 'next/link'
import { getAccessPayload } from '@/lib/auth/session'
import { logoutAction } from '@/actions/auth.actions'
import { buttonVariants } from '@/components/ui/button'
import { SearchBox } from '@/components/store/search-box'

export async function StoreHeader({ q = '' }: { q?: string }) {
  const payload = await getAccessPayload()
  const isShop = Boolean(payload?.roles?.includes('shop'))
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold">SHOP</Link>
        <div className="flex-1">
          <SearchBox defaultValue={q} />
        </div>
        <nav className="flex items-center gap-3 text-sm">
          {payload ? (
            <>
              {isShop ? (
                <Link href="/seller" className="text-muted-foreground hover:text-foreground">Seller dashboard</Link>
              ) : null}
              <span className="hidden text-muted-foreground sm:inline">{payload.email}</span>
              <form action={logoutAction}>
                <button type="submit" className="text-muted-foreground hover:text-foreground">Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className={buttonVariants({ variant: 'outline' })}>Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 2:** `pnpm typecheck`. Self-check: does it tolerate `payload === null` (anonymous)? Yes — renders "Sign in". **Step 3:** (commit by controller.)

---

### Task 5: Store layout + delete root redirect

**Files:** Create `app/(store)/layout.tsx`; delete `app/page.tsx`.

- [ ] **Step 1: Delete** `app/page.tsx` (`rm app/page.tsx` or via the editor). The store group provides `/`.

- [ ] **Step 2: Create `app/(store)/layout.tsx`.** The header needs the current `q` to prefill the search box, but a layout does not receive `searchParams`. Keep it simple: the layout renders the header without `q` prefill (the catalog page's own search state lives in the URL; prefilling is a nice-to-have, not required). Render the header with an empty default.
```tsx
import { StoreHeader } from '@/components/store/store-header'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      {/* @ts-expect-error Async Server Component */}
      <StoreHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">© Shop</div>
      </footer>
    </div>
  )
}
```

> If your Next/TS setup renders async Server Components in a layout without complaint, drop the `@ts-expect-error` line. Next 16 + React 19 supports async components as children; the directive is a guard only if the type checker flags it. Verify during typecheck and remove if unused (an unused `@ts-expect-error` is itself a TS error).

- [ ] **Step 3:** `pnpm typecheck`. If the `@ts-expect-error` is reported as unused, remove that line. **Step 4:** (commit by controller.)

---

### Task 6: Catalog page (`/`)

**File:** Create `app/(store)/page.tsx`.

- [ ] **Step 1:**
```tsx
import { apiFetch } from '@/lib/api/server-client'
import { buildCatalogQuery } from '@/lib/products/catalog-query'
import { ProductGrid } from '@/components/store/product-grid'
import type { ProductListResult } from '@/types/product'

export default async function StoreHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1
  const query = buildCatalogQuery({ q, page })

  let result: ProductListResult = {
    data: [],
    pagination: { total: 0, page, limit: 12, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
  }
  let error: string | null = null
  try {
    result = await apiFetch<ProductListResult>(`/product${query}`)
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load products'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{q ? `Results for “${q}”` : 'All products'}</h1>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <ProductGrid items={result.data} pagination={result.pagination} q={q} />
      )}
    </div>
  )
}
```

- [ ] **Step 2:** `pnpm typecheck && pnpm build` — expect route `○ /` (or `ƒ /`). **Step 3:** (commit by controller.)

---

### Task 7: Product detail page (`/products/[id]`)

**File:** Create `app/(store)/products/[id]/page.tsx`.

- [ ] **Step 1:**
```tsx
import Link from 'next/link'
import { apiFetch } from '@/lib/api/server-client'
import { toPriceString } from '@/lib/products/price'
import { Badge } from '@/components/ui/badge'
import type { Product } from '@/types/product'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let product: Product | null = null
  let error: string | null = null
  try {
    product = await apiFetch<Product>(`/product/${id}`)
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load the product'
  }

  if (error || !product) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-sm text-primary hover:underline">← Back to store</Link>
        <p className="text-sm text-destructive">{error ?? 'Product not found'}</p>
      </div>
    )
  }

  const gallery = product.product_images?.length ? product.product_images : [{ url: product.product_thumb, public_id: 'thumb' }]
  const attrs = product.product_attributes ?? {}

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-primary hover:underline">← Back to store</Link>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="grid grid-cols-2 gap-2">
          {gallery.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.public_id} src={img.url} alt={product!.product_name} className="aspect-square w-full rounded-md border object-cover" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{product.product_name}</h1>
            <Badge variant="secondary">{product.product_type}</Badge>
          </div>
          <p className="text-xl">{toPriceString(product.product_price)}</p>
          <p className="text-sm text-muted-foreground">In stock: {product.product_quantity}</p>
          {product.product_description ? <p className="text-sm">{product.product_description}</p> : null}
          {Object.keys(attrs).length > 0 ? (
            <dl className="grid grid-cols-2 gap-1 text-sm">
              {Object.entries(attrs).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground capitalize">{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2:** `pnpm typecheck && pnpm build` — expect route `ƒ /products/[id]`. **Step 3:** (commit by controller.)

---

### Task 8: Full verification + STATUS

- [ ] **Step 1:** `pnpm typecheck && pnpm lint && pnpm build` — typecheck clean; lint 0 errors; build shows `/` (store home) and `ƒ /products/[id]`, and the old `redirect('/seller')` root is gone. Confirm `/seller` still builds.
- [ ] **Step 2:** `pnpm test:run` — on Node ≥ 20.12 all pass (prior + catalog-query 4). On 20.9.0 record the environmental error.
- [ ] **Step 3:** Update `docs/frontend-seller-dashboard-STATUS.md`: add a customer-storefront roadmap note (U1–U4) and mark **U1 done** with its files and the two caveats (root `/` now = store; `GET /product/:id` returns drafts too). Update §1 overview which currently says "storefront khách hàng làm sau".
- [ ] **Step 4:** (commit by controller.)
- [ ] **Step 5: Manual smoke test (needs backend + API_KEY):**
  1. Visit `/` anonymous → published products grid; search a keyword → filtered; paginate.
  2. Click a product → `/products/[id]` shows gallery/price/attributes.
  3. Header: anonymous shows "Sign in"; after logging in as a shop, `/` shows "Seller dashboard" + "Sign out"; a non-shop customer sees email + "Sign out" only.
  4. `/seller` still works and is still gated.

---

## Self-review notes (author)

- **Spec coverage:** catalog query helper (T1), search box (T2), grid/card (T3), header with role-aware links (T4), store layout + root-redirect removal (T5), catalog page mapping q→keySearch (T6), detail page with gallery/attrs + not-found (T7), verify+STATUS+smoke (T8). Matches spec §3–§8.
- **Type consistency:** reuses `Product`/`ProductListResult`/`Pagination` from `types/product.ts` and `toPriceString` from `lib/products/price.ts` unchanged; `buildCatalogQuery`/`CATALOG_PAGE_SIZE` consistent between T1 and T6; the URL `q` param is mapped to backend `keySearch` only inside `buildCatalogQuery`.
- **Placeholders:** all code specified. The one runtime uncertainty (async Server Component in a layout needing `@ts-expect-error`) is called out with explicit remove-if-unused guidance rather than left ambiguous.
- **Risk note:** deleting `app/page.tsx` + adding `(store)/page.tsx` — verified route groups don't alter the URL, so both map `/`; keeping both would be a build error, hence the explicit delete step.
