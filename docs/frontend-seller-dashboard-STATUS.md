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

Xây frontend chuẩn best-practice cho toàn bộ tính năng backend, **ưu tiên Seller Dashboard trước**, storefront khách hàng làm sau. Chia 4 milestone:

| Milestone | Nội dung | Trạng thái |
|---|---|---|
| **M1** | Nền tảng (BFF, session, proxy) + Auth (signup/OTP/login/logout) | ✅ **Xong** (build/test/lint sạch) |
| **M2** | Nâng cấp lên Shop + cập nhật avatar + role-gate `/seller` | ⏳ Chưa làm |
| **M3** | Quản lý sản phẩm: list draft/published, tạo (2 bước), sửa, publish, upload ảnh | ⏳ Chưa làm |
| **M4** | Discount: tạo, xem theo shop, tra cứu theo code | ⏳ Chưa làm |
| **BE docs** | Tài liệu hướng dẫn fix 2 lỗi backend (dùng `senior-doc-writer`) | ⏳ Chưa làm |

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

## 6. Backend gaps — cần tài liệu riêng (KHÔNG sửa source BE)

Dùng skill `senior-doc-writer` tạo doc trong `docs/` mô tả cách fix, kèm file/dòng + đề xuất:

1. **`updateAvatar` thiếu `.send(res)`** — [src/features/user/controllers/index.ts](../src/features/user/controllers/index.ts): tạo `OkResponse` nhưng không gọi `.send(res)` → request `/user/me/avatar` **treo/timeout**. Ảnh hưởng M2.
2. **Discount thiếu route update/delete/query** — đã có `UpdateDiscountDTO`/`QueryDiscountDTO` nhưng router chỉ wire create + get-by-code + get-by-shop. Ảnh hưởng M4.

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
- UI **tiếng Việt**.
