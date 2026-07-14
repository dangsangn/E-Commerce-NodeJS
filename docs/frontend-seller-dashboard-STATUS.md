# Frontend Seller Dashboard — Trạng thái & Kế hoạch tiếp theo

> **Mục đích:** File bàn giao (handoff) để tiếp tục công việc ở phiên sau. Tóm tắt *đã làm gì*, *vì sao làm vậy*, *cách chạy/kiểm tra*, và *làm tiếp gì*.
>
> - **App:** [e-commerce-nextjs/](../e-commerce-nextjs) — Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui + TypeScript
> - **Backend:** [src/](../src) — Express 5 + MongoDB, base `/api/v1`
> - **Nhánh:** `feature/frontend-seller-dashboard`
> - **Tài liệu gốc:** [Spec thiết kế](superpowers/specs/2026-07-12-ecommerce-nextjs-frontend-design.md) · [Plan M1](superpowers/plans/2026-07-12-frontend-seller-m1-foundation-auth.md)
> - **Cập nhật:** 2026-07-12

---

## 1. Tổng quan nhanh

Xây frontend chuẩn best-practice cho toàn bộ tính năng backend. **Seller Dashboard (M1–M4) đã xong**; nay làm tiếp **storefront khách hàng (U1–U4)**.

**Seller Dashboard:**

| Milestone | Nội dung | Trạng thái |
|---|---|---|
| **M1** | Nền tảng (BFF, session, proxy) + Auth (signup/OTP/login/logout) | ✅ **Xong** (build/test/lint sạch) |
| **M2** | Nâng cấp lên Shop + cập nhật avatar + role-gate `/seller` | ✅ **Xong** (typecheck/lint/build sạch) |
| **M3** | Quản lý sản phẩm: list draft/published, tạo (2 bước), sửa, publish, upload ảnh | ✅ **Xong** (typecheck/lint/build sạch) |
| **M4** | Discount: tạo, xem theo shop, tra cứu theo code | ✅ **Xong** (typecheck/lint/build sạch) |
| **BE docs** | Tài liệu hướng dẫn fix 2 lỗi backend (dùng `senior-doc-writer`) | ✅ **Xong** → [backend-gaps-guide.md](backend-gaps-guide.md) |

**Customer Storefront (phần user):**

| Milestone | Nội dung | Trạng thái |
|---|---|---|
| **U1** | Nền tảng store (layout public) + duyệt: catalog (search + phân trang) + trang chi tiết SP | ✅ **Xong** (typecheck/lint/build sạch) |
| **U2** | Giỏ hàng (cart): thêm/sửa số lượng/xoá | ⏳ Chưa làm |
| **U3** | Checkout review + đặt hàng + lịch sử đơn + huỷ đơn | ⏳ Chưa làm |
| **U4** | Đánh giá sản phẩm (comments/reviews) | ⏳ Chưa làm |

---

## 2. Kiến trúc & lý do (đọc trước khi làm tiếp)

**Next.js server chính là BFF.** Trình duyệt không bao giờ thấy `x-api-key` hay JWT.

```
Browser ──(cookie httpOnly)──► Next.js server ──(x-api-key + x-client-id + authorization)──► Express /api/v1
   ▲  Server Components (đọc)                                                                     │
   └─ Server Actions (ghi) ◄──────────────── envelope { message, statusCode, data } ◄────────────┘
```

Các quyết định chốt và **vì sao**:

- **BFF + cookie httpOnly** thay vì gọi backend trực tiếp: giấu `API_KEY` ở server, chống XSS đánh cắp token (JS client không đọc được cookie httpOnly). Đây là lý do mọi call backend đi qua [lib/api/server-client.ts](../e-commerce-nextjs/lib/api/server-client.ts) (đánh dấu `import 'server-only'`).
- **Server Components + Server Actions** thay vì client-fetch: ít JS phía client, mutation qua action + `revalidatePath`. `useActionState` cho form + toast lỗi.
- **Refresh token bằng `proxy.ts` (middleware của Next 16)**: cookie chỉ ghi được ở Server Action / Route Handler / proxy — **không** ghi được khi render Server Component. Nên refresh access token (sắp hết hạn) được làm proactively trong proxy trước khi request vào trang. Proxy cũng là nơi chặn `/seller`.
- **Roles nằm trong JWT, không có trong response body**: server decode payload JWT (không verify chữ ký, chỉ đọc claim `roles`) để gate UI. Backend vẫn enforce RBAC thật.

**Hợp đồng auth với backend (quan trọng, dễ sai):**
- Mọi request: header `x-api-key`.
- Request thường cần auth: `x-client-id` (userId) + `authorization` (access token).
- **Chỉ** `/auth/refresh-token` và `/auth/logout`: `x-client-id` + `x-refresh-token` (KHÔNG gửi `x-refresh-token` cho request thường — backend sẽ đi nhánh refresh và bỏ qua `authorization`).
- Token: access hết hạn **2 ngày**, refresh **7 ngày**, HS256, payload `{ userId, email, roles[], type, exp, iat }`.

---

## 3. Đã làm — M1 (Nền tảng + Auth)

**Kiểm tra (đã pass toàn bộ):** `pnpm test:run` → **22/22**; `pnpm typecheck` sạch; `pnpm build` sạch (không cảnh báo); `pnpm lint` sạch.

### File đã tạo/sửa
| File | Vai trò |
|---|---|
| [lib/api/http.ts](../e-commerce-nextjs/lib/api/http.ts) | Helper thuần (có test): `buildHeaders`, `unwrap`, `ApiError` |
| [lib/api/server-client.ts](../e-commerce-nextjs/lib/api/server-client.ts) | `apiFetch<T>()` — nơi DUY NHẤT gọi backend (server-only) |
| [lib/auth/tokens.ts](../e-commerce-nextjs/lib/auth/tokens.ts) | Edge-safe (có test): `COOKIE`, `decodeJwt`, `isExpiringSoon`, `hasRole` |
| [lib/auth/session.ts](../e-commerce-nextjs/lib/auth/session.ts) | Cookie httpOnly: `setSession`, `clearSession`, `getAccessPayload`, `isShop`… |
| [lib/validations/auth.ts](../e-commerce-nextjs/lib/validations/auth.ts) | Zod schema (có test): signup/login/verifyOtp |
| [actions/auth.actions.ts](../e-commerce-nextjs/actions/auth.actions.ts) | Server Actions: signup/login/verifyOtp/resendOtp/logout |
| [actions/state.ts](../e-commerce-nextjs/actions/state.ts) | `ActionState` + `initialActionState` (tách khỏi file `'use server'`) |
| [proxy.ts](../e-commerce-nextjs/proxy.ts) | Refresh token proactively + chặn `/seller` (matcher `/seller/:path*`) |
| [app/(auth)/](../e-commerce-nextjs/app/(auth)) | Trang login, signup, verify-otp + layout |
| [components/auth/](../e-commerce-nextjs/components/auth) | `LoginForm`, `SignupForm`, `VerifyOtpForm`, `SubmitButton` |
| [app/(seller)/seller/](../e-commerce-nextjs/app/(seller)/seller) | Shell `/seller` (hiện email + role + nút Đăng xuất) |
| [types/api.ts](../e-commerce-nextjs/types/api.ts) | Kiểu API dùng chung |
| [app/page.tsx](../e-commerce-nextjs/app/page.tsx) | `/` → redirect `/seller` |
| [next.config.ts](../e-commerce-nextjs/next.config.ts) | `turbopack.root` (im lặng cảnh báo nhiều lockfile) |

### 2 điều chỉnh so với plan M1 (đều đúng best-practice Next 16)
1. **`middleware.ts` → `proxy.ts`**, hàm export default `proxy`: Next 16 đã deprecate tên `middleware`.
2. **Tách `initialActionState` sang [actions/state.ts](../e-commerce-nextjs/actions/state.ts)**: file `'use server'` chỉ được export async function (không export object/const).

---

## 3b. Đã làm — M2 (Upgrade Shop + Avatar + Role-gate)

**Kiểm tra:** `pnpm typecheck` sạch · `pnpm lint` sạch (0 error) · `pnpm build` sạch (route `/seller/account` xuất hiện, `ƒ Proxy (Middleware)` còn nguyên). Test unit đã viết thêm (gate + user schema) nhưng **runner vitest chưa chạy được trên Node 20.9.0** (`node:util` thiếu `styleText`, cần Node ≥ 20.12) — đây là gap môi trường, không phải lỗi code.

### File đã tạo/sửa
| File | Vai trò |
|---|---|
| [lib/auth/gate.ts](../e-commerce-nextjs/lib/auth/gate.ts) | `shouldGateShop(pathname, roles)` — hàm thuần, edge-safe (có test) |
| [proxy.ts](../e-commerce-nextjs/proxy.ts) | Gọi `shouldGateShop` **sau** block refresh → redirect `/seller/account` nếu non-shop |
| [lib/validations/user.ts](../e-commerce-nextjs/lib/validations/user.ts) | `upgradeShopSchema` (`{ shopName? }`, có test) |
| [lib/api/server-client.ts](../e-commerce-nextjs/lib/api/server-client.ts) | Thêm `signal?: AbortSignal` vào `apiFetch` (additive) |
| [lib/api/error-message.ts](../e-commerce-nextjs/lib/api/error-message.ts) | `errorMessage(e, fallback)` tách dùng chung (bỏ trùng lặp giữa 2 file action) |
| [actions/user.actions.ts](../e-commerce-nextjs/actions/user.actions.ts) | `upgradeToShopAction` (⚠️ `setSession` token MỚI), `updateAvatarAction` (timeout 10s) |
| [components/ui/avatar.tsx](../e-commerce-nextjs/components/ui/avatar.tsx) | shadcn Avatar (Base UI) |
| [components/account/upgrade-shop-form.tsx](../e-commerce-nextjs/components/account/upgrade-shop-form.tsx) | Card Shop: trạng thái hoặc form upgrade |
| [components/account/avatar-form.tsx](../e-commerce-nextjs/components/account/avatar-form.tsx) | Card Profile: avatar + form upload |
| [app/(seller)/seller/account/page.tsx](../e-commerce-nextjs/app/(seller)/seller/account/page.tsx) | Server Component: đọc roles, render 2 card |

### Điều chỉnh so với plan M2
1. **Bỏ shadcn `form`**: style `base-nova` kéo theo `react-hook-form`, nhưng M2 giữ pattern Server-Action + `useActionState` của M1 (không dùng react-hook-form). Không component nào import `form.tsx` → cài vào chỉ thừa dependency. Chỉ cài `avatar` (dùng `@base-ui/react` đã có sẵn, không đổi manifest).
2. **Tách `errorMessage` sang module riêng** (kết quả code review): xoá trùng lặp verbatim giữa `auth.actions.ts` và `user.actions.ts`.

### Còn phải làm khi có môi trường (backend + API_KEY)
- Smoke test: login non-shop → vào `/seller` phải bị đẩy sang `/seller/account`; submit upgrade → toast "You're now a shop", card Shop chuyển "active", `/seller` hết bị chặn; upload avatar → sau ~10s hiện "Avatar upload is temporarily unavailable" (đúng như dự kiến, chờ backend fix `.send(res)` — xem §6).
- Chạy `pnpm test:run` trên Node ≥ 20.12 để xác nhận unit test (M1 22 + gate 4 + user schema 4).

---

## 3c. Đã làm — M3 (Quản lý sản phẩm)

**Kiểm tra:** `pnpm typecheck` sạch · `pnpm lint` sạch (0 error) · `pnpm build` sạch (3 route mới: `/seller/products`, `/seller/products/new`, `/seller/products/[id]/edit`). Unit test thêm (price + product schema) — vitest runner vẫn chờ Node ≥ 20.12.

### File đã tạo/sửa
| File | Vai trò |
|---|---|
| [types/product.ts](../e-commerce-nextjs/types/product.ts) | Kiểu Product/list/pagination/prepared-images + `PRODUCT_TYPES`, `CREATABLE_TYPES` |
| [lib/products/price.ts](../e-commerce-nextjs/lib/products/price.ts) | `toPriceString` chuẩn hoá Decimal128 (có test) |
| [lib/validations/product.ts](../e-commerce-nextjs/lib/validations/product.ts) | Zod discriminated-union theo `product_type` + `splitAttributes` + edit schema (có test) |
| [actions/product.actions.ts](../e-commerce-nextjs/actions/product.actions.ts) | 6 action: prepareImages, create, update, publish, unpublish, addImages |
| [components/products/](../e-commerce-nextjs/components/products) | `attribute-fields`, `image-uploader`, `create-product-form`, `product-list`, `product-row-actions`, `edit-product-form` |
| [app/(seller)/seller/products/](../e-commerce-nextjs/app/(seller)/seller/products) | list (`page.tsx`), tạo (`new/page.tsx`), sửa (`[id]/edit/page.tsx`) |
| [components/ui/](../e-commerce-nextjs/components/ui) | shadcn: table, tabs, badge, select, textarea |

### Ràng buộc backend quan trọng (đã verify trong source)
- **Tạo 2 bước bắt buộc**: `POST /product/upload/prepare` (multipart field **`images`**) → `{ productId, images, thumb }`; rồi `POST /product` dùng lại `productId`=`_id`, `thumb`, `images` y nguyên — backend từ chối nếu `public_id` không nằm dưới `products/{shopId}/{productId}`.
- **`product_price` là Decimal128** → JSON `{ $numberDecimal }` → normalize khi hiển thị (`toPriceString`), gửi number khi ghi.
- **Chỉ CLOTHING + ELECTRONICS tạo được** (SHOES/OTHER hiện trong dropdown nhưng disabled). Attribute theo type: Clothing `brand/color/size` (bắt buộc) + `material`; Electronics `manufacturer` (bắt buộc) + `model`.
- **Trạng thái draft/published không nằm trong payload** — quyết định bởi endpoint gọi (`/list/draft` vs `/list/published`); publish/unpublish là 2 route PATCH riêng.

### Còn phải làm khi có môi trường (backend + API_KEY + seed grant)
- ⚠️ **RBAC**: `protect('product')` cần grant create/read/update cho role `shop` (seed trong DB qua `accesscontrol`). Nếu chưa seed → 403 "You don't have permission…" (FE hiển thị message này). Đây là rủi ro smoke-test #1, không verify được nếu thiếu DB.
- Smoke test: `/seller/products` (2 tab) → tạo (upload ảnh → form details bật) → publish từ row → edit (đổi giá/mô tả, thêm ảnh) → thử ELECTRONICS (manufacturer bắt buộc), xác nhận SHOES/OTHER disabled.

---

## 3d. Đã làm — M4 (Discount)

**Kiểm tra:** `pnpm typecheck` sạch · `pnpm lint` sạch (0 error) · `pnpm build` sạch (2 route mới: `/seller/discounts`, `/seller/discounts/new`). Unit test thêm (discount create schema) — vitest runner vẫn chờ Node ≥ 20.12.

### File đã tạo/sửa
| File | Vai trò |
|---|---|
| [types/discount.ts](../e-commerce-nextjs/types/discount.ts) | Kiểu Discount + enum `DiscountType`/`AppliesTo` |
| [lib/validations/discount.ts](../e-commerce-nextjs/lib/validations/discount.ts) | Zod create schema (percentage ≤100, end>start, specific cần product_ids) (có test) |
| [actions/discount.actions.ts](../e-commerce-nextjs/actions/discount.actions.ts) | `createDiscountAction`, `lookupDiscountByCodeAction` |
| [components/discounts/](../e-commerce-nextjs/components/discounts) | `create-discount-form`, `discount-list`, `discount-code-lookup` |
| [app/(seller)/seller/discounts/](../e-commerce-nextjs/app/(seller)/seller/discounts) | list + lookup (`page.tsx`), tạo (`new/page.tsx`) |

### Phạm vi & ràng buộc backend (đã verify trong source)
- **Chỉ create + view** (get-by-shop + get-by-code). `update`/`delete`/`query` có trong service nhưng **KHÔNG route** → không làm FE (xem §6 gap #2).
- **`discount_shop_id`**: DTO validation bắt buộc non-empty, nhưng controller ghi đè bằng userId → FE gửi userId của mình để qua validation.
- **`discount_start/end_date` phải ISO** — convert từ `<input type="date">` (`YYYY-MM-DD`) sang ISO trong action.
- **`specific_products` cần `discount_product_ids`** (FE nhập chuỗi id ngăn cách bởi dấu phẩy → tách mảng; không làm product-picker).
- **get-by-code strict**: backend ném lỗi nếu chưa bắt đầu / hết hạn / inactive / không tồn tại — FE hiển thị đúng message đó.

### Còn phải làm khi có môi trường (backend + API_KEY + seed grant)
- Smoke test: `/seller/discounts` (list + tra cứu code) → tạo fixed_amount (all products, ngày tương lai) → xuất hiện trong list; thử percentage >100 (backend chặn), `specific_products` không id (FE chặn); tra cứu code hợp lệ → hiện chi tiết, code hết hạn/inactive/không có → hiện lý do backend.

---

## 3e. Đã làm — U1 (Storefront: nền tảng + duyệt sản phẩm)

**Kiểm tra:** `pnpm typecheck` sạch · `pnpm lint` sạch (0 error) · `pnpm build` sạch (route mới: `/` = store home, `/products/[id]`). Test thêm: `buildCatalogQuery` (4 case).

> 📄 Spec: [specs/…-storefront-u1-…](superpowers/specs/2026-07-14-storefront-u1-foundation-browse-design.md) · Plan: [plans/…-storefront-u1-…](superpowers/plans/2026-07-14-storefront-u1-foundation-browse.md)

### File đã tạo/sửa
| File | Vai trò |
|---|---|
| **`app/page.tsx`** | **ĐÃ XOÁ** — bỏ redirect `/`→`/seller`; `/` giờ là store home |
| [lib/products/catalog-query.ts](../e-commerce-nextjs/lib/products/catalog-query.ts) | `buildCatalogQuery` (map URL `q`→backend `keySearch`, clamp page) (có test) |
| [components/store/](../e-commerce-nextjs/components/store) | `search-box` (client), `product-card`, `product-grid`, `store-header` (server) |
| [app/(store)/layout.tsx](../e-commerce-nextjs/app/(store)/layout.tsx) | Shell store: header + main + footer |
| [app/(store)/page.tsx](../e-commerce-nextjs/app/(store)/page.tsx) | Catalog: grid + search + phân trang (Server Component) |
| [app/(store)/products/[id]/page.tsx](../e-commerce-nextjs/app/(store)/products) | Trang chi tiết SP (public) |

### Quyết định & ràng buộc (đã verify backend)
- **Store là public** — `apiFetch` gọi `GET /product`, `GET /product/:id` **không** `auth` (chỉ `x-api-key`). Proxy giữ nguyên matcher `/seller/:path*`.
- **`/` giờ = store home** (không còn auto-redirect sang `/seller`). Seller vào dashboard qua link "Seller dashboard" ở header (chỉ hiện khi JWT có role `shop`).
- **Param search backend là `keySearch`** (map từ `?q=`).
- ⚠️ **Backend caveat**: `GET /product/:id` (`getDetailProduct`) **không** lọc `isPublished` → link trực tiếp tới id draft vẫn render. Repo có `getProductPublishedById` nhưng chưa route. Đây là gap backend, U1 không workaround.

### Còn phải làm khi có môi trường (backend + API_KEY)
- Smoke test: `/` (anonymous) → grid SP published; search keyword → lọc; phân trang; click SP → `/products/[id]`; header đổi theo trạng thái login (anonymous "Sign in" / shop hiện "Seller dashboard" + "Sign out"); `/seller` vẫn gate.
- Tiếp theo: **U2 (cart)** — thêm cart icon vào header, nút Add to cart ở trang chi tiết.

---

## 4. Cách chạy & kiểm tra (khi quay lại)

```bash
# 1. Backend: chạy ở gốc repo (cần MongoDB + Redis + SMTP mailtrap theo .env.development)
pnpm dev            # cổng 5000

# 2. Frontend
cd e-commerce-nextjs
#   Điền API_KEY hợp lệ (đã seed trong DB backend, permission chứa 0000) vào .env.local:
#   BACKEND_URL=http://localhost:5000
#   API_KEY=<api-key-that>
pnpm dev            # cổng 3000

# Kiểm tra tĩnh bất cứ lúc nào:
pnpm test:run && pnpm typecheck && pnpm lint && pnpm build
```

**Smoke test luồng auth (cần backend + API_KEY):** mở `/signup` → điền form → redirect `/verify-otp` → nhập OTP (mailtrap) → auto-login vào `/seller`. Thử `/login`, Đăng xuất, và truy cập `/seller` khi chưa login (phải bị đẩy về `/login`). Kiểm DevTools: 3 cookie `access_token`/`refresh_token`/`client_id` đều `HttpOnly`; không request nào từ browser lộ `x-api-key`.

> ⚠️ Chưa smoke test end-to-end với backend thật (thiếu API_KEY môi trường). Đây là việc đầu tiên nên làm khi quay lại.

---

## 5. Sẽ làm tiếp

### M2 — Nâng cấp Shop + Avatar + Role-gate
- **Trang** `/seller/account`: form **upgrade-to-shop** và **cập nhật avatar**.
- Server actions mới trong `actions/user.actions.ts`:
  - `POST /user/me/upgrade-to-shop` body `{ shopName }` → trả `{ roles, tokens }` **token MỚI có role `shop`** → **phải `setSession` lại bằng token mới** (nếu không proxy vẫn thấy role cũ và chặn `/seller`). ⚠️ Đây là điểm dễ sai nhất của M2.
  - `PATCH /user/me/avatar` multipart `avatar` (dùng `apiFetch` với `multipart: FormData`).
- **Bổ sung role-gate vào [proxy.ts](../e-commerce-nextjs/proxy.ts)**: `/seller/*` yêu cầu `roles` chứa `shop`; nếu chưa phải shop → redirect `/seller/account` (cho phép vào account để nâng cấp). Hiện proxy mới chỉ chặn theo trạng thái đăng nhập.
- ⚠️ **Avatar backend đang lỗi** (xem §6) — FE thêm timeout + thông báo lỗi thân thiện, chưa dựa vào response.
- shadcn cần thêm: `form`, `avatar` (chạy `pnpm dlx shadcn@latest add form avatar`).

### M3 — Quản lý sản phẩm (trọng tâm, nặng nhất)
- **List**: `GET /product/list/draft` và `/product/list/published` (`?page&limit`) — Server Component + phân trang. shadcn `table`, `tabs`, `badge`.
- **Tạo sản phẩm (2 bước)**:
  1. `POST /product/upload/prepare` (multipart `images[]`) → `{ productId, images:[{url,public_id}], thumb }`.
  2. `POST /product` body theo `createProductSchema`: `_id`(=productId), `product_name`, `product_thumb`(=thumb.url), `product_thumb_public_id`, `product_images`, `product_price`, `product_quantity`, `product_type` (`ELECTRONICS|CLOTHING|SHOES|OTHER`), `product_attributes` (form key–value động theo type).
- **Sửa**: `PATCH /product/:id` (`updateProductSchema`: name/thumb/description/price/attributes).
- **Publish/Unpublish**: `PATCH /product/published/:id` · `PATCH /product/draft/:id`.
- **Thêm ảnh**: `PUT /product/upload/images/:productId` (multipart). **Upload theo link**: `POST /product/upload/link` `{ url }`.
- shadcn cần thêm: `select`, `textarea`, `dialog`, `table`, `tabs`, `badge`.

### M4 — Discount
- **Tạo**: `POST /discount` — form đủ field `CreateDiscountDTO` (fixed_amount/percentage, ngày bắt đầu/kết thúc, max_uses, max_uses_per_user, min_order_value, applies_to `all`/`specific_products` + chọn product, `discount_shop_id`=userId).
- **Xem theo shop**: `GET /discount/shop/:shopId`. **Tra cứu code**: `GET /discount/code/:code`.
- ⚠️ Backend **chưa có** route update/delete/query → M4 chỉ làm create + view (xem §6).

---

## 6. Backend gaps — đã có tài liệu riêng (KHÔNG sửa source BE)

✅ **Đã viết guide đầy đủ** (chẩn đoán + cơ chế + fix chính xác): [docs/backend-gaps-guide.md](backend-gaps-guide.md).

1. **`updateAvatar` thiếu `.send(res)`** — [src/features/user/controllers/index.ts](../src/features/user/controllers/index.ts): tạo `OkResponse` nhưng không gọi `.send(res)` → request `/user/me/avatar` **treo/timeout**. Ảnh hưởng M2. Fix = thêm `.send(res)`.
2. **Discount thiếu route update/delete/query** — đã có `UpdateDiscountDTO`/`QueryDiscountDTO` + service, nhưng router chỉ wire create + get-by-code + get-by-shop. Ảnh hưởng M4. Cần thêm controller method + route.
   - ⚠️ **Bẫy Express 5**: `validationMiddleware(..., 'query')` sẽ **crash** (req.query là getter read-only ở Express 5) → guide nêu 3 cách xử lý. Xem guide.

---

## 7. Cạm bẫy dễ gặp khi tiếp tục (senior notes)

- **Đừng gửi `x-refresh-token` cho request thường** — chỉ dùng cho refresh/logout (backend ưu tiên nhánh refresh nếu thấy header này).
- **Sau upgrade-to-shop phải ghi đè cookie bằng token mới** — token cũ không có role `shop`.
- **File `'use server'` chỉ export async function** — hằng/kiểu phải để file khác (bài học từ M1).
- **`cookies()` là async ở Next 16** — luôn `await`. Không ghi cookie được trong Server Component (chỉ Action/proxy).
- **`proxy.ts` chạy trên Edge** — chỉ dùng API edge-safe (`fetch`, `atob`, `TextDecoder`); không import module `server-only`/`next/headers`. Logic thuần cần cho proxy để ở [lib/auth/tokens.ts](../e-commerce-nextjs/lib/auth/tokens.ts).
- **Envelope**: `apiFetch` đã tự bóc `data` và ném `ApiError` — tầng action chỉ cần try/catch và trả `{ ok, message }`.

---

## 8. Bảo mật (đã áp dụng ở M1)

| Rủi ro | Cách xử lý |
|---|---|
| Lộ `API_KEY` | Chỉ đọc `process.env.API_KEY` ở server (`server-only` + proxy), không bao giờ ra client |
| XSS đánh cắp token | Token trong cookie **httpOnly** + `sameSite=lax` + `secure` (prod) |
| Refresh token reuse | Backend đã có cơ chế phát hiện; FE luôn ghi đè token mới sau refresh |
| CSRF | `sameSite=lax` giảm rủi ro cho form GET/POST cơ bản; cân nhắc CSRF token nếu mở rộng |

---

## 9. Quy ước làm việc đã thống nhất
- **Không commit sau mỗi task** trong lúc thực thi — commit theo mốc/khi được yêu cầu (như lần bàn giao này).
- Frontend code theo API hiện có; phần backend thiếu → tài liệu hướng dẫn, không sửa source BE.
- UI **tiếng Anh** (đã đổi từ tiếng Việt sau M1). Copy theo `writing-guidelines` (`.agents/skills`): nút dùng câu mệnh lệnh, tiêu đề/nút viết theo *sentence case*, thông báo lỗi thân thiện không xin lỗi, trạng thái loading kết thúc bằng `…`. Validation message (Zod) trong [lib/validations/auth.ts](../e-commerce-nextjs/lib/validations/auth.ts) cũng là UI copy → cũng dịch. **Chỉ còn** mô tả test (`it('…')`) trong `__tests__/` là tiếng Việt (nội bộ, không lộ ra UI).
