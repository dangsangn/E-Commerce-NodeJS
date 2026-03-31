# Discount Module — Code Review & Improvement Plan

> **How to use this document**: You are the one coding each step. Read each issue carefully, understand *why* it is a bug, then go fix it yourself. Come back and check off the step when done. Ask questions anytime!

## Summary

The discount module is well-structured with a clear separation of concerns (model → repository → service → controller → routes). However, there are several **critical bugs**, **logical errors**, and **missing features** that need to be addressed before this is production-ready.

---

## 🔴 Critical Bugs (Must Fix)

### Bug 1 — Wrong operator in [applyDiscount](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#159-217) (service.ts, line 177)

```typescript
// ❌ BUGGY — `!` negates the number to boolean (always 1 or 0)
if (userUsage >= !discount.discount_max_uses_per_user) {

// ✅ CORRECT
if (userUsage >= (discount.discount_max_uses_per_user ?? 1)) {
```

**Impact:** Every user is allowed unlimited uses of any discount because `!number` always evaluates to `false` → `0` or `true` → `1`. This is a logic-breaking bug.

---

### Bug 2 — [countUserUsage](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts#104-124) uses wrong `_id` type in aggregate (repository.ts, line 106)

```typescript
// ❌ BUGGY — string ID won't match ObjectId in $match
{ $match: { _id: discountId } }

// ✅ CORRECT
import mongoose from 'mongoose'
{ $match: { _id: new mongoose.Types.ObjectId(discountId) } }
```

**Impact:** The aggregate query always returns 0 (no match), which means [countUserUsage](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts#104-124) will always return 0, making Bug #1 even worse.

---

### Bug 3 — `updateDiscount` uses wrong type for `discount_type` (service.ts, line 123)

```typescript
// ❌ BUGGY — reads discount_type from the existing DB doc but UpdateDiscountDTO can override it
this.validateDiscountValue(
  updateDto.discount_value,
  existingDiscount.discount_type,  // ignores if user is updating the type too
)

// ✅ CORRECT
this.validateDiscountValue(
  updateDto.discount_value,
  updateDto.discount_type ?? existingDiscount.discount_type,
)
```

**Impact:** If the shop updates both `discount_type` AND `discount_value` in the same request, the validation uses the old type and may allow invalid values through.

---

### Bug 4 — [applyDiscount](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#159-217) only accepts a single `productId` but the DTO sends an array (service.ts, line 163 vs apply-discount.dto.ts)

```typescript
// ❌ service signature
async applyDiscount(code, userId, orderValue, productId: string)

// ❌ DTO
productIds!: string[]  // array, but service only handles one

// ✅ service signature should be
async applyDiscount(code, userId, orderValue, productIds: string[])

// ✅ check logic for multi-product
const hasValidProduct = (discount.discount_product_ids ?? []).some(
  (id) => productIds.includes(id)
)
```

**Impact:** The [applyDiscount](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#159-217) endpoint is unusable in a cart context — it can only validate one product at a time but the DTO promises an array.

---

### Bug 5 — [routes/index.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/routes/index.ts) is missing most routes

The controller has 3 methods but routes only exposes 3. The `updateDiscount`, `deleteDiscount`, [applyDiscount](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#159-217), and `queryDiscounts` methods are **never reachable** — they have no routes.

```typescript
// ❌ Missing routes (currently absent):
router.get('/', ...)           // queryDiscounts
router.put('/:id', ...)        // updateDiscount
router.delete('/:id', ...)     // deleteDiscount
router.post('/apply', ...)     // applyDiscount
```

---

## 🟡 Logic Problems (Should Fix)

### Issue 6 — [validateDiscountDates](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#94-103) rejects backdated start dates (service.ts, line 94-101)

```typescript
// ❌ Currently, startDate cannot be in the past even on creation
if (endDate <= now) {
  throw new BadRequestError('Discount has expired.')
}
// Missing: also blocks if start date is already passed
```

The `startDate` is never validated to be >= `now`. Only `endDate` is checked. A discount with a `startDate` 10 years ago and `endDate` tomorrow could be created silently.

**Fix:** Add `if (startDate < now)` check in [createDiscount](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/controller/discount.controller.ts#12-21) but **not** in `updateDiscount` (so existing active discounts can still be updated).

---

### Issue 7 — `discount_max_uses` is never checked in [applyDiscount](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#159-217) (service.ts)

Once the per-user check is fixed (Bug #1), we still need to check the **global** max uses:

```typescript
// ❌ Missing check
if (
  discount.discount_max_uses !== undefined &&
  discount.discount_uses_count >= discount.discount_max_uses
) {
  throw new BadRequestError('This discount has reached its maximum usage limit.')
}
```

---

### Issue 8 — `DiscountModel` missing `discount_max_uses` field (models/index.ts)

The [CreateDiscountDTO](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/dtos/create-discount.dto.ts#13-74) and [DiscountResponseDTO](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/dtos/discount-response.dto.ts#3-27) both include `discount_max_uses`, but the **Mongoose schema** never defines it. It gets stored in MongoDB (as a dynamic key) but there's no index, no type enforcement.

```typescript
// ✅ Add to schema:
discount_max_uses: {
  type: Number,
  default: undefined,  // null = unlimited
},
```

---

### Issue 9 — Soft delete vs hard delete confusion (repository.ts)

The repository provides both [softDelete](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts#73-80) (sets `discount_is_active: false`) and [delete](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts#81-84) (permanent). The service only calls [softDelete](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts#73-80), which is correct — but:

1. [findByShopId](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts#22-28) and [findWithPagination](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts#29-65) do NOT filter out soft-deleted (inactive) discounts by default.
2. The [delete](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts#81-84) static method in repository is never called — it's dead code.

**Fix:**
- Add `discount_is_active: { $ne: false }` to [findWithPagination](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts#29-65) default filter, or let callers opt-in explicitly.
- Remove [delete](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts#81-84) static method or document why it's kept.

---

### Issue 10 — [QueryDiscountDTO](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/dtos/query-discount.dto.ts#10-42) default `limit` is 50 but undocumented / high

```typescript
limit?: number = 50  // potentially 50 full documents per page
page?: number = 1
```

Set an explicit `@Max(100)` and document the pagination contract.

---

## 🟢 Code Quality Improvements

### Issue 11 — `discount_value` uses `Schema.Types.Mixed` (models/index.ts, line 27)

```typescript
// ❌ Too loose
discount_value: { type: Schema.Types.Mixed, required: true }

// ✅ Both types are numbers — no need for Mixed
discount_value: { type: Number, required: true, min: 0 }
```

---

### Issue 12 — [transformDiscount](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#250-276) uses `any` type (service.ts, line 250)

```typescript
// ❌
private transformDiscount(discount: any): DiscountResponseDTO {

// ✅ Create a proper IDiscount interface or use the Mongoose Document type
```

---

### Issue 13 — Controller missing [applyDiscount](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#159-217), `updateDiscount`, `deleteDiscount`, `queryDiscounts` handlers

The controller only wraps 3 of the 6 service methods. Add the missing 4:

```typescript
async applyDiscount(req: Request, res: Response) { ... }
async updateDiscount(req: Request, res: Response) { ... }
async deleteDiscount(req: Request, res: Response) { ... }
async queryDiscounts(req: Request, res: Response) { ... }
```

---

### Issue 14 — `CreateDiscountDTO.discount_applies_to` is optional but model requires it

```typescript
// ❌ dto — optional
@IsOptional()
discount_applies_to?: 'all' | 'specific_products'

// ✅ should match model — required
@IsNotEmpty()
discount_applies_to!: 'all' | 'specific_products'
```

---

### Issue 15 — No [NotFoundError](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/core/error.response.ts#29-37) — everything is thrown as [BadRequestError](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/core/error.response.ts#20-28)

```typescript
// ❌ semantically wrong
throw new BadRequestError('Discount not found.')

// ✅ use the correct HTTP 404
throw new NotFoundError('Discount not found.')
```

---

## Step-by-Step Fix Plan

Follow these steps in **order** — each one is self-contained.

### Step 1 — Fix the critical bug in [applyDiscount](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#159-217) ⭐
**File:** [services/discount.service.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts) line 177
```diff
- if (userUsage >= !discount.discount_max_uses_per_user) {
+ if (userUsage >= (discount.discount_max_uses_per_user ?? 1)) {
```

### Step 2 — Fix [countUserUsage](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts#104-124) ObjectId mismatch ⭐
**File:** [repository/discount.repository.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts) line 106
```diff
+ import mongoose from 'mongoose'
  ...
- { $match: { _id: discountId } },
+ { $match: { _id: new mongoose.Types.ObjectId(discountId) } },
```

### Step 3 — Add `discount_max_uses` to Mongoose schema ⭐
**File:** [models/index.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/models/index.ts) — add the field inside `DiscountSchema`.

### Step 4 — Add global `discount_max_uses` exhaustion check in [applyDiscount](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#159-217)
**File:** [services/discount.service.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts) — after step 2 (user usage check).

### Step 5 — Fix [applyDiscount](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#159-217) to handle array of `productIds`
**File:** [services/discount.service.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts) — change signature + fix logic.
**File:** [controller/discount.controller.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/controller/discount.controller.ts) — pass `productIds` array from body.

### Step 6 — Fix `updateDiscount` to pick the new `discount_type` first
**File:** [services/discount.service.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts) line 121-125.

### Step 7 — Add missing controller methods
**File:** [controller/discount.controller.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/controller/discount.controller.ts) — add [applyDiscount](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#159-217), `updateDiscount`, `deleteDiscount`, `queryDiscounts`.

### Step 8 — Add missing routes
**File:** [routes/index.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/routes/index.ts) — wire up all 7 endpoints with proper auth middleware and DTOs.

### Step 9 — Fix `discount_value` model type from `Mixed` to `Number`
**File:** [models/index.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/models/index.ts).

> **⚠️ TypeScript side effect:** After this change, Mongoose infers a strict type for the model. The `QueryFilter<any>` in [repository.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts) (lines 23, 33) will show type errors. Fix those by changing both to `Record<string, any>` — which is the correct loose-typed filter for dynamic queries.


### Step 10 — Fix `CreateDiscountDTO.discount_applies_to` to be required
**File:** [dtos/create-discount.dto.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/dtos/create-discount.dto.ts).

### Step 11 — Replace [BadRequestError](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/core/error.response.ts#20-28) used for 404s with [NotFoundError](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/core/error.response.ts#29-37)
**File:** [services/discount.service.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts) — anywhere `'not found'` is thrown.

### Step 12 — Remove [transformDiscount(discount: any)](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts#250-276) — type it properly
**File:** [services/discount.service.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts).

---

## Files to Change

| File | Steps |
|------|-------|
| [services/discount.service.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/services/discount.service.ts) | 1, 4, 5, 6, 11, 12 |
| [repository/discount.repository.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/repository/discount.repository.ts) | 2 |
| [models/index.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/models/index.ts) | 3, 9 |
| [controller/discount.controller.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/controller/discount.controller.ts) | 7 |
| [routes/index.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/routes/index.ts) | 8 |
| [dtos/create-discount.dto.ts](file:///home/dangsang/Documents/projects/E-Commerce-NodeJS/src/features/discount/dtos/create-discount.dto.ts) | 10 |
