# U4 — Product Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A comments section on the product detail page — read (public), post, reply (one level), and delete-own — over the Express `/comment` API.

**Architecture:** BFF pattern. Comments live on the existing public `/products/[id]` page (no new route, no proxy change). One `GET /comment?productId=X` returns all comments; group client-side. Post/delete are Server Actions requiring auth (anonymous post → login redirect); the write action injects `userId` from the session.

**Tech Stack:** Next.js 16, React 19, TS, Tailwind, shadcn (Base UI), `sonner`. No new shadcn.

**Spec:** [2026-07-14-storefront-u4-comments-design.md](../specs/2026-07-14-storefront-u4-comments-design.md)

**Working directory:** `e-commerce-nextjs/`.

## Context every task needs

- **Reuse:** `apiFetch`/`ApiError`; `errorMessage`; `ActionState`/`initialActionState`; `getClientId`; `SubmitButton`; UI (`Textarea`, `Button`, `Card*`).
- **Backend facts (verified):**
  - `GET /comment?productId=X` (public) → `Comment[]` — ALL comments (top-level + replies mixed), oldest-first. Only `userId` per item (no author name — populate is dead).
  - `POST /comment` (auth) body `{ productId, userId, content, parentId, replyToUserId }` — `userId` from body → inject from `getClientId()`. Top-level: `parentId=null, replyToUserId=null`. Reply: `parentId=<rootId>, replyToUserId=<root.userId>`.
  - `DELETE /comment` (auth) body `{ commentId, productId }` — no ownership check (FE gates to own); deleting a root cascades to replies.
- **Conventions:** English copy, sentence case, empathetic errors; `params` async; `'use server'` files export only async functions.
- **Vitest runner** blocked on Node 20.9.0 — run `pnpm typecheck` when it won't start.
- **Git:** controller handles commits; implement + verify. Never touch `.agents/`/`skills-lock.json`.

## File structure

| File | Responsibility |
|---|---|
| `types/comment.ts` | `Comment` |
| `lib/comments/group.ts` (+test) | `groupComments` |
| `actions/comment.actions.ts` | create + delete |
| `components/store/comment-form.tsx` | Form (client) |
| `components/store/comment-section.tsx` | List + replies + delete (client) |
| `app/(store)/products/[id]/page.tsx` | + comments (modify) |
| STATUS.md, backend-gaps-guide.md | U4 done + comment gaps |

---

### Task 1: Comment type

**File:** Create `types/comment.ts`.

- [ ] **Step 1:**
```ts
export interface Comment {
  id: string
  productId: string
  userId: string
  content: string
  parentId: string | null
  replyToUserId: string | null
  createdAt?: string
}
```
- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** (commit by controller.)

---

### Task 2: groupComments helper

**Files:** Create `lib/comments/group.ts`, `lib/comments/__tests__/group.test.ts`.

- [ ] **Step 1: Write the failing test:**
```ts
import { describe, it, expect } from 'vitest'
import { groupComments } from '@/lib/comments/group'
import type { Comment } from '@/types/comment'

const c = (over: Partial<Comment>): Comment => ({
  id: 'x', productId: 'p', userId: 'u', content: 'hi', parentId: null, replyToUserId: null, ...over,
})

describe('groupComments', () => {
  it('separates top-level from replies', () => {
    const { topLevel, repliesByParent } = groupComments([
      c({ id: 'a', parentId: null }),
      c({ id: 'b', parentId: 'a', replyToUserId: 'u' }),
      c({ id: 'd', parentId: null }),
    ])
    expect(topLevel.map((t) => t.id)).toEqual(['a', 'd'])
    expect(repliesByParent['a'].map((r) => r.id)).toEqual(['b'])
    expect(repliesByParent['d']).toBeUndefined()
  })
  it('groups multiple replies under the right parent', () => {
    const { repliesByParent } = groupComments([
      c({ id: 'a', parentId: null }),
      c({ id: 'b', parentId: 'a' }),
      c({ id: 'e', parentId: 'a' }),
    ])
    expect(repliesByParent['a'].map((r) => r.id)).toEqual(['b', 'e'])
  })
  it('returns empty groups for an empty list', () => {
    const { topLevel, repliesByParent } = groupComments([])
    expect(topLevel).toEqual([])
    expect(repliesByParent).toEqual({})
  })
})
```

- [ ] **Step 2:** Run the test (expect module-not-found or environmental error).

- [ ] **Step 3: Implement** — `lib/comments/group.ts`:
```ts
import type { Comment } from '@/types/comment'

export function groupComments(list: Comment[]): {
  topLevel: Comment[]
  repliesByParent: Record<string, Comment[]>
} {
  const topLevel: Comment[] = []
  const repliesByParent: Record<string, Comment[]> = {}
  for (const c of list) {
    if (c.parentId == null) {
      topLevel.push(c)
    } else {
      ;(repliesByParent[c.parentId] ??= []).push(c)
    }
  }
  return { topLevel, repliesByParent }
}
```

- [ ] **Step 4:** Re-run test (3 pass) or `pnpm typecheck`. **Step 5:** (commit by controller.)

---

### Task 3: Comment actions

**File:** Create `actions/comment.actions.ts`.

- [ ] **Step 1:**
```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { apiFetch } from '@/lib/api/server-client'
import { errorMessage } from '@/lib/api/error-message'
import { getClientId } from '@/lib/auth/session'
import type { ActionState } from '@/actions/state'

export async function createCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get('productId') ?? '')
  const content = String(formData.get('content') ?? '').trim()
  const parentId = (formData.get('parentId') as string) || null
  const replyToUserId = (formData.get('replyToUserId') as string) || null
  if (!productId) return { ok: false, message: 'Missing product' }
  if (!content) return { ok: false, message: 'Write a comment first' }

  const userId = await getClientId()
  if (!userId) redirect(`/login?redirect=/products/${productId}`)

  try {
    await apiFetch('/comment', {
      auth: true,
      body: { productId, userId, content, parentId, replyToUserId },
    })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not post your comment') }
  }
  revalidatePath(`/products/${productId}`)
  return { ok: true, message: parentId ? 'Reply posted' : 'Comment posted' }
}

export async function deleteCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const commentId = String(formData.get('commentId') ?? '')
  const productId = String(formData.get('productId') ?? '')
  if (!commentId || !productId) return { ok: false, message: 'Missing comment' }
  try {
    await apiFetch('/comment', { method: 'DELETE', auth: true, body: { commentId, productId } })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Could not delete the comment') }
  }
  revalidatePath(`/products/${productId}`)
  return { ok: true, message: 'Comment deleted' }
}
```

- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** (commit by controller.)

---

### Task 4: Comment form

**File:** Create `components/store/comment-form.tsx`.

- [ ] **Step 1:**
```tsx
'use client'
import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { createCommentAction } from '@/actions/comment.actions'
import { initialActionState } from '@/actions/state'
import { SubmitButton } from '@/components/auth/submit-button'
import { Textarea } from '@/components/ui/textarea'

export function CommentForm({
  productId,
  parentId,
  replyToUserId,
  onDone,
}: {
  productId: string
  parentId?: string
  replyToUserId?: string
  onDone?: () => void
}) {
  const [state, formAction] = useActionState(createCommentAction, initialActionState)
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message)
      ref.current?.reset()
      onDone?.()
    } else if (!state.ok && state.message) {
      toast.error(state.message)
    }
  }, [state, onDone])

  return (
    <form ref={ref} action={formAction} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      {replyToUserId ? <input type="hidden" name="replyToUserId" value={replyToUserId} /> : null}
      <Textarea name="content" placeholder={parentId ? 'Write a reply…' : 'Write a comment…'} required />
      <SubmitButton>{parentId ? 'Reply' : 'Post comment'}</SubmitButton>
    </form>
  )
}
```

> `ref.current?.reset()` clears the textarea after a successful post. `SubmitButton` is `w-full`; acceptable in this stacked form.

- [ ] **Step 2:** `pnpm typecheck`. **Step 3:** (commit by controller.)

---

### Task 5: Comment section

**File:** Create `components/store/comment-section.tsx`.

- [ ] **Step 1:**
```tsx
'use client'
import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { deleteCommentAction } from '@/actions/comment.actions'
import { initialActionState } from '@/actions/state'
import { groupComments } from '@/lib/comments/group'
import { CommentForm } from '@/components/store/comment-form'
import { Button } from '@/components/ui/button'
import type { Comment } from '@/types/comment'

function authorLabel(userId: string): string {
  return `Customer ••${userId.slice(-4)}`
}

function formatDate(s?: string): string {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function DeleteButton({ commentId, productId }: { commentId: string; productId: string }) {
  const [state, formAction] = useActionState(deleteCommentAction, initialActionState)
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message)
    else if (!state.ok && state.message) toast.error(state.message)
  }, [state])
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="commentId" value={commentId} />
      <input type="hidden" name="productId" value={productId} />
      <Button type="submit" variant="ghost" size="xs">Delete</Button>
    </form>
  )
}

function CommentItem({
  comment,
  productId,
  currentUserId,
  isReply,
}: {
  comment: Comment
  productId: string
  currentUserId?: string
  isReply?: boolean
}) {
  return (
    <div className={isReply ? 'border-l pl-4' : ''}>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{authorLabel(comment.userId)}</span>
        <span className="text-muted-foreground">{formatDate(comment.createdAt)}</span>
        {comment.userId === currentUserId ? (
          <DeleteButton commentId={comment.id} productId={productId} />
        ) : null}
      </div>
      <p className="text-sm">{comment.content}</p>
    </div>
  )
}

export function CommentSection({
  productId,
  comments,
  currentUserId,
}: {
  productId: string
  comments: Comment[]
  currentUserId?: string
}) {
  const { topLevel, repliesByParent } = groupComments(comments)
  const [replyOpen, setReplyOpen] = useState<string | null>(null)

  return (
    <section className="space-y-6 border-t pt-8">
      <h2 className="text-xl font-semibold">Comments</h2>
      <CommentForm productId={productId} />

      {topLevel.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment.</p>
      ) : (
        <ul className="space-y-6">
          {topLevel.map((c) => (
            <li key={c.id} className="space-y-3">
              <CommentItem comment={c} productId={productId} currentUserId={currentUserId} />
              <div className="pl-4">
                <Button variant="ghost" size="xs" onClick={() => setReplyOpen(replyOpen === c.id ? null : c.id)}>
                  {replyOpen === c.id ? 'Cancel' : 'Reply'}
                </Button>
                {replyOpen === c.id ? (
                  <div className="mt-2">
                    <CommentForm
                      productId={productId}
                      parentId={c.id}
                      replyToUserId={c.userId}
                      onDone={() => setReplyOpen(null)}
                    />
                  </div>
                ) : null}
              </div>
              {(repliesByParent[c.id] ?? []).map((r) => (
                <CommentItem key={r.id} comment={r} productId={productId} currentUserId={currentUserId} isReply />
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

> Uses `size="xs"` (present in the button `cva`, seen in M3). Verify during typecheck; if absent, use `size="sm"`.

- [ ] **Step 2:** `pnpm typecheck`. Confirm `Button` supports `size="xs"` (from `components/ui/button.tsx` variants); else switch to `"sm"`. **Step 3:** (commit by controller.)

---

### Task 6: Wire comments into the product page

**File:** Modify `app/(store)/products/[id]/page.tsx`.

- [ ] **Step 1:** Add imports:
```tsx
import { getClientId } from '@/lib/auth/session'
import { CommentSection } from '@/components/store/comment-section'
import type { Comment } from '@/types/comment'
```

- [ ] **Step 2:** In the component, after loading `product` (in the success branch, before/after the `return`), fetch comments + current user. Since the page already early-returns on error/not-found, add this fetch just before the final `return` (where `product` is non-null):
```tsx
  let comments: Comment[] = []
  try {
    comments = await apiFetch<Comment[]>(`/comment?productId=${id}`)
  } catch {
    comments = []
  }
  const currentUserId = await getClientId()
```

- [ ] **Step 3:** In the JSX, after the closing `</div>` of the two-column product grid (the outer `<div className="grid gap-8 md:grid-cols-2">`), before the outermost closing `</div>`, add:
```tsx
      <CommentSection productId={id} comments={comments} currentUserId={currentUserId} />
```
So the structure becomes: `<div class="space-y-6"> <Link/> <div class="grid..."> …product… </div> <CommentSection/> </div>`.

- [ ] **Step 4:** `pnpm typecheck && pnpm build` — `/products/[id]` builds. **Step 5:** (commit by controller.)

---

### Task 7: Full verification + STATUS + backend gaps

- [ ] **Step 1:** `pnpm typecheck && pnpm lint && pnpm build` — clean; `/products/[id]` builds. (Stale `.next/dev/types` → `rm -rf .next/dev` and re-run.)
- [ ] **Step 2:** `pnpm test:run` — on Node ≥ 20.12 all pass (prior + `groupComments`). On 20.9.0 record the environmental error.
- [ ] **Step 3:** Update `docs/frontend-seller-dashboard-STATUS.md`: set U4 row to `✅ **Xong**`; add a "Đã làm — U4" section (files; one-fetch grouping; body-userId injection; delete-own gating; author-name/ownership backend gaps). Note the storefront (U1–U4) is complete.
- [ ] **Step 4:** Append to `docs/backend-gaps-guide.md` a part documenting the comment gaps (delete ownership, body `userId`, dead author populate) per spec §9.
- [ ] **Step 5:** (commit by controller.)
- [ ] **Step 6: Manual smoke test (backend + API_KEY):**
  1. `/products/[id]` → Comments section shows existing comments (or empty state).
  2. Anonymous "Post comment" → redirect to login; after login, post → appears.
  3. Reply on a comment → appears indented under it.
  4. Delete shows only on your own comments; delete a root → its replies vanish too.

---

## Self-review notes (author)

- **Spec coverage:** type (T1), groupComments (T2), create/delete actions incl. anonymous redirect + body-userId injection (T3), form (T4), section with replies + delete-own (T5), product-page wiring + one-fetch (T6), verify+STATUS+gaps (T7). Matches spec §3–§9.
- **Type consistency:** `Comment` (T1) used in T2/T3(implicit)/T5/T6; `groupComments` return shape consistent T2/T5; action names consistent T3↔T4/T5; hidden field names (`productId`,`content`,`parentId`,`replyToUserId`,`commentId`) match action readers.
- **Placeholders:** all code specified. T6 gives explicit placement instructions rather than re-pasting the page. `size="xs"` flagged with a fallback.
- **Risk note:** delete is wired to a backend route lacking ownership enforcement; the FE only *shows* delete on own comments (defense-in-depth is the backend's job, documented). Author name is unavailable by backend limitation; a generic label is used deliberately.
