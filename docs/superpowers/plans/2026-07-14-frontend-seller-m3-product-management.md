# M3 — Product Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shop can list, create (2-step: upload images → details), edit, publish/unpublish, and add images to products over the existing Express `/product` API.

**Architecture:** BFF pattern from M1/M2 — Server Components read, Server Actions write, tokens in httpOnly cookies, single `apiFetch` choke point. Create is a single client page holding upload result in state, then one atomic `POST /product`.

**Tech Stack:** Next.js 16, React 19, TS, Tailwind v4, shadcn/ui (`base-nova` style — **uses `@base-ui/react`, NOT Radix**), Zod, `sonner`.

**Spec:** [2026-07-14-frontend-seller-m3-product-management-design.md](../specs/2026-07-14-frontend-seller-m3-product-management-design.md)

**Working directory for all commands:** `e-commerce-nextjs/`.

---

## Context every task needs

- **Reuse (do not reinvent):** `apiFetch<T>(path, { method, body, multipart, auth, signal, tags, cache })` and `ApiError` from `lib/api/server-client.ts`; `errorMessage(e, fallback)` from `lib/api/error-message.ts`; `ActionState` + `initialActionState` from `actions/state.ts`; `SubmitButton` from `components/auth/submit-button.tsx`; `getAccessPayload`/`getClientId` from `lib/auth/session.ts`; `Card*`/`Input`/`Label`/`Button` from `components/ui/`.
- **Backend facts (verified):**
  - Multipart field name is **`images`** (array) for `/upload/prepare` and `/upload/images/:id`.
  - `/upload/prepare` returns `{ productId, images: [{url,public_id}], thumb: {url,public_id} }`.
  - `POST /product` body requires `_id`=productId, `product_thumb`=thumb.url, `product_thumb_public_id`=thumb.public_id, `product_images`=images, plus `product_name`,`product_price`(number),`product_quantity`(number),`product_type`,`product_attributes`. Every `public_id` must start with `products/{shopId}/{productId}` — so reuse prepare's output verbatim.
  - Only `CLOTHING` + `ELECTRONICS` are creatable. Clothing attrs: `brand`,`color`,`size` (req), `material` (opt). Electronics attrs: `manufacturer` (req), `model` (opt).
  - List endpoints return (after unwrap) `{ data: Product[], pagination: { total, page, limit, totalPages, hasNextPage, hasPreviousPage } }`. Status is defined by which endpoint you call; `isDraft`/`isPublished` are not in the payload.
  - `product_price` is Decimal128 → JSON `{ "$numberDecimal": "9.99" }` or string. Normalize on display; send plain number on write.
  - `GET /product/:id` is public (declared before `authentication`).
- **Conventions:** UI copy English; imperative buttons; sentence case; empathetic errors; loading ends with `…`. Test `it()` descriptions English. `'use server'` files export only async functions.
- **shadcn is Base UI:** when a task uses a shadcn component you just installed (`select`, `tabs`, `table`, `badge`, `textarea`), READ the generated file in `components/ui/` first to learn its actual exports/API — do NOT assume Radix-style names. Base UI `Select` is `Select.Root/Trigger/Value/Portal/Positioner/Popup/Item` style; the shadcn wrapper renames these.
- **Vitest runner note:** fails to start on Node 20.9.0 (`node:util` `styleText`, needs ≥20.12). When a step says run tests and the runner won't start, run `pnpm typecheck` to confirm compilation and note the environmental gap.
- **Commit** at the end of each task; end messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Never stage the untracked `.agents/` dir or `skills-lock.json`.

## File structure

| File | Responsibility |
|---|---|
| `types/product.ts` | Product/list/pagination/prepared-images types + `PRODUCT_TYPES` |
| `lib/products/price.ts` (+test) | `toPriceString` Decimal128 normalizer |
| `lib/validations/product.ts` (+test) | Zod details schema (type-discriminated) + edit schema |
| `actions/product.actions.ts` | 6 Server Actions |
| `components/ui/{table,tabs,badge,select,textarea}.tsx` | shadcn primitives |
| `components/products/attribute-fields.tsx` | Per-type attribute inputs |
| `components/products/image-uploader.tsx` | Upload section |
| `components/products/create-product-form.tsx` | Create wrapper (state) |
| `components/products/product-row-actions.tsx` | Publish toggle + edit link |
| `components/products/product-list.tsx` | Tabs + table + pagination |
| `components/products/edit-product-form.tsx` | Edit + add-images |
| `app/(seller)/seller/products/page.tsx` | List page |
| `app/(seller)/seller/products/new/page.tsx` | Create page |
| `app/(seller)/seller/products/[id]/edit/page.tsx` | Edit page |
| STATUS.md | Mark M3 done |

---

### Task 1: Product types

**Files:** Create `types/product.ts`.

- [ ] **Step 1: Create the file**

```ts
export const PRODUCT_TYPES = ['CLOTHING', 'ELECTRONICS', 'SHOES', 'OTHER'] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

// Only these two are wired in the backend factory; others are disabled in the UI.
export const CREATABLE_TYPES: ProductType[] = ['CLOTHING', 'ELECTRONICS']

export interface ProductImage {
  url: string
  public_id: string
}

// product_price arrives as Decimal128 JSON; keep it loose here and normalize on display.
export type Decimal = number | string | { $numberDecimal: string }

export interface Product {
  _id: string
  product_name: string
  product_thumb: string
  product_thumb_public_id?: string
  product_images: ProductImage[]
  product_description?: string
  product_price: Decimal
  product_quantity: number
  product_type: ProductType
  product_shop?: string
  product_attributes?: Record<string, unknown>
}

export interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface ProductListResult {
  data: Product[]
  pagination: Pagination
}

export interface PreparedImages {
  productId: string
  images: ProductImage[]
  thumb: ProductImage
}
```

- [ ] **Step 2:** `pnpm typecheck` → clean.
- [ ] **Step 3:** Commit `types/product.ts` — `feat(m3): product types`.

---

### Task 2: Price normalizer

**Files:** Create `lib/products/price.ts`, `lib/products/__tests__/price.test.ts`.

- [ ] **Step 1: Write the failing test** — `lib/products/__tests__/price.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toPriceString } from '@/lib/products/price'

describe('toPriceString', () => {
  it('formats a plain number', () => {
    expect(toPriceString(9.5)).toBe('9.50')
  })
  it('formats a Decimal128 JSON object', () => {
    expect(toPriceString({ $numberDecimal: '9.99' })).toBe('9.99')
  })
  it('formats a numeric string', () => {
    expect(toPriceString('12')).toBe('12.00')
  })
  it('falls back to 0.00 for undefined/garbage', () => {
    expect(toPriceString(undefined as unknown as number)).toBe('0.00')
    expect(toPriceString({} as never)).toBe('0.00')
  })
})
```

- [ ] **Step 2:** Run `pnpm vitest run lib/products/__tests__/price.test.ts` (expect module-not-found, or environmental startup error).

- [ ] **Step 3: Implement** — `lib/products/price.ts`:

```ts
import type { Decimal } from '@/types/product'

// Backend serializes product_price from Mongo Decimal128 as a number, a string,
// or { $numberDecimal: "9.99" }. Normalize any of them to a fixed-2 display string.
export function toPriceString(value: Decimal): string {
  let n: number
  if (typeof value === 'number') n = value
  else if (typeof value === 'string') n = Number(value)
  else if (value && typeof value === 'object' && '$numberDecimal' in value)
    n = Number(value.$numberDecimal)
  else n = NaN
  return (Number.isFinite(n) ? n : 0).toFixed(2)
}
```

- [ ] **Step 4:** Re-run test (4 pass) or `pnpm typecheck` if runner blocked.
- [ ] **Step 5:** Commit both files — `feat(m3): price normalizer`.

---

### Task 3: Validation schemas

**Files:** Create `lib/validations/product.ts`, `lib/validations/__tests__/product.test.ts`.

- [ ] **Step 1: Write the failing test** — `lib/validations/__tests__/product.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { productDetailsSchema } from '@/lib/validations/product'

const base = { product_name: 'Tee', product_price: '9.99', product_quantity: '5' }

describe('productDetailsSchema', () => {
  it('coerces numeric strings and accepts valid clothing', () => {
    const r = productDetailsSchema.safeParse({
      ...base, product_type: 'CLOTHING',
      brand: 'Acme', color: 'Red', size: 'M',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.product_price).toBe(9.99)
      expect(r.data.product_quantity).toBe(5)
    }
  })
  it('requires clothing brand/color/size', () => {
    expect(productDetailsSchema.safeParse({ ...base, product_type: 'CLOTHING', brand: 'Acme' }).success).toBe(false)
  })
  it('accepts valid electronics (manufacturer required, model optional)', () => {
    expect(productDetailsSchema.safeParse({ ...base, product_type: 'ELECTRONICS', manufacturer: 'Sony' }).success).toBe(true)
  })
  it('requires electronics manufacturer', () => {
    expect(productDetailsSchema.safeParse({ ...base, product_type: 'ELECTRONICS' }).success).toBe(false)
  })
  it('rejects a non-positive price', () => {
    expect(productDetailsSchema.safeParse({ ...base, product_price: '0', product_type: 'ELECTRONICS', manufacturer: 'Sony' }).success).toBe(false)
  })
  it('rejects a non-creatable type', () => {
    expect(productDetailsSchema.safeParse({ ...base, product_type: 'SHOES' }).success).toBe(false)
  })
})
```

- [ ] **Step 2:** Run the test (expect module-not-found or environmental error).

- [ ] **Step 3: Implement** — `lib/validations/product.ts`:

```ts
import { z } from 'zod'

const baseFields = {
  product_name: z.string().trim().min(1, 'Enter a product name'),
  product_price: z.coerce.number().positive('Price must be greater than 0'),
  product_quantity: z.coerce.number().int().min(0, 'Quantity cannot be negative'),
  product_description: z.string().trim().optional(),
}

const clothing = z.object({
  ...baseFields,
  product_type: z.literal('CLOTHING'),
  brand: z.string().trim().min(1, 'Enter a brand'),
  color: z.string().trim().min(1, 'Enter a color'),
  size: z.string().trim().min(1, 'Enter a size'),
  material: z.string().trim().optional(),
})

const electronics = z.object({
  ...baseFields,
  product_type: z.literal('ELECTRONICS'),
  manufacturer: z.string().trim().min(1, 'Enter a manufacturer'),
  model: z.string().trim().optional(),
})

export const productDetailsSchema = z.discriminatedUnion('product_type', [
  clothing,
  electronics,
])
export type ProductDetailsInput = z.infer<typeof productDetailsSchema>

// Split base fields from type-specific attribute keys for building the API body.
const ATTRIBUTE_KEYS = ['brand', 'color', 'size', 'material', 'manufacturer', 'model'] as const
export function splitAttributes(data: ProductDetailsInput) {
  const attrs: Record<string, unknown> = {}
  for (const k of ATTRIBUTE_KEYS) {
    if (k in data && (data as Record<string, unknown>)[k] !== undefined && (data as Record<string, unknown>)[k] !== '') {
      attrs[k] = (data as Record<string, unknown>)[k]
    }
  }
  return {
    product_name: data.product_name,
    product_price: data.product_price,
    product_quantity: data.product_quantity,
    product_description: data.product_description,
    product_type: data.product_type,
    product_attributes: attrs,
  }
}

// Edit form: all optional; mirrors backend updateProductSchema allowed keys.
export const productEditSchema = z.object({
  product_name: z.string().trim().min(1).optional(),
  product_description: z.string().trim().optional(),
  product_price: z.coerce.number().positive().optional(),
})
export type ProductEditInput = z.infer<typeof productEditSchema>
```

- [ ] **Step 4:** Re-run test (6 pass) or `pnpm typecheck`.
- [ ] **Step 5:** Commit both — `feat(m3): product validation schemas`.

---

### Task 4: Server Actions

**Files:** Create `actions/product.actions.ts`.

- [ ] **Step 1: Create the file**

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { apiFetch } from '@/lib/api/server-client'
import { errorMessage } from '@/lib/api/error-message'
import { getClientId } from '@/lib/auth/session'
import { productDetailsSchema, productEditSchema, splitAttributes } from '@/lib/validations/product'
import type { ActionState } from '@/actions/state'
import type { PreparedImages, ProductImage } from '@/types/product'

interface PrepareState extends ActionState {
  data?: PreparedImages
}

export async function prepareImagesAction(
  _prev: PrepareState,
  formData: FormData,
): Promise<PrepareState> {
  const files = formData.getAll('images').filter((f) => f instanceof File && f.size > 0)
  if (files.length === 0) return { ok: false, message: 'Choose at least one image' }
  try {
    const data = await apiFetch<PreparedImages>('/product/upload/prepare', {
      multipart: formData,
      auth: true,
    })
    return { ok: true, data }
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not upload images') }
  }
}

export async function createProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = productDetailsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }

  const productId = String(formData.get('productId') ?? '')
  const thumbUrl = String(formData.get('thumbUrl') ?? '')
  const thumbPublicId = String(formData.get('thumbPublicId') ?? '')
  const imagesRaw = String(formData.get('images') ?? '[]')
  if (!productId || !thumbUrl || !thumbPublicId)
    return { ok: false, message: 'Upload images before creating the product' }

  let images: ProductImage[]
  try {
    images = JSON.parse(imagesRaw)
  } catch {
    return { ok: false, message: 'Upload images before creating the product' }
  }

  const details = splitAttributes(parsed.data)
  try {
    await apiFetch('/product', {
      auth: true,
      body: {
        _id: productId,
        product_thumb: thumbUrl,
        product_thumb_public_id: thumbPublicId,
        product_images: images,
        ...details,
      },
    })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not create the product') }
  }
  revalidatePath('/seller/products')
  redirect('/seller/products')
}

export async function updateProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Missing product id' }
  const parsed = productEditSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }
  try {
    await apiFetch(`/product/${id}`, { method: 'PATCH', auth: true, body: parsed.data })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not update the product') }
  }
  revalidatePath(`/seller/products/${id}/edit`)
  revalidatePath('/seller/products')
  return { ok: true, message: 'Product updated' }
}

export async function publishProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Missing product id' }
  try {
    await apiFetch(`/product/published/${id}`, { method: 'PATCH', auth: true, body: {} })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not publish the product') }
  }
  revalidatePath('/seller/products')
  return { ok: true, message: 'Product published' }
}

export async function unpublishProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Missing product id' }
  try {
    await apiFetch(`/product/draft/${id}`, { method: 'PATCH', auth: true, body: {} })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not unpublish the product') }
  }
  revalidatePath('/seller/products')
  return { ok: true, message: 'Product moved to drafts' }
}

export async function addProductImagesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: 'Missing product id' }
  const files = formData.getAll('images').filter((f) => f instanceof File && f.size > 0)
  if (files.length === 0) return { ok: false, message: 'Choose at least one image' }
  // Backend reads multipart field `images`; strip the id field first.
  const upload = new FormData()
  for (const f of files) upload.append('images', f)
  try {
    await apiFetch(`/product/upload/images/${id}`, { method: 'PUT', multipart: upload, auth: true })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not add images') }
  }
  revalidatePath(`/seller/products/${id}/edit`)
  return { ok: true, message: 'Images added' }
}
```

> Note: `apiFetch` sets method to POST when a body/multipart is present and no `method` given; PATCH/PUT are passed explicitly above. `getClientId` isn't needed here (backend derives shop from JWT), so it's not imported — remove the import if your linter flags it. (It is NOT imported in the code above.)

- [ ] **Step 2:** `pnpm typecheck` → clean.
- [ ] **Step 3:** Commit — `feat(m3): product server actions`.

---

### Task 5: Install shadcn primitives

**Files:** generated `components/ui/{table,tabs,badge,select,textarea}.tsx`.

- [ ] **Step 1:** Run `pnpm dlx shadcn@latest add table tabs badge select textarea --yes --cwd .` (use `--cwd .` from `e-commerce-nextjs/` to avoid the "create components.json" prompt seen previously). If it still prompts to create components.json, answer `n` — the file already exists.
- [ ] **Step 2:** Confirm files exist: `ls components/ui/table.tsx components/ui/tabs.tsx components/ui/badge.tsx components/ui/select.tsx components/ui/textarea.tsx`. Then `pnpm typecheck`.
- [ ] **Step 3: READ each generated file** and record the exported names + prop API (Base UI, not Radix) in your task report, so downstream tasks use them correctly.
- [ ] **Step 4:** Commit the new UI files (+ `package.json`/lockfile if changed) — `chore(m3): add shadcn table/tabs/badge/select/textarea`.

---

### Task 6: Attribute fields component

**Files:** Create `components/products/attribute-fields.tsx`.

Renders the type-specific inputs. `'use client'`. Props: `{ type: ProductType; defaults?: Record<string, unknown> }`. For CLOTHING render Label+Input for `brand`,`color`,`size` (required) and `material` (optional); for ELECTRONICS render `manufacturer` (required) and `model` (optional); for other types render a muted "This product type isn't available yet." message. Input `name` attributes must exactly match the schema keys. Pre-fill `defaultValue` from `defaults?.[key]` (for the edit page). Use existing `Input`/`Label`.

- [ ] **Step 1: Create the file**

```tsx
'use client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ProductType } from '@/types/product'

function Field({ name, label, required, defaultValue }: { name: string; label: string; required?: boolean; defaultValue?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}{required ? '' : ' (optional)'}</Label>
      <Input id={name} name={name} required={required} defaultValue={defaultValue} />
    </div>
  )
}

export function AttributeFields({ type, defaults }: { type: ProductType; defaults?: Record<string, unknown> }) {
  const dv = (k: string) => (defaults?.[k] != null ? String(defaults[k]) : undefined)
  if (type === 'CLOTHING') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="brand" label="Brand" required defaultValue={dv('brand')} />
        <Field name="color" label="Color" required defaultValue={dv('color')} />
        <Field name="size" label="Size" required defaultValue={dv('size')} />
        <Field name="material" label="Material" defaultValue={dv('material')} />
      </div>
    )
  }
  if (type === 'ELECTRONICS') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="manufacturer" label="Manufacturer" required defaultValue={dv('manufacturer')} />
        <Field name="model" label="Model" defaultValue={dv('model')} />
      </div>
    )
  }
  return <p className="text-sm text-muted-foreground">This product type isn&apos;t available yet.</p>
}
```

- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** Commit — `feat(m3): attribute fields component`.

---

### Task 7: Image uploader + create-product wrapper

**Files:** Create `components/products/image-uploader.tsx` and `components/products/create-product-form.tsx`.

Design intent (verify Select API from Task 5's report before writing the `<Select>`):
- `image-uploader.tsx` (`'use client'`): a `<form action={formAction}>` with a multiple file input `name="images"`, a `SubmitButton` ("Upload images"), `useActionState(prepareImagesAction, { ok: false })`, toasts errors, and calls an `onPrepared(data)` callback on success (via `useEffect` watching `state.data`). Shows uploaded thumbnails (plain `<img>`).
- `create-product-form.tsx` (`'use client'`): holds `uploadResult` state and `type` state (default `'CLOTHING'`). Renders `<ImageUploader onPrepared={setUploadResult} />`, then a details `<form action={createProductAction}>` that is visually disabled (via a wrapper `<fieldset disabled={!uploadResult}>`) until `uploadResult` is set. Details form contains: hidden inputs `productId`, `thumbUrl`, `thumbPublicId`, `images` (JSON.stringify(uploadResult.images)); `product_name`, `product_price` (`type="number" step="0.01"`), `product_quantity` (`type="number"`); a type `<Select name="product_type">` listing CLOTHING/ELECTRONICS (enabled) + SHOES/OTHER (disabled), wired to `setType`; optional `product_description` `<Textarea>`; `<AttributeFields type={type} />`; `SubmitButton` "Create product". Toast on error (success redirects server-side).

- [ ] **Step 1:** Read `components/ui/select.tsx` and `components/ui/textarea.tsx` to learn their exact exports/props.
- [ ] **Step 2:** Implement `image-uploader.tsx` per the intent above.
- [ ] **Step 3:** Implement `create-product-form.tsx` per the intent above. Ensure hidden fields carry the exact prepare output; the `product_type` `<Select>` must submit a `product_type` form value AND drive `AttributeFields`.
- [ ] **Step 4:** `pnpm typecheck`. Self-check: is the details form disabled until upload? do hidden fields match action keys (`productId`/`thumbUrl`/`thumbPublicId`/`images`)?
- [ ] **Step 5:** Commit both — `feat(m3): image uploader + create product form`.

---

### Task 8: Create page

**Files:** Create `app/(seller)/seller/products/new/page.tsx`.

- [ ] **Step 1: Create the page**

```tsx
import { CreateProductForm } from '@/components/products/create-product-form'

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New product</h1>
        <p className="text-sm text-muted-foreground">Upload images, then add product details.</p>
      </div>
      <CreateProductForm />
    </div>
  )
}
```

- [ ] **Step 2:** `pnpm typecheck && pnpm build` (expect route `/seller/products/new`). **Step 3:** Commit — `feat(m3): create product page`.

---

### Task 9: Row actions + product list

**Files:** Create `components/products/product-row-actions.tsx` and `components/products/product-list.tsx`.

Design intent (verify Tabs/Table/Badge API from Task 5 report first):
- `product-row-actions.tsx` (`'use client'`): props `{ id: string; published: boolean }`. A `<form action={published ? unpublishProductAction : publishProductAction}>` with hidden `id` and a `SubmitButton` ("Unpublish"/"Publish") using `useActionState`; toasts result. Plus an Edit `<Link href={\`/seller/products/${id}/edit\`}>` styled as a button.
- `product-list.tsx`: props `{ items: Product[]; pagination: Pagination; tab: 'draft' | 'published' }`. Renders shadcn `Tabs` with two triggers linking to `?tab=draft`/`?tab=published` (use `next/link`, not client tab state, so it's URL-driven and server-fetched). A `Table` with columns: thumbnail (`<img src={product_thumb}>`), name, `toPriceString(product_price)`, quantity, `Badge`(product_type), actions (`<ProductRowActions id published={tab==='published'} />`). Empty state per tab ("No draft products." / "No published products."). Pagination: prev/next `<Link>` to `?tab=&page=` using `pagination.hasPreviousPage/hasNextPage`.

- [ ] **Step 1:** Read `components/ui/tabs.tsx`, `table.tsx`, `badge.tsx` for their APIs.
- [ ] **Step 2:** Implement `product-row-actions.tsx`.
- [ ] **Step 3:** Implement `product-list.tsx`.
- [ ] **Step 4:** `pnpm typecheck`. **Step 5:** Commit both — `feat(m3): product list + row actions`.

---

### Task 10: List page

**Files:** Create `app/(seller)/seller/products/page.tsx`.

- [ ] **Step 1: Create the page**

```tsx
import Link from 'next/link'
import { apiFetch } from '@/lib/api/server-client'
import { Button } from '@/components/ui/button'
import { ProductList } from '@/components/products/product-list'
import type { ProductListResult } from '@/types/product'

const LIMIT = 20

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  const sp = await searchParams
  const tab = sp.tab === 'published' ? 'published' : 'draft'
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1
  const path = `/product/list/${tab}?page=${page}&limit=${LIMIT}`

  let result: ProductListResult = {
    data: [],
    pagination: { total: 0, page, limit: LIMIT, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
  }
  let error: string | null = null
  try {
    result = await apiFetch<ProductListResult>(path, { auth: true })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load products'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Button asChild>
          <Link href="/seller/products/new">New product</Link>
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <ProductList items={result.data} pagination={result.pagination} tab={tab} />
      )}
    </div>
  )
}
```

> If shadcn `Button` in this style does not support `asChild`, replace the `<Button asChild><Link/></Button>` with a `<Link>` styled via `buttonVariants()` (check `components/ui/button.tsx` exports) — verify during implementation.

- [ ] **Step 2:** `pnpm typecheck && pnpm build` (expect routes `/seller/products`, `/seller/products/new`). **Step 3:** Commit — `feat(m3): products list page`.

---

### Task 11: Edit form + edit page

**Files:** Create `components/products/edit-product-form.tsx` and `app/(seller)/seller/products/[id]/edit/page.tsx`.

Design intent:
- `edit-product-form.tsx` (`'use client'`): props `{ product: Product }`. Two independent forms:
  1. Details `<form action={updateProductAction}>`: hidden `id`, prefilled `product_name`, `product_description` (`<Textarea>`), `product_price` (`type="number"`, default `toPriceString(product.product_price)`), `SubmitButton` "Save changes". (Attributes editing via backend is per-type/flattened; keep this form to name/description/price for M3 to match `productEditSchema`. Attribute editing is out of scope of the edit schema — note in report.)
  2. Add-images `<form action={addProductImagesAction}>`: hidden `id`, file input `name="images"` multiple, `SubmitButton` "Add images". Shows current `product_images` thumbnails above.
  Both use `useActionState` + toast.
- edit `page.tsx`: Server Component; `const { id } = await params`; fetch `GET /product/:id` (public, but pass `auth: true` harmlessly); if not found show a message; else render `<EditProductForm product={...} />` with an `<h1>` and a back link to `/seller/products`.

- [ ] **Step 1:** Read `components/ui/textarea.tsx` API. Implement `edit-product-form.tsx`.
- [ ] **Step 2:** Implement the edit `page.tsx`:

```tsx
import Link from 'next/link'
import { apiFetch } from '@/lib/api/server-client'
import { EditProductForm } from '@/components/products/edit-product-form'
import type { Product } from '@/types/product'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let product: Product | null = null
  let error: string | null = null
  try {
    product = await apiFetch<Product>(`/product/${id}`, { auth: true })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load the product'
  }
  return (
    <div className="space-y-6">
      <Link href="/seller/products" className="text-sm text-primary hover:underline">← Back to products</Link>
      <h1 className="text-2xl font-semibold">Edit product</h1>
      {error || !product ? (
        <p className="text-sm text-destructive">{error ?? 'Product not found'}</p>
      ) : (
        <EditProductForm product={product} />
      )}
    </div>
  )
}
```

- [ ] **Step 3:** `pnpm typecheck && pnpm build` (expect `/seller/products/[id]/edit`). **Step 4:** Commit both — `feat(m3): edit product page + form`.

---

### Task 12: Full verification + STATUS

- [ ] **Step 1:** `pnpm typecheck && pnpm lint && pnpm build` — typecheck clean; lint 0 errors (pre-existing `.agents` warnings OK); build shows routes `/seller/products`, `/seller/products/new`, `/seller/products/[id]/edit`.
- [ ] **Step 2:** `pnpm test:run` — on Node ≥ 20.12 expect all pass (M1 22 + M2 gate/schema 8 + M3 price/product 10 = 40). On Node 20.9.0 record the environmental startup error.
- [ ] **Step 3:** Update `docs/frontend-seller-dashboard-STATUS.md`: set M3 row to `✅ **Xong**`; add a "Đã làm — M3" section listing new files, the 2-step create constraint, Decimal128 handling, disabled types, and the RBAC-grant smoke-test risk.
- [ ] **Step 4:** Commit STATUS — `docs(m3): mark M3 done`.
- [ ] **Step 5: Manual smoke test (needs backend + API_KEY + seeded shop grants):**
  1. As a shop, open `/seller/products` → Draft/Published tabs load (or show a clear RBAC error if grants unseeded).
  2. `/seller/products/new` → upload 1–2 images → thumbnails appear, details form enables → pick CLOTHING, fill brand/color/size + name/price/qty → Create → redirected to list, product in Draft.
  3. Publish from the row → moves to Published tab.
  4. Edit → change price/description → Save → reflected. Add images → appended.
  5. Try ELECTRONICS create (manufacturer required). Confirm SHOES/OTHER are disabled in the dropdown.

---

## Self-review notes (author)

- **Spec coverage:** types (T1), price normalize (T2), validation incl. type discrimination + disabled types (T3), all 6 actions incl. 2-step create constraint + multipart `images` (T4), shadcn install (T5), attribute fields (T6), create flow with state (T7–T8), list+tabs+pagination+publish (T9–T10), edit+add-images (T11), verify+STATUS+smoke (T12). Matches spec §3–§9.
- **Type consistency:** `PreparedImages`/`ProductImage`/`Product`/`Pagination`/`ProductListResult` defined in T1 and used identically in T4/T7/T9/T10/T11; action names (`prepareImagesAction`,`createProductAction`,`updateProductAction`,`publishProductAction`,`unpublishProductAction`,`addProductImagesAction`) consistent across T4 and the components that import them; hidden-field keys (`productId`,`thumbUrl`,`thumbPublicId`,`images`,`id`) consistent between T4 actions and T7/T9/T11 forms.
- **Placeholders:** critical/risky code (types, price, validation, actions, pages) fully specified. UI components that depend on Base UI shadcn primitives give explicit structure + a mandatory "read the generated component API first" step, because the exact Base UI markup can't be known until Task 5 generates the files — this is deliberate, not a placeholder gap.
