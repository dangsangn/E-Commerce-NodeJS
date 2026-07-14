# M4 — Discounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A shop can create discounts, view its own discounts, and look up a discount by code, over the existing Express `/discount` API (create + view only — no edit/delete/query routes exist).

**Architecture:** BFF pattern from M1–M3 — Server Components read, Server Actions write, tokens in httpOnly cookies, single `apiFetch` choke point.

**Tech Stack:** Next.js 16, React 19, TS, Tailwind v4, shadcn/ui (`base-nova`, Base UI), Zod, `sonner`. No new shadcn components.

**Spec:** [2026-07-14-frontend-seller-m4-discounts-design.md](../specs/2026-07-14-frontend-seller-m4-discounts-design.md)

**Working directory:** `e-commerce-nextjs/`.

## Context every task needs

- **Reuse:** `apiFetch`/`ApiError` (`lib/api/server-client.ts`), `errorMessage` (`lib/api/error-message.ts`), `ActionState`/`initialActionState` (`actions/state.ts`), `SubmitButton` (`components/auth/submit-button.tsx`), `getAccessPayload`/`getClientId` (`lib/auth/session.ts`), and UI from `components/ui/`: `Card*`, `Input`, `Label`, `Textarea`, `Badge`, `Table*`, `Select`+`SelectContent/SelectItem/SelectTrigger/SelectValue`, `buttonVariants`.
- **Base UI Select** (verified in M3): `<Select name value onValueChange>` with `<SelectTrigger className="w-full"><SelectValue/></SelectTrigger><SelectContent>{items}<SelectItem value disabled?>…</SelectItem></SelectContent>`. `name` renders a hidden input so the value submits with the form.
- **Backend facts (verified):**
  - `POST /discount` (auth): required `discount_name`,`discount_description`,`discount_code`,`discount_type`(`fixed_amount|percentage`),`discount_value`(≥0),`discount_start_date`+`discount_end_date`(ISO strings),`discount_shop_id`(non-empty — **send your own userId; controller overrides it, but DTO validation requires it**),`discount_applies_to`(`all|specific_products`). Optional `discount_max_uses`,`discount_max_uses_per_user`,`discount_min_order_value`,`discount_is_active`,`discount_product_ids`(required by service when specific). Returns 201.
  - `GET /discount/shop/:shopId` (public): **plain array** with computed `is_expired`,`remaining_uses`.
  - `GET /discount/code/:code` (public): single discount; **throws** if not-found/not-started/expired/inactive — surface the message.
  - No update/delete/query routes.
  - Backend errors arrive as `ApiError.message` (validation messages comma-joined).
- **Conventions:** English copy, imperative buttons, sentence case, empathetic errors. English test names. `'use server'` files export only async functions.
- **Vitest runner** blocked on Node 20.9.0 (`styleText`); when a test step's runner won't start, run `pnpm typecheck` and note it.
- **Git:** the controlling session is handling commits separately — implement and verify; do not commit unless asked. Never touch `.agents/`/`skills-lock.json`.

## File structure

| File | Responsibility |
|---|---|
| `types/discount.ts` | Discount + enums |
| `lib/validations/discount.ts` (+test) | Zod create schema |
| `actions/discount.actions.ts` | create + lookup actions |
| `components/discounts/create-discount-form.tsx` | Create form |
| `components/discounts/discount-list.tsx` | Shop discounts table |
| `components/discounts/discount-code-lookup.tsx` | Code lookup panel |
| `app/(seller)/seller/discounts/page.tsx` | List + lookup |
| `app/(seller)/seller/discounts/new/page.tsx` | Create page |
| STATUS.md | Mark M4 done |

---

### Task 1: Types

**File:** Create `types/discount.ts`.

- [ ] **Step 1:**
```ts
export type DiscountType = 'fixed_amount' | 'percentage'
export type AppliesTo = 'all' | 'specific_products'

export interface Discount {
  _id: string
  discount_name: string
  discount_description: string
  discount_code: string
  discount_type: DiscountType
  discount_value: number
  discount_start_date: string
  discount_end_date: string
  discount_max_uses?: number
  discount_max_uses_per_user?: number
  discount_min_order_value?: number
  discount_is_active?: boolean
  discount_applies_to: AppliesTo
  discount_shop_id?: string
  discount_product_ids?: string[]
  is_expired?: boolean
  remaining_uses?: number
}
```
- [ ] **Step 2:** `pnpm typecheck` → clean. **Step 3:** (commit handled by controller.)

---

### Task 2: Validation schema

**Files:** Create `lib/validations/discount.ts`, `lib/validations/__tests__/discount.test.ts`.

- [ ] **Step 1: Write the failing test** — `lib/validations/__tests__/discount.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createDiscountSchema } from '@/lib/validations/discount'

const base = {
  discount_name: 'Summer', discount_description: 'Sale', discount_code: 'SUMMER',
  discount_start_date: '2026-08-01', discount_end_date: '2026-08-31',
  discount_applies_to: 'all',
}

describe('createDiscountSchema', () => {
  it('accepts a valid fixed_amount discount', () => {
    const r = createDiscountSchema.safeParse({ ...base, discount_type: 'fixed_amount', discount_value: '10' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.discount_value).toBe(10)
  })
  it('accepts a valid percentage (<=100)', () => {
    expect(createDiscountSchema.safeParse({ ...base, discount_type: 'percentage', discount_value: '25' }).success).toBe(true)
  })
  it('rejects a percentage over 100', () => {
    expect(createDiscountSchema.safeParse({ ...base, discount_type: 'percentage', discount_value: '150' }).success).toBe(false)
  })
  it('rejects end <= start', () => {
    expect(createDiscountSchema.safeParse({ ...base, discount_type: 'fixed_amount', discount_value: '10', discount_end_date: '2026-08-01' }).success).toBe(false)
  })
  it('requires product ids when applies_to is specific_products', () => {
    expect(createDiscountSchema.safeParse({ ...base, discount_type: 'fixed_amount', discount_value: '10', discount_applies_to: 'specific_products' }).success).toBe(false)
    expect(createDiscountSchema.safeParse({ ...base, discount_type: 'fixed_amount', discount_value: '10', discount_applies_to: 'specific_products', discount_product_ids: 'a,b' }).success).toBe(true)
  })
})
```

- [ ] **Step 2:** Run `pnpm vitest run lib/validations/__tests__/discount.test.ts` (expect module-not-found or environmental error).

- [ ] **Step 3: Implement** — `lib/validations/discount.ts`:
```ts
import { z } from 'zod'

export const createDiscountSchema = z
  .object({
    discount_name: z.string().trim().min(1, 'Enter a name'),
    discount_description: z.string().trim().min(1, 'Enter a description'),
    discount_code: z.string().trim().min(1, 'Enter a code'),
    discount_type: z.enum(['fixed_amount', 'percentage']),
    discount_value: z.coerce.number().min(0, 'Value cannot be negative'),
    discount_start_date: z.string().trim().min(1, 'Choose a start date'),
    discount_end_date: z.string().trim().min(1, 'Choose an end date'),
    discount_max_uses: z.coerce.number().int().min(1).optional(),
    discount_max_uses_per_user: z.coerce.number().int().min(1).optional(),
    discount_min_order_value: z.coerce.number().min(0).optional(),
    discount_applies_to: z.enum(['all', 'specific_products']),
    // Raw comma-separated string from the form; split in the action.
    discount_product_ids: z.string().trim().optional(),
  })
  .refine((d) => d.discount_type !== 'percentage' || d.discount_value <= 100, {
    message: 'Percentage must be between 0 and 100',
    path: ['discount_value'],
  })
  .refine((d) => new Date(d.discount_end_date) > new Date(d.discount_start_date), {
    message: 'End date must be after the start date',
    path: ['discount_end_date'],
  })
  .refine(
    (d) =>
      d.discount_applies_to !== 'specific_products' ||
      (d.discount_product_ids ?? '').split(',').map((s) => s.trim()).filter(Boolean).length > 0,
    { message: 'Enter at least one product id', path: ['discount_product_ids'] },
  )

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>
```

> Note: `z.coerce.number()` on an omitted optional key — because the keys are omitted (not empty strings) when absent from `Object.fromEntries`, `.optional()` short-circuits before coercion. In the form, omit empty optional number inputs by leaving them out of the DOM when blank is NOT required — simpler: the action will delete empty-string optional fields before parse (see Task 3).

- [ ] **Step 4:** Re-run test (tests pass) or `pnpm typecheck`. **Step 5:** (commit by controller.)

---

### Task 3: Server Actions

**File:** Create `actions/discount.actions.ts`.

- [ ] **Step 1:**
```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { apiFetch } from '@/lib/api/server-client'
import { errorMessage } from '@/lib/api/error-message'
import { getClientId } from '@/lib/auth/session'
import { createDiscountSchema } from '@/lib/validations/discount'
import type { ActionState } from '@/actions/state'
import type { Discount } from '@/types/discount'

// Optional numeric fields arrive as '' when left blank; drop them so z.optional applies.
function pruneEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== '' && v !== undefined && v !== null) out[k] = v
  }
  return out
}

export async function createDiscountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = pruneEmpty(Object.fromEntries(formData))
  const parsed = createDiscountSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }

  const shopId = await getClientId()
  if (!shopId) return { ok: false, message: 'Your session has expired' }

  const d = parsed.data
  const productIds =
    d.discount_applies_to === 'specific_products'
      ? (d.discount_product_ids ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      : undefined

  const body: Record<string, unknown> = {
    discount_name: d.discount_name,
    discount_description: d.discount_description,
    discount_code: d.discount_code,
    discount_type: d.discount_type,
    discount_value: d.discount_value,
    discount_start_date: new Date(d.discount_start_date).toISOString(),
    discount_end_date: new Date(d.discount_end_date).toISOString(),
    discount_applies_to: d.discount_applies_to,
    discount_shop_id: shopId, // required by DTO validation; server overrides it anyway
    ...(d.discount_max_uses !== undefined && { discount_max_uses: d.discount_max_uses }),
    ...(d.discount_max_uses_per_user !== undefined && { discount_max_uses_per_user: d.discount_max_uses_per_user }),
    ...(d.discount_min_order_value !== undefined && { discount_min_order_value: d.discount_min_order_value }),
    ...(productIds && { discount_product_ids: productIds }),
  }

  try {
    await apiFetch('/discount', { auth: true, body })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not create the discount') }
  }
  revalidatePath('/seller/discounts')
  redirect('/seller/discounts')
}

interface LookupState extends ActionState {
  data?: Discount
}

export async function lookupDiscountByCodeAction(
  _prev: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const code = String(formData.get('code') ?? '').trim()
  if (!code) return { ok: false, message: 'Enter a discount code' }
  try {
    const data = await apiFetch<Discount>(`/discount/code/${encodeURIComponent(code)}`)
    return { ok: true, data }
  } catch (e) {
    // Backend throws specific reasons (expired/inactive/not-found) — surface verbatim.
    return { ok: false, message: errorMessage(e, 'No usable discount for that code') }
  }
}
```

- [ ] **Step 2:** `pnpm typecheck` → clean. **Step 3:** (commit by controller.)

---

### Task 4: Create discount form

**File:** Create `components/discounts/create-discount-form.tsx`.

- [ ] **Step 1:**
```tsx
'use client'
import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createDiscountAction } from '@/actions/discount.actions'
import { initialActionState } from '@/actions/state'
import { SubmitButton } from '@/components/auth/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AppliesTo, DiscountType } from '@/types/discount'

export function CreateDiscountForm() {
  const [state, formAction] = useActionState(createDiscountAction, initialActionState)
  const [type, setType] = useState<DiscountType>('fixed_amount')
  const [appliesTo, setAppliesTo] = useState<AppliesTo>('all')

  useEffect(() => {
    if (!state.ok && state.message) toast.error(state.message)
  }, [state])

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>New discount</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="discount_name">Name</Label>
            <Input id="discount_name" name="discount_name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discount_description">Description</Label>
            <Textarea id="discount_description" name="discount_description" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discount_code">Code</Label>
            <Input id="discount_code" name="discount_code" required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select name="discount_type" value={type} onValueChange={(v) => setType(v as DiscountType)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_amount">Fixed amount</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount_value">Value</Label>
              <Input id="discount_value" name="discount_value" type="number" step="0.01" min="0" required />
              <p className="text-xs text-muted-foreground">
                {type === 'percentage' ? '0–100 (percent)' : 'Amount off'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="discount_start_date">Start date</Label>
              <Input id="discount_start_date" name="discount_start_date" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount_end_date">End date</Label>
              <Input id="discount_end_date" name="discount_end_date" type="date" required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="discount_max_uses">Max uses (optional)</Label>
              <Input id="discount_max_uses" name="discount_max_uses" type="number" min="1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount_max_uses_per_user">Per user (optional)</Label>
              <Input id="discount_max_uses_per_user" name="discount_max_uses_per_user" type="number" min="1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount_min_order_value">Min order (optional)</Label>
              <Input id="discount_min_order_value" name="discount_min_order_value" type="number" min="0" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Applies to</Label>
            <Select name="discount_applies_to" value={appliesTo} onValueChange={(v) => setAppliesTo(v as AppliesTo)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                <SelectItem value="specific_products">Specific products</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {appliesTo === 'specific_products' ? (
            <div className="space-y-2">
              <Label htmlFor="discount_product_ids">Product IDs</Label>
              <Input id="discount_product_ids" name="discount_product_ids" placeholder="id1, id2, id3" />
              <p className="text-xs text-muted-foreground">Comma-separated product IDs.</p>
            </div>
          ) : null}

          <SubmitButton>Create discount</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2:** `pnpm typecheck`. Self-check: do all `name`s match schema keys? does the Select submit `discount_type`/`discount_applies_to`? **Step 3:** (commit by controller.)

---

### Task 5: Discount list + code lookup

**Files:** Create `components/discounts/discount-list.tsx` and `components/discounts/discount-code-lookup.tsx`.

- [ ] **Step 1: `discount-list.tsx`** (Server Component-compatible; no client hooks):
```tsx
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Discount } from '@/types/discount'

function formatDate(s: string): string {
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10)
}

function valueLabel(d: Discount): string {
  return d.discount_type === 'percentage' ? `${d.discount_value}%` : String(d.discount_value)
}

function statusBadge(d: Discount) {
  if (d.is_expired) return <Badge variant="destructive">Expired</Badge>
  if (d.discount_is_active === false) return <Badge variant="secondary">Inactive</Badge>
  return <Badge>Active</Badge>
}

export function DiscountList({ discounts }: { discounts: Discount[] }) {
  if (discounts.length === 0) {
    return <p className="text-sm text-muted-foreground">No discounts yet.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Valid</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {discounts.map((d) => (
          <TableRow key={d._id}>
            <TableCell className="font-medium">{d.discount_code}</TableCell>
            <TableCell>{d.discount_name}</TableCell>
            <TableCell><Badge variant="secondary">{d.discount_type}</Badge></TableCell>
            <TableCell>{valueLabel(d)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDate(d.discount_start_date)} – {formatDate(d.discount_end_date)}
            </TableCell>
            <TableCell>{statusBadge(d)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: `discount-code-lookup.tsx`** (`'use client'`):
```tsx
'use client'
import { useActionState } from 'react'
import { lookupDiscountByCodeAction } from '@/actions/discount.actions'
import { SubmitButton } from '@/components/auth/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const initial = { ok: false as boolean, message: undefined as string | undefined, data: undefined }

export function DiscountCodeLookup() {
  const [state, formAction] = useActionState(lookupDiscountByCodeAction, initial)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Look up a code</CardTitle>
        <CardDescription>Check whether a discount code is currently usable.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" required />
          </div>
          <SubmitButton>Look up</SubmitButton>
        </form>
        {state.ok && state.data ? (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">{state.data.discount_name}</p>
            <p className="text-muted-foreground">
              {state.data.discount_type === 'percentage'
                ? `${state.data.discount_value}% off`
                : `${state.data.discount_value} off`}
            </p>
          </div>
        ) : null}
        {!state.ok && state.message ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
```

> `SubmitButton` is `w-full`; in the flex row it will stretch — acceptable, or wrap it in a `div` with fixed width. Verify visually during smoke test; not blocking.

- [ ] **Step 3:** `pnpm typecheck`. **Step 4:** (commit by controller.)

---

### Task 6: Discounts pages

**Files:** Create `app/(seller)/seller/discounts/page.tsx` and `app/(seller)/seller/discounts/new/page.tsx`.

- [ ] **Step 1: list page** — `app/(seller)/seller/discounts/page.tsx`:
```tsx
import Link from 'next/link'
import { apiFetch } from '@/lib/api/server-client'
import { getAccessPayload } from '@/lib/auth/session'
import { buttonVariants } from '@/components/ui/button'
import { DiscountList } from '@/components/discounts/discount-list'
import { DiscountCodeLookup } from '@/components/discounts/discount-code-lookup'
import type { Discount } from '@/types/discount'

export default async function DiscountsPage() {
  const payload = await getAccessPayload()
  let discounts: Discount[] = []
  let error: string | null = null
  try {
    discounts = await apiFetch<Discount[]>(`/discount/shop/${payload?.userId ?? ''}`, { auth: true })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load discounts'
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Discounts</h1>
        <Link href="/seller/discounts/new" className={buttonVariants()}>New discount</Link>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : <DiscountList discounts={discounts} />}
      <DiscountCodeLookup />
    </div>
  )
}
```

- [ ] **Step 2: create page** — `app/(seller)/seller/discounts/new/page.tsx`:
```tsx
import Link from 'next/link'
import { CreateDiscountForm } from '@/components/discounts/create-discount-form'

export default function NewDiscountPage() {
  return (
    <div className="space-y-6">
      <Link href="/seller/discounts" className="text-sm text-primary hover:underline">← Back to discounts</Link>
      <h1 className="text-2xl font-semibold">New discount</h1>
      <CreateDiscountForm />
    </div>
  )
}
```

- [ ] **Step 3:** `pnpm typecheck && pnpm build` — expect routes `/seller/discounts`, `/seller/discounts/new`. **Step 4:** (commit by controller.)

---

### Task 7: Full verification + STATUS

- [ ] **Step 1:** `pnpm typecheck && pnpm lint && pnpm build` — typecheck clean; lint 0 errors; build shows `/seller/discounts` + `/seller/discounts/new`.
- [ ] **Step 2:** `pnpm test:run` — on Node ≥ 20.12 all pass (prior + discount schema 5). On 20.9.0 record the environmental startup error.
- [ ] **Step 3:** Update `docs/frontend-seller-dashboard-STATUS.md`: set M4 row to `✅ **Xong**`; add a "Đã làm — M4" section (files, the `discount_shop_id` send-but-overridden quirk, strict get-by-code, no edit/delete/query, dates→ISO).
- [ ] **Step 4:** Also update STATUS §6 note / §1 table if needed. (Commit by controller.)
- [ ] **Step 5: Manual smoke test (needs backend + API_KEY + shop grants):**
  1. `/seller/discounts` → your discounts load (or a clear error).
  2. `/seller/discounts/new` → fill a fixed_amount discount, all products, future dates → Create → redirected, appears in list.
  3. Create a percentage discount > 100 → backend rejects with the bound message.
  4. `specific_products` without product IDs → blocked (FE) ; with IDs → created.
  5. Code lookup: valid usable code → details; expired/inactive/unknown → the backend's exact reason.

---

## Self-review notes (author)

- **Spec coverage:** types (T1), validation incl. percentage bound / end>start / specific-requires-ids (T2), create + lookup actions incl. shop_id send-but-overridden + date→ISO + comma split (T3), create form with conditional product-ids (T4), list + code lookup surfacing backend reason (T5), pages (T6), verify+STATUS+smoke (T7). Matches spec §2–§9.
- **Type consistency:** `Discount`/`DiscountType`/`AppliesTo` from T1 used identically across T3/T4/T5/T6; action names `createDiscountAction`/`lookupDiscountByCodeAction` consistent between T3 and importers; form field `name`s match `createDiscountSchema` keys (`discount_*`).
- **Placeholders:** all code fully specified (no new shadcn to discover — Select/Table/Badge/Textarea APIs already known from M3). The `pruneEmpty` step in T3 handles the optional-number coercion edge (empty strings dropped before parse).
