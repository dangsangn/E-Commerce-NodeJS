# U4 Design — Product Comments (threaded, 1 level)

> **Milestone:** U4 of the customer storefront (final storefront milestone). See [STATUS](../../frontend-seller-dashboard-STATUS.md).
> **Branch:** `feature/frontend-seller-dashboard`
> **Date:** 2026-07-14
> **Prereq:** U1–U3 done.

## 1. Goal

Let customers read and post comments on a product (with one level of replies) on the product detail page, over the Express `/comment` API. Final customer milestone (U1 browse ✓, U2 cart ✓, U3 checkout+orders ✓ → **U4 comments**).

Note: the backend is a **threaded comment system** (`content` + `parentId`), not star-rating reviews — there is no rating field. "Reviews" in the roadmap = product comments.

## 2. Architecture & auth

A **comments section on the existing public `/products/[id]` page** — no new route, no proxy change. The page fetches all comments for the product in one call and groups them (top-level + replies). Read is public; post/delete are Server Actions requiring auth — an anonymous post redirects to login (same pattern as add-to-cart). Comment writes never expose the API key; the write action injects the user id server-side.

## 3. Backend contract (verified in source)

- `GET /comment?productId=X&limit=&skip=` (public) → `Comment[]`. **Returns ALL comments for the product** (top-level + replies mixed): the repo only applies a `parentId` filter when `parentId` is truthy, and the default is `null`, so no filter → everything. Sorted `createdAt` ascending.
  - ⚠️ **Author name unavailable:** `findComments` calls `.populate('user', ...)`/`.populate('replyToUser', ...)`, but the schema has no `user`/`replyToUser` paths (only `userId`/`replyToUserId`), and `mapToEntity` maps only `userId`. So each item carries `userId` (string) but **no name/email**. The FE shows a generic author label + a short id suffix.
- `POST /comment` (auth) body `{ productId, userId, content, parentId, replyToUserId }` → creates a comment, returns the mapped entity. **`userId` is taken from the request body**, not from auth — the write action injects it from `getClientId()`. `parentId`/`replyToUserId` are `null` for a top-level comment; for a reply, `parentId` = the root comment id and `replyToUserId` = that comment's `userId`.
- `DELETE /comment` (auth) body `{ commentId, productId }` → deletes; deleting a root (`parentId === null`) also deletes its replies (`$or` on `_id`/`parentId`). Returns `true`.
  - ⚠️ **No ownership check:** `deleteComment` verifies the comment exists but does **not** check that the caller owns it — any authenticated user can delete any comment. The FE only shows a delete control on the current user's own comments (compare `comment.userId` to the session user id); documented as a backend authorization gap.

## 4. Files

| File | New/Modify | Responsibility |
|---|---|---|
| `types/comment.ts` | Create | `Comment` |
| `lib/comments/group.ts` (+test) | Create | Pure `groupComments(list)` → `{ topLevel, repliesByParent }` |
| `actions/comment.actions.ts` | Create | `createCommentAction`, `deleteCommentAction` |
| `components/store/comment-form.tsx` | Create | Client: content textarea + submit (top-level or reply) |
| `components/store/comment-section.tsx` | Create | Client: list + reply toggles + delete-own |
| `app/(store)/products/[id]/page.tsx` | Modify | Fetch comments + `getClientId()` → render `<CommentSection>` |
| STATUS.md, backend-gaps-guide.md | Modify | U4 done + comment authz/populate gaps |

No new shadcn (reuse `Textarea`, `Button`, `Card`). Reuses the session helper and `errorMessage`.

## 5. Key behaviors

### 5.1 Product page (server, modify)
- After the product info block, `const comments = await apiFetch<Comment[]>('/comment?productId=' + id)` (public; try/catch → `[]` on failure) and `const currentUserId = await getClientId()`.
- Render `<CommentSection productId={id} comments={comments} currentUserId={currentUserId} />`.

### 5.2 `groupComments(list)` (pure, tested)
- `topLevel` = items with `parentId == null`.
- `repliesByParent` = `Record<parentId, Comment[]>` for items with a non-null `parentId`.
- Preserves the backend's ascending order.

### 5.3 `<CommentSection>` (client)
- Props `{ productId, comments, currentUserId }`. Computes `groupComments`.
- Renders a heading + a top-level `<CommentForm productId />` (post a comment).
- For each top-level comment: author label (`Customer ••{userId.slice(-4)}`), date, content; a Delete button **iff** `comment.userId === currentUserId`; a "Reply" toggle (client state per comment) revealing `<CommentForm productId parentId={comment.id} replyToUserId={comment.userId} onDone={close} />`; then its replies (indented) each with author/date/content + Delete-if-own.
- Empty state: "No comments yet. Be the first to comment."

### 5.4 `<CommentForm>` (client)
- Props `{ productId, parentId?, replyToUserId?, onDone? }`. `useActionState(createCommentAction)`; a `Textarea name="content"` + hidden `productId`/`parentId`/`replyToUserId`; `SubmitButton` ("Post comment" / "Reply"). On success toast + `onDone?.()`; on error toast. Requires non-empty content.

### 5.5 Actions
- `createCommentAction`: read `productId`, `content` (trim; empty → error), `parentId` (or null), `replyToUserId` (or null). `getClientId()` → anonymous → `redirect('/login?redirect=/products/' + productId)`. Else `POST /comment { productId, userId: clientId, content, parentId, replyToUserId }`; `revalidatePath('/products/' + productId)`; `{ ok:true }`.
- `deleteCommentAction`: read `commentId`, `productId`; `DELETE /comment { commentId, productId }`; `revalidatePath('/products/' + productId)`; `{ ok:true, message:'Comment deleted' }`.

## 6. Error handling
- Actions catch `ApiError` → `{ ok, message }` → toast. The comment fetch on the product page is try/catch (never breaks the page).

## 7. Testing
- **Unit (pure):** `groupComments` — separates top-level from replies; groups replies under the correct parent; empty list → empty groups; a reply whose parent isn't in the list still appears under its `parentId` key.
- No network tests for actions.
- ⚠️ Vitest runner still Node-blocked (20.9.0); tests pass on ≥ 20.12.
- Static gates clean; `/products/[id]` still builds.

## 8. Pitfalls (verified)
- **`userId` is body-supplied on create** — inject from `getClientId()`; never trust a client field.
- **Author name isn't returned** — display a generic label + short id; don't assume `user.name`.
- **Delete has no server ownership check** — gate the control to own comments on the FE; the backend still needs the fix (documented). Deleting a root cascades to replies.
- **One fetch returns everything** — group client-side; do not issue a per-parent request (no N+1).
- **Anonymous post** — the product page is public; the action must redirect to login.
- **`'use server'` files export only async functions**; type in `types/comment.ts`, helper in `lib/comments`.

## 9. Backend gaps to document (append to backend-gaps-guide.md)
- **Comment delete lacks ownership enforcement** — `CommentUseCase.deleteComment(commentId, productId)` never checks the caller owns the comment; any authenticated user can delete anyone's comment. Fix: pass the caller's `userId` and verify `comment.userId === userId` before deleting.
- **Create trusts body `userId`** — the controller passes `req.body` straight through; it should set `userId = req.user.userId` server-side, ignoring any client-supplied value.
- **Comment list populate is dead** — `.populate('user'|'replyToUser')` references non-existent schema paths (fields are `userId`/`replyToUserId`), and the mapper drops them, so author names never reach the client. Fix: add virtuals/refs or map `userId`→user via a lookup, and include the name in the entity.

## 10. Out of scope
- Star ratings (no backend field).
- Nesting beyond one reply level; edit-comment (no route).
- Author profile display (blocked by the populate gap).
- Pagination of comments (single fetch, default limit 50).
