# M3 Design — Product Management

> **Milestone:** M3 of the Frontend Seller Dashboard (see [STATUS](../../frontend-seller-dashboard-STATUS.md)).
> **Branch:** `feature/frontend-seller-dashboard`
> **Date:** 2026-07-14
> **Prereq:** M1 (auth/BFF) + M2 (shop upgrade, role-gate) — done.

## 1. Goal

Let a shop list, create, edit, publish/unpublish, and add images to products, over the existing Express `/product` API. Full M3 in one pass. Follows the M1/M2 BFF pattern (Server Components read, Server Actions write, tokens in httpOnly cookies).

## 2. Backend contract (verified in source)

All write/list routes are under `authentication` + RBAC `protect('product')` (`can.create/read/update`). `apiFetch` unwraps the envelope `data`, so the shapes below are what actions receive.

### Product types — only 2 are wired
`productType` enum = `ELECTRONICS | CLOTHING | SHOES | OTHER`, but `ProductServiceFactory` registers **only `CLOTHING` and `ELECTRONICS`**. Creating SHOES/OTHER throws `'Invalid product type'`. **FE decision: show all 4 in the type dropdown, disable SHOES/OTHER with a "not available yet" note.**

### Type-specific attributes (required, enforced by sub-model schemas)
- **CLOTHING:** `brand` (req), `color` (req), `size` (req), `material` (optional).
- **ELECTRONICS:** `manufacturer` (req), `model` (optional).
These are stored in `product_attributes` and also written to a `clothes`/`electronics` sub-collection on create.

### 2-step create (mandatory order)
1. `POST /product/upload/prepare` — multipart, field name **`images`** (array), `uploadImage.array('images')`. Returns `{ productId, images: [{url, public_id}], thumb: {url, public_id} }`. `thumb` = `images[0]`.
2. `POST /product` — body validated by `createProductSchema`:
   ```
   { _id, product_name, product_thumb, product_thumb_public_id,
     product_images: [{url, public_id}], product_price: number,
     product_quantity: number, product_type, product_attributes }
   ```
   **Critical constraint (service line 42):** every `public_id` (thumb + images) must start with `products/{shopId}/{productId}`. So the create body MUST reuse `productId` as `_id`, `thumb.url` as `product_thumb`, `thumb.public_id` as `product_thumb_public_id`, and the returned `images` verbatim. You cannot create a product without calling prepare first.
   `product_price` is stored as Mongo `Decimal128`.

### List (shop-scoped by JWT)
- `GET /product/list/draft?page&limit` and `GET /product/list/published?page&limit`.
- Response (after unwrap): `{ data: Product[], pagination: { total, page, limit, totalPages, hasNextPage, hasPreviousPage } }`.
- `isDraft`/`isPublished` are `select:false` — not in the payload. The **endpoint you call defines the status** (draft list vs published list).
- ⚠️ `product_price` serializes from `Decimal128` as `{ "$numberDecimal": "9.99" }` (or a string) in JSON — FE must normalize to a number/display string. A small `toPriceString(v)` helper handles both `number` and `{$numberDecimal}`.

### Detail / edit / publish / images
- `GET /product/:id` (public, no auth) → full product incl. `product_images`, `product_attributes`, `product_type`, `product_shop`.
- `PATCH /product/:id` — `updateProductSchema` (`.strict()`): `product_name?`, `product_thumb?`, `product_description?`, `product_price?` (positive), `product_attributes?` (record). Ownership-checked (`ForbiddenError('Not your product')`).
- `PATCH /product/published/:id` → publish. `PATCH /product/draft/:id` → unpublish. Return an updateOne result.
- `PUT /product/upload/images/:productId` — multipart field **`images`** (array). Appends to `product_images`, returns the updated array. Ownership-checked.
- `POST /product/upload/link` — `{ url }`. Uploads from URL, returns `{ url, public_id }`. (Wired as an optional add-image source; primary path is file upload.)

### RBAC risk (smoke-test #1)
`protect('product')` grants are DB-seeded per role via the `accesscontrol` lib. Whether the `shop` role has product create/read/update is **data-dependent**, not code-guaranteed. If unseeded, calls return 403 with message `You don't have permission to <action> product`. FE surfaces that message as a toast. Cannot verify without the DB (like M2's API_KEY gap) — flagged for manual smoke test.

## 3. Files

| File | New/Modify | Responsibility |
|---|---|---|
| `types/product.ts` | Create | `Product`, `ProductListItem`, `Pagination`, `PreparedImages`, `ProductType` |
| `lib/products/price.ts` | Create | `toPriceString(v)` — normalize Decimal128 JSON; pure, unit-tested |
| `lib/validations/product.ts` | Create | Zod: base fields + per-type attribute schemas (discriminated union on type); details-form schema |
| `actions/product.actions.ts` | Create | `prepareImagesAction`, `createProductAction`, `updateProductAction`, `publishProductAction`, `unpublishProductAction`, `addProductImagesAction` |
| `app/(seller)/seller/products/page.tsx` | Create | List page — Server Component, reads `?tab&page`, fetches draft or published |
| `app/(seller)/seller/products/new/page.tsx` | Create | Create page — renders the client create wrapper |
| `app/(seller)/seller/products/[id]/edit/page.tsx` | Create | Edit page — Server Component loads product, renders edit form |
| `components/products/product-list.tsx` | Create | Tabs (Draft/Published) + table + pagination controls |
| `components/products/product-row-actions.tsx` | Create | Publish/unpublish toggle (Server Action) + Edit link |
| `components/products/create-product-form.tsx` | Create | `'use client'` wrapper holding `{productId, images, thumb}` state |
| `components/products/image-uploader.tsx` | Create | Upload section → `prepareImagesAction`, shows thumbnails |
| `components/products/attribute-fields.tsx` | Create | Renders attribute inputs for the selected type |
| `components/products/edit-product-form.tsx` | Create | Edit details + add-images section |
| `components/ui/{table,tabs,badge,select,textarea}.tsx` | Create (shadcn) | Primitives (`pnpm dlx shadcn@latest add table tabs badge select textarea`) |
| STATUS.md | Modify | Mark M3 done |

## 4. Create flow (single page, sequential sections)

`create-product-form.tsx` (`'use client'`) holds `uploadResult: PreparedImages | null` in `useState`.

1. **Image section** (`image-uploader.tsx`): a `<form>` with `<input type="file" name="images" multiple accept="image/*">` bound to `prepareImagesAction` via `useActionState`. On success the action returns `{ ok: true, data: { productId, images, thumb } }`; the wrapper stores it and renders thumbnails. Errors → toast.
2. **Details section** (in the wrapper): disabled until `uploadResult` exists. Fields: `product_name`, `product_price` (number), `product_quantity` (number), a type `<Select>` (CLOTHING/ELECTRONICS enabled; SHOES/OTHER disabled), optional `product_description` (`<textarea>`), and `<AttributeFields type={selectedType} />`. On submit, `createProductAction` reads these plus hidden fields carrying `productId`, `thumb` (url+public_id), and `images` (JSON) from `uploadResult`; it assembles the exact `POST /product` body and on success `redirect('/seller/products')`.

State approach: client wrapper with `useState` (chosen). No server-side draft; create is one atomic call.

## 5. List, publish, edit

- **List page** (`page.tsx`): reads `searchParams` `tab` (`draft`|`published`, default `draft`) and `page` (default 1). Calls the matching endpoint with `auth: true`, `?page&limit=20`. Renders `<ProductList>` with the returned items + pagination.
- **`product-list.tsx`**: shadcn `Tabs` for Draft/Published (tab change = link with `?tab=`), a `Table` (thumb, name, `toPriceString(price)`, quantity, `Badge` for type), and prev/next pagination via `?page=` links (uses `hasNextPage`/`hasPreviousPage`). Empty state per tab.
- **`product-row-actions.tsx`** (`'use client'`): Publish button on draft rows (`publishProductAction`), Unpublish on published rows (`unpublishProductAction`) — Server Action + `revalidatePath('/seller/products')` + toast. Plus an Edit `<Link>` to `/seller/products/[id]/edit`.
- **Edit page**: Server Component loads `GET /product/:id`; `edit-product-form.tsx` (`'use client'`) edits name/description/price/attributes via `updateProductAction` (`PATCH /product/:id`), and has an add-images sub-form (`addProductImagesAction` → `PUT /product/upload/images/:id`). Attribute fields are pre-filled from the product's current `product_attributes`, keyed by `product_type`.

## 6. Validation

`lib/validations/product.ts`:
- `productDetailsSchema` — a **discriminated union on `product_type`**: base (`product_name` non-empty, `product_price` positive number, `product_quantity` int ≥ 0, optional `product_description`) intersected with either clothing attrs (`brand`,`color`,`size` required; `material` optional) or electronic attrs (`manufacturer` required; `model` optional). Numbers coerced from form strings via `z.coerce.number()`.
- `updateProductSchema` (FE) — all optional, mirrors backend `.strict()` allowed keys.
- Validation runs in the action before calling the backend; first issue message → `ActionState.message`.

## 7. Error handling
Same as M1/M2: actions catch `ApiError`, return `{ ok, message }`, forms toast via `useEffect`. RBAC 403 and `'Invalid public_id'`/`'Invalid product type'` all surface the backend message verbatim (they're actionable). Image prepare failures (partial upload) surface the backend's `Failed to upload some images` message.

## 8. Testing
- **Unit (pure, edge-safe):** `toPriceString` (number, `{$numberDecimal}`, string, undefined); `productDetailsSchema` (clothing requires brand/color/size; electronics requires manufacturer; rejects negative price; coerces numeric strings; type discrimination picks correct attr set).
- No network tests for actions (hit backend) — covered by manual smoke test.
- ⚠️ Vitest runner still blocked on Node 20.9.0 (`styleText`); tests written to pass on Node ≥ 20.12. Static gates `pnpm typecheck && lint && build` must be clean.

## 9. Pitfalls (verified)
- **Must call prepare before create**, and reuse its `productId`/`public_id`s exactly — the backend rejects any `public_id` not under `products/{shopId}/{productId}`.
- **Multipart field name is `images`** (array) for both prepare and add-images — not `image`.
- **`product_price` is Decimal128** — normalize on display; send a plain `number` on create/update.
- **Draft/published status isn't in the payload** — driven by which list endpoint you call; publish/unpublish are separate PATCH routes.
- **Only CLOTHING/ELECTRONICS creatable** — disable the others.
- **`'use server'` files export only async functions**; types live in `types/product.ts`, consts/helpers in `lib/`.
- **`cookies()` async; multipart via `apiFetch({ multipart: FormData, auth: true })`** (already supported).

## 10. Out of scope
- Backend fixes (avatar `.send`, discount routes) — documented separately.
- Delete product (no FE-facing delete route wired beyond soft-delete fields).
- Variations, inventory management UI, ratings.
- M4 (discounts).
