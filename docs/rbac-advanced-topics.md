# RBAC & Backend — Kiến thức nâng cao (mở rộng mục "Đọc thêm")

> Tài liệu này đào sâu các chủ đề được liệt kê ở mục **6. Đọc thêm** của [user-rbac-implementation-guide.md](user-rbac-implementation-guide.md). Mỗi phần: lý thuyết → ví dụ trong repo → bẫy thường gặp.
>
> Ngày tạo: 2026-06-18 · Phần Pub/Sub tách riêng tại [redis-pubsub-guide.md](redis-pubsub-guide.md).

Mục lục:
1. `accesscontrol` — Any/Own, attributes, filter
2. Mongoose — `select:false`, `lean()`, sub-documents, denormalize vs populate
3. Caching — cache-aside, invalidation, multi-instance
4. JWT — access/refresh, vì sao ngắn hạn, refresh token rotation
5. Bảo mật mật khẩu — bcrypt cost factor, không log secret

---

## 1. `accesscontrol` — Any/Own, attributes, filter

### 1.1 Lý thuyết

`accesscontrol` hiện thực **RBAC có 2 trục**:

- **Possession (sở hữu)**: `own` vs `any`.
  - `own` = chỉ tài nguyên **của chính mình**.
  - `any` = tài nguyên **của bất kỳ ai** (bao trùm `own`).
- **Attributes (thuộc tính)**: được thao tác trên **field nào** của tài nguyên (projection ở tầng quyền).

Một quyền = `role` × `action` (create/read/update/delete) × `possession` (own/any) × `attributes`.

### 1.2 API cốt lõi

```ts
import { AccessControl } from 'accesscontrol'

const ac = new AccessControl([
  { role: 'shop', resource: 'product', action: 'update:own', attributes: '*, !product_ratingsAverage' },
  { role: 'admin', resource: 'product', action: 'update:any', attributes: '*' },
])

ac.can('shop').updateOwn('product').granted   // true
ac.can('shop').updateAny('product').granted   // false  (shop không sửa product người khác)
ac.can('admin').updateAny('product').granted  // true
```

**`attributes` & `.filter()`** — lọc bớt field không được phép đụng:

```ts
const perm = ac.can('shop').updateOwn('product')
const safe = perm.filter(req.body)
// nếu attributes = '*, !product_ratingsAverage' thì field product_ratingsAverage bị loại khỏi safe
```

Cú pháp attributes:
- `'*'` — tất cả field.
- `'*, !usr_password'` — tất cả **trừ** `usr_password` (dấu `!` = loại trừ).
- `'usr_name, usr_email'` — **chỉ** 2 field này (whitelist).

### 1.3 Áp dụng trong repo

Middleware `grantAccess(action, resource)` (RBAC guide, Step 2.4) chỉ check **granted hay không**. Để dùng `:own` đúng nghĩa, controller cần so chủ sở hữu:

```ts
// ví dụ: shop chỉ sửa được product của shop mình
const product = await ProductService.findById(id)
const isOwner = String(product.product_shop) === req.shopId // shopId suy ra từ req.user.userId
if (!isOwner && !ac.can(role).updateAny('product').granted) {
  throw new ForbiddenError('Not your product')
}
const data = ac.can(role)[isOwner ? 'updateOwn' : 'updateAny']('product').filter(req.body)
```

> Mẹo: cho middleware gắn `req.permission = ac.can(role)...` để controller tái dùng cho `.filter()`, tránh tính 2 lần.

### 1.4 Bẫy
- `updateAny` **không** tự động bao `updateOwn` ở mức gọi hàm — phải gọi đúng tên. Khi check "được hay không" nên thử cả `Any` rồi `Own` (middleware đã làm vậy).
- `grant` rỗng cho 1 role → mọi `.granted` = false (mặc định **deny**). Đây là hành vi đúng (an toàn theo mặc định).

---

## 2. Mongoose — `select:false`, `lean()`, sub-documents, denormalize vs populate

### 2.1 `select: false` — ẩn field nhạy cảm theo mặc định

```ts
usr_password: { type: String, required: true, select: false }
```
- Mọi query mặc định **không** trả `usr_password` → không lo lỡ tay trả password ra API.
- Khi *cần* (lúc login): `.select('+usr_password')` (tiền tố `+` để ép lấy lại).

**Lý thuyết**: đây là nguyên tắc **secure by default** — thứ nguy hiểm phải *chủ động xin* mới có, thay vì *chủ động ẩn* (dễ quên).

### 2.2 `.lean()` — bỏ "hydrate"

Mặc định Mongoose trả về **document** (có method `.save()`, getter/setter, virtuals...) → nặng. `.lean()` trả **plain JS object**:
- ✅ Nhanh hơn nhiều, ít RAM — hợp cho **đọc-rồi-trả** (API list, build cache).
- ❌ Không gọi được `.save()`, mất virtuals/middleware. Đừng `.lean()` khi bạn định sửa rồi `.save()`.

### 2.3 Sub-documents (mảng object lồng)

`rol_grants` là **array of sub-documents**:
```ts
rol_grants: [{ resource: String, actions: [String], attributes: String }]
```
- Lồng (embed) hợp khi dữ liệu con **luôn đi cùng** cha và **không query độc lập** — đúng với grants (chỉ có nghĩa trong ngữ cảnh role). Đọc role là có luôn grants, **1 lần đọc, không join**.

### 2.4 Denormalize vs `populate` — quyết định lớn của MongoDB

- **`populate`** = giả lập JOIN: lưu `ObjectId ref`, lúc đọc Mongoose chạy thêm query lấy doc liên quan.
  - ✅ Chuẩn hoá, một nguồn sự thật, sửa 1 chỗ.
  - ❌ Thêm round-trip (N+1 nếu lặp), chậm trên hot-path.
- **Denormalize** = nhân bản dữ liệu vào nơi dùng (như Cách B: lưu **tên** resource thẳng vào grant).
  - ✅ Đọc 1 phát, không join → tối ưu cho **đọc-nhiều**.
  - ❌ Dữ liệu lặp; nếu nguồn đổi phải cập nhật nhiều nơi.

**Nguyên tắc chọn**: dữ liệu **đọc nhiều, ghi/đổi hiếm, gắn với code** → denormalize. Dữ liệu **đổi thường xuyên, cần nhất quán tức thì** → ref + populate.

> Trong repo: `order_products`/`order_checkout` của `Order` là **snapshot** (denormalize có chủ đích) — giá/sản phẩm tại thời điểm đặt phải "đóng băng", không được đổi theo product gốc. Đây là denormalize đúng đắn kinh điển.

### 2.5 Bẫy
- `.lean()` rồi định `.save()` → lỗi (object thường không có `.save()`).
- Quên `+` khi select field `select:false` → field trả về `undefined`, tưởng "mất dữ liệu".
- Lạm dụng `populate` lồng nhiều cấp trên list lớn → chậm; cân nhắc denormalize hoặc cache.

---

## 3. Caching — cache-aside, invalidation, multi-instance

### 3.1 Cache-aside (lazy loading) — pattern dùng trong `AccessControlService`

```
đọc:
  data = cache.get(key)
  nếu miss → data = db.read(); cache.set(key, data, ttl)
  trả data
```
- "Aside" = cache nằm *bên cạnh* DB; app tự quản. Chỉ nạp cái thực sự được hỏi (lazy).
- Repo dùng 3 tầng L1 (RAM) → L2 (Redis) → L3 (Mongo). L1 nhanh nhất nhưng riêng từng process → cần invalidate xuyên instance.

### 3.2 Invalidation — "2 thứ khó nhất trong CS"

3 chiến lược:
1. **Write-through invalidation** (repo dùng): ghi DB xong → **xoá** key cache. Lần đọc sau tự nạp lại bản mới.
2. **TTL**: cho key tự hết hạn (lưới an toàn nếu lỡ miss event invalidate).
3. **Versioning**: đổi version key (`rbac:grants:v2`) thay vì xoá — tránh "thundering herd" khi nhiều request cùng miss.

Repo kết hợp **(1) + (2)**: xoá key + publish event drop L1 ở mọi instance + TTL 1h phòng hờ.

### 3.3 Multi-instance

L1 trong RAM mỗi process là độc lập → khi 1 instance ghi, phải báo các instance khác. Cơ chế: **Redis pub/sub** (xem doc riêng [redis-pubsub-guide.md](redis-pubsub-guide.md)). Đây là cầu nối tự nhiên giữa caching và pub/sub.

### 3.4 Bẫy
- Cache cái **không serializable** (class instance) → hỏng. Cache **dữ liệu thô** (grant-list JSON) rồi *dựng lại* instance (`new AccessControl(list)`).
- Quên invalidate khi sửa thẳng DB → stale.
- TTL quá ngắn → cache vô dụng; quá dài mà không invalidate → dữ liệu cũ lâu.

---

## 4. JWT — access/refresh, vì sao ngắn hạn, rotation

### 4.1 Lý thuyết

**JWT** = token tự chứa (self-contained): `header.payload.signature`, ký bằng secret (repo dùng **HS256** đối xứng). Server verify chữ ký là tin payload mà **không cần tra DB** → stateless, mở rộng dễ.

Hệ quả 2 mặt: vì stateless nên **không thu hồi được token đã cấp** trước khi hết hạn (server không "nhớ" token). Giải pháp công nghiệp: **2 token**.

| | Access token | Refresh token |
|---|---|---|
| Sống | **Ngắn** (repo: 2 ngày — thực tế nên vài phút–1h) | Dài (repo: 7 ngày) |
| Dùng để | Gọi API hằng ngày | Xin access token mới khi hết hạn |
| Lộ ra thì | Thiệt hại **giới hạn theo thời gian sống** | Nguy hiểm hơn → cần rotation |

→ Access token **ngắn hạn** để nếu bị lộ thì kẻ tấn công chỉ dùng được trong thời gian rất ngắn.

### 4.2 Refresh token rotation — repo đã có nền tảng

Cơ chế (xem `KeyToken` + `AuthService.refreshToken`):
- Mỗi lần refresh: cấp refresh token **mới**, đẩy refresh token **cũ** vào `refreshTokensUsed`.
- Nếu một refresh token **đã dùng** lại xuất hiện (`findByRefreshTokenUsed`) → dấu hiệu **bị đánh cắp/replay** → **xoá toàn bộ key token**, buộc đăng nhập lại.

Đây là **reuse detection** — chuẩn bảo mật hiện đại (OAuth 2.0 BCP). `KeyToken` lưu `secretKey` riêng cho mỗi phiên cũng cho phép **thu hồi** (xoá KeyToken = vô hiệu token) — bù lại nhược điểm stateless của JWT.

### 4.3 Liên hệ RBAC

Vì ta nhúng `roles` vào payload (RBAC guide, Step 2.2), đổi role của user **không** ảnh hưởng token đang sống tới khi nó hết hạn → access token nên **ngắn hạn** để role mới có hiệu lực sớm. Với hành động siêu nhạy cảm, có thể tra `usr_roles` từ DB thay vì tin token.

### 4.4 Bẫy
- Nhét dữ liệu nhạy cảm (password, PII) vào payload — JWT **chỉ ký, không mã hoá**, ai cũng decode đọc được payload.
- Access token sống quá dài → khó thu hồi, role cũ tồn tại lâu.
- HS256 (đối xứng): secret rò rỉ là giả mạo được token. Nhiều service nên cân nhắc RS256 (bất đối xứng) — repo có comment generateKeyPair RSA bị tắt, là hướng nâng cấp.

---

## 5. Bảo mật mật khẩu — bcrypt cost factor, không log secret

### 5.1 Vì sao bcrypt (không phải MD5/SHA256)

- Hash mật khẩu phải **chậm có chủ đích** để chống brute-force. MD5/SHA quá nhanh → dò hàng tỉ/giây.
- **bcrypt** có **cost factor** (work factor): `bcrypt.hash(pwd, 10)` → `2^10 = 1024` vòng. Tăng cost → chậm theo cấp số nhân → tốn công kẻ tấn công.
- bcrypt **tự sinh salt** và nhúng vào chuỗi hash (`$2b$10$<salt><hash>`) → không cần lưu salt riêng (vì sao `usr_salt` trong repo là optional/để học).

### 5.2 Chọn cost factor
- 10–12 là khoảng phổ biến 2024+. Cao hơn = an toàn hơn nhưng login chậm hơn (vài trăm ms). Đo trên server thật rồi chọn sao cho ~250ms/hash.
- `bcrypt.compare(plain, hash)` tự đọc cost + salt từ chuỗi hash → không cần truyền lại.

### 5.3 Không bao giờ log secret
- Đừng `console.log` password, secretKey, token. Trong repo, `createTokenPair` có log token để debug — **nên gỡ trước production**.
- Đảm bảo `usr_password`/`secretKey` không lọt vào response (đã có `select:false` + `getInfoData` whitelist field).
- Error handler ở `app.ts` đang trả cả `stack` ra client — tiện debug nhưng **nên tắt ở production** (lộ thông tin nội bộ).

### 5.4 Bẫy
- Hash lại một mật khẩu đã hash (double hash) khi update → login sai. Chỉ hash khi password **thay đổi**.
- Dùng cùng secretKey cho mọi user → lộ 1 là lộ tất. Repo cấp `secretKey` ngẫu nhiên **mỗi phiên** (tốt).
- So sánh chuỗi token bằng `===` cho dữ liệu bí mật → cân nhắc timing-safe compare ở chỗ nhạy cảm.

---

## Tổng kết — bản đồ liên kết

```
RBAC guide ──┬── accesscontrol  (mục 1)  → quyết định cho qua/chặn
             ├── Mongoose       (mục 2)  → lưu & đọc dữ liệu tối ưu
             ├── Caching        (mục 3)  → đừng query hot-path
             │      └── Pub/Sub → redis-pubsub-guide.md (invalidate đa instance)
             ├── JWT            (mục 4)  → ai-là-ai, ngắn hạn + rotation
             └── bcrypt         (mục 5)  → lưu mật khẩu an toàn
```

Mỗi chủ đề đều xoay quanh một nguyên tắc chung: **secure & correct by default, tối ưu cái được dùng nhiều, đừng tin dữ liệu hơn mức cần thiết.**
