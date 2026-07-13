# Thiết kế Frontend E-Commerce (Next.js) — Giai đoạn 1: Seller Dashboard

- **Ngày:** 2026-07-12
- **Trạng thái:** Draft chờ duyệt
- **Frontend:** `e-commerce-nextjs/` (Next.js 16 App Router, React 19, Tailwind v4, TypeScript)
- **Backend:** `src/` (Express 5 + MongoDB), base URL `/api/v1`

## 1. Bối cảnh & Mục tiêu

Backend đã hoàn thiện với đầy đủ tính năng multi-vendor e-commerce (auth OTP, product draft/publish, cart, discount, checkout, order, inventory, comment, upload Cloudinary, RBAC). Frontend hiện là scaffold Next.js trống.

Mục tiêu tổng thể: dựng frontend chuẩn best practice cho **toàn bộ** tính năng backend. Tài liệu này đặc tả **Giai đoạn 1 — Seller Dashboard** (theo lựa chọn scope), đồng thời cố định kiến trúc dùng chung cho các giai đoạn sau (storefront khách hàng).

Mục tiêu Giai đoạn 1:
- Người dùng đăng ký (OTP email) → đăng nhập → giữ session an toàn.
- Nâng cấp tài khoản lên **Shop**, cập nhật avatar.
- Quản lý sản phẩm: tạo (2 bước upload ảnh → tạo), sửa, publish/unpublish, thêm ảnh, xem danh sách draft/published.
- Quản lý discount: tạo, xem theo shop, tra cứu theo code.

## 2. Quyết định thiết kế (chốt từ brainstorming)

| Vấn đề | Quyết định |
|---|---|
| Scope giai đoạn 1 | Seller dashboard trước; storefront khách hàng ở giai đoạn sau |
| Auth & kết nối API | **BFF bằng chính Next.js**: httpOnly cookie, `x-api-key` chỉ ở server |
| Data fetching / state | **Server Components** (đọc) + **Server Actions** (ghi) |
| UI toolkit | **shadcn/ui + Tailwind v4** |
| Refresh token | **Next.js middleware** refresh proactively + gate `/seller/*` |
| Thiếu sót backend | Frontend code theo API hiện có; phần BE thiếu được ghi tài liệu riêng bằng skill `senior-doc-writer` trong `docs/` (KHÔNG sửa source BE) |

## 3. Contract API backend (tham chiếu)

### 3.1 Base & Headers
- Base URL: `${BACKEND_URL}/api/v1`.
- **Mọi** request cần header `x-api-key: <API_KEY>` (backend kiểm tra qua `ApiKeyService`) và permission `0000` gắn với api key đó.
- Request cần auth (theo `checkAuth.ts`):
  - `x-client-id: <userId>` — **luôn bắt buộc**.
  - `authorization: <accessToken>` — cho request thường.
  - `x-refresh-token: <refreshToken>` — **chỉ** cho `/auth/refresh-token` và `/auth/logout`. Lưu ý: nếu header này có mặt, backend đi nhánh refresh và **bỏ qua** `authorization`. ⇒ Không bao giờ gửi `x-refresh-token` cho request thường.

### 3.2 Response envelope
- Thành công: `{ message: string, statusCode: number, data: T }`.
- Lỗi: `{ status: number, message: string, ... }` (ErrorResponse), trả kèm HTTP status tương ứng.

### 3.3 Token model
- `createTokenPair` (HS256, secret per-user): `accessToken` hết hạn **2 ngày**, `refreshToken` **7 ngày**.
- Payload JWT: `{ userId, email, roles: string[], type: 'access' | 'refresh' }`.
- `roles` **không** có trong response body của login — chỉ nằm trong JWT. Frontend decode payload (không cần verify chữ ký) để đọc `roles` phục vụ gate UI. Backend vẫn enforce RBAC thật.
- Role names: `user` | `shop` | `admin`. User status: `active` | `pending` | `block`.

### 3.4 Endpoints dùng ở Giai đoạn 1

**Auth** (`/auth`)
| Method | Path | Auth | Body → Data |
|---|---|---|---|
| POST | `/signup` | api-key | `{ email, password, name }` → (void; gửi OTP) |
| POST | `/verify-otp` | api-key | `{ email, otp }` → `{ user, tokens }` (auto-login) |
| POST | `/resend-otp` | api-key | `{ email }` → `{ message, email }` |
| POST | `/login` | api-key | `{ email, password }` → `{ user: {_id,email,name}, tokens: {accessToken,refreshToken} }` |
| POST | `/refresh-token` | `x-client-id` + `x-refresh-token` | → `{ tokens, shop }` |
| POST | `/logout` | `x-client-id` + `x-refresh-token` | → xoá keyToken |

- Trạng thái đăng nhập lỗi: user `pending` → 401 "Please verify your email first"; `block` → 401.
- Signup khi user đã `pending` → coi như resend OTP.

**User** (`/user`, cần auth)
| Method | Path | Body → Data |
|---|---|---|
| POST | `/me/upgrade-to-shop` | `{ shopName }` → `{ roles, tokens }` (**token mới có role `shop`**) |
| PATCH | `/me/avatar` | multipart `avatar` → `{ ... }` (⚠️ xem §7) |

**Product** (`/product`)
| Method | Path | Auth/RBAC | Ghi chú |
|---|---|---|---|
| POST | `/upload/prepare` | shop, multipart `images[]` | → `{ productId, images:[{url,public_id}], thumb:{url,public_id} }` |
| POST | `/` | shop | Body theo `createProductSchema` (xem dưới) |
| GET | `/list/draft` | shop | `?page&limit` → danh sách draft của shop |
| GET | `/list/published` | shop | `?page&limit` → danh sách published của shop |
| PATCH | `/:id` | shop | `updateProductSchema` (name, thumb, description, price, attributes) |
| PATCH | `/published/:id` | shop | publish sản phẩm |
| PATCH | `/draft/:id` | shop | chuyển về draft (unpublish) |
| PUT | `/upload/images/:productId` | shop, multipart `images[]` | thêm ảnh vào gallery |
| POST | `/upload/link` | shop | `{ url }` → upload ảnh từ URL |
| GET | `/:id` | public | chi tiết (dùng ở storefront) |
| GET | `/` | public | search (dùng ở storefront) |

`createProductSchema` (body POST `/product`):
```
_id: string                    // = productId từ /upload/prepare
product_name: string
product_thumb: string          // = thumb.url
product_thumb_public_id: string// = thumb.public_id
product_images: {url, public_id}[]  // = images
product_price: number
product_quantity: number
product_type: 'ELECTRONICS'|'CLOTHING'|'SHOES'|'OTHER'
product_attributes: any        // tuỳ product_type
```

**Discount** (`/discount`)
| Method | Path | Auth | Ghi chú |
|---|---|---|---|
| POST | `/` | shop | `CreateDiscountDTO` (xem dưới) |
| GET | `/shop/:shopId` | public | danh sách discount của shop |
| GET | `/code/:code` | public | tra cứu theo code |

`CreateDiscountDTO`: `discount_name`, `discount_description`, `discount_code`, `discount_type` (`fixed_amount`|`percentage`), `discount_value`, `discount_start_date`, `discount_end_date`, `discount_shop_id`, `discount_applies_to` (`all`|`specific_products`); optional: `discount_max_uses`, `discount_max_uses_per_user`, `discount_min_order_value`, `discount_is_active`, `discount_product_ids[]`.

## 4. Kiến trúc frontend

### 4.1 BFF bằng chính Next.js
Trình duyệt không bao giờ thấy `x-api-key` hay token. Mọi call tới backend đi qua server-side:
- **Đọc** dữ liệu → Server Components gọi `server-client`.
- **Ghi** dữ liệu → Server Actions gọi `server-client`, sau đó `revalidatePath`.
- Route Handler chỉ dùng khi thật sự cần client-initiated fetch (giai đoạn 1 gần như không cần).

### 4.2 `lib/api/server-client.ts` (server-only)
Nơi **duy nhất** gọi backend. `import 'server-only'` để chặn bundle ra client.
- Nhận `{ path, method, body, auth?: boolean, multipart?: boolean, tags?: string[] }`.
- Luôn set `x-api-key` từ `process.env.API_KEY`.
- Nếu `auth`: đọc cookie → set `x-client-id` + `authorization`.
- `multipart`: forward `FormData` (không set Content-Type thủ công).
- Bóc `{data}`; nếu HTTP !ok → ném `ApiError { status, message }`.
- Hỗ trợ `next: { tags }` cho revalidation.

### 4.3 `lib/auth/session.ts`
- `setSession({accessToken, refreshToken, clientId})`: ghi 3 cookie httpOnly, `secure` (prod), `sameSite=lax`, `path=/`. TTL access ~2 ngày, refresh ~7 ngày.
- `clearSession()`, `getSession()`.
- `decodeToken(token)`: base64-decode payload JWT (không verify) → `{ userId, email, roles, type, exp }`.
- `getRoles()`, `isShop()` phục vụ render có điều kiện.

### 4.4 Middleware (`middleware.ts`)
Chạy trên matcher `/seller/:path*` (và có thể `/account`):
1. Đọc cookie access token. Không có → redirect `/login?redirect=<path>`.
2. Decode `exp`; nếu còn < ~60s hoặc đã hết hạn và có refresh token → gọi `/auth/refresh-token` (với `x-client-id` + `x-refresh-token`), ghi cookie token mới. Refresh lỗi → clear session, redirect `/login`.
3. Gate role: decode `roles`; `/seller/*` yêu cầu chứa `shop`, nếu không → redirect `/seller/account` (trang nâng cấp) kèm thông báo.

> Middleware là nơi hợp lệ để ghi cookie (Server Component thì không), nên mọi thao tác refresh/ghi cookie tự động nằm ở đây.

### 4.5 Upload ảnh
Server Actions nhận `FormData` native → forward multipart sang `/product/upload/prepare`, `/product/upload/images/:id`, `/user/me/avatar`. Client dùng `<input type=file>` + preview; không đụng Cloudinary trực tiếp.

### 4.6 Xử lý lỗi & UX
- `ApiError` được Server Action bắt và trả về dạng `{ ok: false, message }` cho form (dùng `useActionState`); Server Component ném lỗi cho `error.tsx`.
- Toast (shadcn `sonner`) cho phản hồi mutation; `loading.tsx` + Suspense cho trạng thái tải.
- Validate form bằng zod ở cả client và trong action (khớp DTO backend tại `lib/validations/`).

## 5. Cấu trúc thư mục

```
e-commerce-nextjs/
├─ middleware.ts
├─ .env.local                 # BACKEND_URL, API_KEY (server-only)
├─ components.json            # config shadcn/ui
├─ app/
│  ├─ layout.tsx  globals.css
│  ├─ (auth)/
│  │  ├─ layout.tsx
│  │  ├─ login/page.tsx
│  │  ├─ signup/page.tsx
│  │  └─ verify-otp/page.tsx
│  └─ (seller)/seller/
│     ├─ layout.tsx           # sidebar dashboard
│     ├─ page.tsx             # tổng quan
│     ├─ account/page.tsx     # upgrade-to-shop + avatar
│     ├─ products/
│     │  ├─ page.tsx          # tabs draft/published + phân trang
│     │  ├─ new/page.tsx      # wizard tạo sản phẩm
│     │  └─ [id]/edit/page.tsx
│     ├─ discounts/
│     │  ├─ page.tsx          # list theo shop + tra cứu code
│     │  └─ new/page.tsx
│     ├─ loading.tsx  error.tsx
├─ actions/
│  ├─ auth.actions.ts  user.actions.ts
│  ├─ products.actions.ts  discounts.actions.ts
├─ lib/
│  ├─ api/server-client.ts
│  ├─ auth/session.ts
│  ├─ validations/{auth,product,discount}.ts
│  └─ utils.ts
├─ components/
│  ├─ ui/                     # shadcn primitives
│  └─ seller/                 # ProductForm, ImageUploader, DiscountForm, ProductTable, ...
└─ types/                     # Product, Discount, User, ApiEnvelope, Tokens
```

## 6. Milestones

### M1 — Nền tảng + Auth
- Cài & cấu hình shadcn/ui, `cn`, tokens Tailwind; `.env.local` mẫu.
- `server-client`, `session`, `middleware` (khung refresh + gate).
- Trang: login, signup, verify-otp (+ resend), logout action.
- Kết quả demo: đăng ký → nhận OTP → verify → auto-login → giữ session; login/logout hoạt động.

### M2 — Trở thành Shop + Account
- `/seller/account`: form upgrade-to-shop (ghi đè cookie bằng **token mới** → mở khoá `/seller`); form cập nhật avatar (multipart, preview).
- Middleware gate `/seller/*` theo role `shop`.
- Demo: user thường bị chặn khỏi `/seller`, sau upgrade truy cập được.

### M3 — Quản lý sản phẩm (trọng tâm)
- Danh sách draft & published (server component, phân trang `page/limit`).
- Wizard tạo sản phẩm: bước 1 upload ảnh (`/upload/prepare`) → nhận `productId`+ảnh; bước 2 điền form + submit `/product` với `_id`.
- Sửa (`PATCH /:id`), publish (`PATCH /published/:id`), unpublish (`PATCH /draft/:id`).
- Thêm ảnh gallery (`PUT /upload/images/:id`), upload theo link (`POST /upload/link`).
- Attributes theo `product_type` (form động).

### M4 — Discount
- Form tạo discount đầy đủ field `CreateDiscountDTO` (fixed/percentage, ngày, giới hạn dùng, min order, applies_to all/specific + chọn product).
- Danh sách discount theo shop (`GET /shop/:shopId`, `shopId` = userId hiện tại).
- Tra cứu theo code (`GET /code/:code`).
- Ràng buộc: chỉ create + view (BE chưa có update/delete/query — xem §7).

## 7. Backend gaps — tài liệu riêng (KHÔNG sửa source BE)

Dùng skill `senior-doc-writer` tạo tài liệu trong `docs/` mô tả các fix BE cần làm để frontend đầy đủ hơn:

1. **`updateAvatar` thiếu `.send(res)`** (`src/features/user/controllers/index.ts`): `OkResponse` được tạo nhưng không gửi → request `/user/me/avatar` treo/timeout. FE tạm xử lý: đặt timeout + thông báo lỗi thân thiện; sau khi BE fix sẽ bỏ workaround.
2. **Discount thiếu route update/delete/query**: đã có `UpdateDiscountDTO`/`QueryDiscountDTO` nhưng router chỉ wire create + get-by-code + get-by-shop. FE giai đoạn 1 chỉ làm create + view; khi BE thêm route sẽ mở rộng UI.

Tài liệu này liệt kê: mô tả lỗi, file/dòng liên quan, thay đổi đề xuất (kèm route/handler mẫu), và impact với frontend.

## 8. Testing
- Ưu tiên test cho logic thuần: `session` (decode token, tính exp), `validations` (zod), map dữ liệu form ↔ DTO.
- Smoke test luồng chính (login, tạo product) sau mỗi milestone bằng cách chạy thật (yêu cầu backend + biến môi trường API_KEY hợp lệ).
- Không mock backend sâu ở giai đoạn 1; test tập trung vào tầng FE tự chịu trách nhiệm.

## 9. Ngoài phạm vi (giai đoạn sau)
- Storefront khách hàng: search/list, chi tiết sản phẩm, giỏ hàng, checkout review, order (create/list/detail/cancel), comment, inventory hiển thị.
- Các trang này tái dùng nguyên `server-client`, `session`, shadcn ở giai đoạn 1.
