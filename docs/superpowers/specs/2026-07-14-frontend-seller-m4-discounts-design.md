# M4 Design — Discounts

> **Milestone:** M4 of the Frontend Seller Dashboard (see [STATUS](../../frontend-seller-dashboard-STATUS.md)).
> **Branch:** `feature/frontend-seller-dashboard`
> **Date:** 2026-07-14
> **Prereq:** M1–M3 done.

## 1. Goal

Let a shop create discounts, view its own discounts, and look up a discount by code, over the existing Express `/discount` API. Create + view only — the backend does not route update/delete/query. Same BFF pattern (Server Components read, Server Actions write, tokens in httpOnly cookies).

## 2. Backend contract (verified in source)

### `POST /discount` (auth) — create
`class-validator` DTO (`CreateDiscountDTO`) via `validationMiddleware`. Fields:
- **Required:** `discount_name`, `discount_description`, `discount_code`, `discount_type` (`'fixed_amount' | 'percentage'`), `discount_value` (number ≥ 0), `discount_start_date` + `discount_end_date` (`@IsDateString` → ISO strings), `discount_shop_id` (non-empty string), `discount_applies_to` (`'all' | 'specific_products'`).
- **Optional:** `discount_max_uses` (≥1), `discount_max_uses_per_user` (≥1), `discount_min_order_value` (≥0), `discount_is_active` (bool, model default `true`), `discount_product_ids` (string[]).
- **`discount_shop_id` quirk:** the controller overrides it with the caller's `userId` (`{ ...payload, discount_shop_id: shopId }`), BUT `validationMiddleware` runs first and requires it non-empty. **So the FE must send a non-empty `discount_shop_id` (its own userId) to pass validation, even though the value is replaced server-side.**
- **Service re-validation (after DTO):** unique `discount_code` (else `'Discount code is exists.'`); `start < end` and `end > now` (else `'Start date must be before end date.'` / `'Discount has expired.'`); percentage value 0–100 (else `'Discount value must be between 0 and 100.'`); if `applies_to === 'specific_products'` then `discount_product_ids` must be non-empty (else `'Product ids must be provided.'`).
- Returns **201** `CreatedResponse` with the created discount (transformed).

### `GET /discount/shop/:shopId` (public) — list by shop
Returns a **plain array** `DiscountResponseDTO[]` (NOT paginated). Each item includes computed `is_expired` (bool) and `remaining_uses` (number | undefined) plus all discount fields.

### `GET /discount/code/:code` (public) — lookup by code
Returns a single discount, but **throws** (BadRequest) if: not found (`'Discount not found.'`), not started (`'Discount has not started yet.'`), expired (`'Discount has expired.'`), or inactive (`'Discount is not active.'`). Only returns currently-usable discounts. **FE surfaces the backend message verbatim.**

### Not available
`updateDiscount`/`deleteDiscount`/`queryDiscounts` exist in the service but are **not wired to any route**. No FE edit/delete/query. (STATUS §6 gap #2.)

### Error shape
`validationMiddleware` joins all `class-validator` constraint messages into one comma-separated string in `BadRequestError` → reaches FE as `ApiError.message`. Service errors are single-message `BadRequestError`s. Both surface cleanly via `errorMessage`.

## 3. Files

| File | New/Modify | Responsibility |
|---|---|---|
| `types/discount.ts` | Create | `Discount`, `DiscountType`, `AppliesTo` |
| `lib/validations/discount.ts` (+test) | Create | Zod create schema mirroring backend rules |
| `actions/discount.actions.ts` | Create | `createDiscountAction`, `lookupDiscountByCodeAction` |
| `components/discounts/create-discount-form.tsx` | Create | Full create form (client) |
| `components/discounts/discount-list.tsx` | Create | Table of the shop's discounts |
| `components/discounts/discount-code-lookup.tsx` | Create | Code input → result or backend reason (client) |
| `app/(seller)/seller/discounts/page.tsx` | Create | List + code-lookup panel (Server Component) |
| `app/(seller)/seller/discounts/new/page.tsx` | Create | Create page |
| STATUS.md | Modify | Mark M4 done |

No new shadcn components (reuse `table`, `badge`, `select`, `input`, `textarea`, `card`, `label` from M1–M3).

## 4. Create form (single page)

`create-discount-form.tsx` (`'use client'`), `useActionState(createDiscountAction, initialActionState)`, toast on error (success redirects). State: `type` and `appliesTo` (to drive conditional hints/fields). Fields:
- `discount_name`, `discount_description` (`Textarea`), `discount_code`.
- `discount_type` `<Select>` (`fixed_amount` / `percentage`) — controlled to `type`.
- `discount_value` (number; helper text "0–100 for percentage").
- `discount_start_date`, `discount_end_date` (`<input type="date">`).
- Optional: `discount_max_uses`, `discount_max_uses_per_user`, `discount_min_order_value` (numbers).
- `discount_applies_to` `<Select>` (`all` / `specific_products`) — controlled to `appliesTo`.
- **When `appliesTo === 'specific_products'`:** reveal `discount_product_ids` text input (comma-separated IDs) with a helper note. (Chosen over a product multi-select for M4 — YAGNI; backend just needs IDs.)

`createDiscountAction`: validate with the Zod schema; convert `date` inputs (`YYYY-MM-DD`) to ISO datetime strings; split comma-separated `product_ids` into a trimmed array (only when specific); attach `discount_shop_id = await getClientId()`; POST `/discount` with `auth: true`; on success `revalidatePath('/seller/discounts')` + `redirect('/seller/discounts')`; on error return `{ ok:false, message: errorMessage(...) }`.

## 5. List + code lookup

- **List page** (`page.tsx`): Server Component; `const payload = await getAccessPayload()`; fetch `GET /discount/shop/{payload.userId}` with `auth: true` (public route, auth harmless). Render `<DiscountList discounts={...} />` + a "New discount" link + `<DiscountCodeLookup />`. On fetch error show the message.
- **`discount-list.tsx`**: a `Table` — columns: code, name, type (`Badge`), value (append `%` for percentage), date range (`start – end`, formatted), status (`Badge`: "Expired" if `is_expired` else `discount_is_active` ? "Active" : "Inactive"). Empty state "No discounts yet."
- **`discount-code-lookup.tsx`** (`'use client'`): a code input + submit via `useActionState(lookupDiscountByCodeAction)`. On success render the discount summary (name, type, value, validity). On failure show `state.message` (the backend's exact reason). `lookupDiscountByCodeAction` GETs `/discount/code/{code}` (no auth needed) and returns `{ ok, message, data }`.

## 6. Validation

`lib/validations/discount.ts` — Zod `createDiscountSchema`:
- `discount_name`/`discount_description`/`discount_code` non-empty.
- `discount_type` enum; `discount_value` `z.coerce.number().min(0)`; refine: when `percentage`, `value ≤ 100`.
- `discount_start_date`/`discount_end_date` non-empty strings; refine `end > start`.
- Optional numeric fields coerced; `discount_applies_to` enum; refine: when `specific_products`, `discount_product_ids` (post-split) non-empty.
- Mirrors backend so most errors are caught client-side before the request; backend remains source of truth (unique code, dates-vs-now).

## 7. Error handling
`ActionState.message` → toast (M1–M3 pattern). Create errors (duplicate code, bad dates, percentage bound, missing product ids) surface the backend message. Lookup failures surface the backend's specific reason.

## 8. Testing
- **Unit (pure):** `createDiscountSchema` — accepts a valid fixed_amount + valid percentage; rejects percentage > 100; rejects `end ≤ start`; requires `product_ids` when `specific_products`; coerces numeric strings.
- No network tests for actions.
- ⚠️ Vitest runner still Node-blocked (20.9.0 `styleText`); tests pass on ≥20.12. Static gates typecheck/lint/build must be clean.

## 9. Pitfalls (verified)
- **Send a non-empty `discount_shop_id`** (own userId) — DTO validation requires it even though the controller overrides it.
- **Dates must be ISO** (`@IsDateString`) — convert `<input type="date">` `YYYY-MM-DD` to ISO before sending.
- **`specific_products` needs `discount_product_ids`** — enforced by both FE and backend service.
- **Percentage value 0–100** — backend rejects out-of-range.
- **get-by-code only returns usable discounts** — expired/inactive/not-started all throw; treat as expected, show the reason.
- **No edit/delete/query** — don't build them.
- **`'use server'` files export only async functions**; types in `types/discount.ts`, helpers in `lib/`.

## 10. Out of scope
- Backend fixes (avatar `.send`, discount update/delete/query routes) — documented, not coded.
- Applying a discount to an order (customer storefront, later).
- Product multi-select picker (comma-separated IDs instead).
