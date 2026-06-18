# Hướng dẫn triển khai Unified Identity + RBAC (User · Role · Resource)

> Tài liệu này viết theo kiểu "senior dev cầm tay chỉ việc". Mỗi bước đều có **WHY** (vì sao) trước **HOW** (làm thế nào). Bạn đọc tuần tự từ trên xuống, code theo, không nhảy cóc giữa các phase.
>
> Ngày tạo: 2026-06-17 · Áp dụng cho repo `Ecommerce-NodeJS` (Mongoose + Express + TypeScript + Redis).

---

## 0. Bối cảnh & vấn đề

Hiện tại model `Shop` đang ôm **3 trách nhiệm cùng lúc** — đây là một "code smell" gọi là *mixed responsibility*:

| Trách nhiệm | Field trong Shop hiện tại |
|---|---|
| **Identity / Authentication** (đăng nhập là ai) | `email`, `password` |
| **Authorization** (được làm gì) | `roles`, `verify`, `status` |
| **Profile người bán** (thông tin gian hàng) | `name` |

Bằng chứng hệ thống đã "biết" thiết kế này chưa đúng:

- `src/features/order/model/index.ts` → `order_userId` có comment `// temporarily using Shop as User`.
- `src/features/keyToken/models/index.ts` → `user` ref `'Shop'` (token đáng lẽ thuộc về *người dùng*, không phải *gian hàng*).
- `src/features/auth/services/index.ts` → có hằng `ROLES` dạng string rời rạc, signup tạo thẳng `ShopModel`.

### Mục tiêu

Tách thành 3 khái niệm độc lập, đúng như marketplace thật (Shopee/Tiki):

```
User   = danh tính + auth (nguồn sự thật duy nhất để đăng nhập)
Role   = phân quyền RBAC, có "grants" chi tiết theo resource/action
Shop   = chỉ còn là hồ sơ người bán, trỏ về owner là 1 User
```

Một `User` có thể vừa mua vừa bán (qua `usr_roles`). `Shop` chỉ sinh ra khi User mở gian hàng.

---

## 1. Kiến thức nền (đọc kỹ phần này trước khi code)

### 1.1 Authentication ≠ Authorization

Hai khái niệm hay bị lẫn:

- **Authentication (AuthN)** — "Bạn là ai?" → kiểm tra email + password, cấp JWT. Code hiện có (`AuthService.login`) làm phần này.
- **Authorization (AuthZ)** — "Bạn được phép làm gì?" → kiểm tra role/permission *sau khi* đã biết bạn là ai. Đây là phần **đang thiếu** ở tầng người dùng (middleware `permission()` hiện tại chỉ check quyền của **API key**, không phải của user).

Quy tắc: AuthN chạy trước, gắn `req.user`; AuthZ chạy sau, đọc `req.user` để quyết định cho qua hay chặn (403).

### 1.2 Vì sao tách Identity ra khỏi Profile?

Nếu mỗi loại tài khoản (buyer, seller, admin) là một collection riêng có `email`/`password` riêng thì:

- ❌ Một người muốn vừa mua vừa bán phải có 2 tài khoản, 2 lần đăng nhập.
- ❌ Logic auth (hash password, JWT, refresh token, quên mật khẩu...) bị **lặp lại** ở mỗi collection.
- ❌ Email trùng nhau giữa các collection → khó đảm bảo unique toàn hệ thống.

Giải pháp chuẩn: **một** collection `User` giữ identity + auth. "Bạn là buyer hay seller" là **vai trò (role)**, không phải **loại bảng (table)**. Thông tin riêng của người bán (mô tả shop, logo, doanh thu...) tách ra `Shop` và trỏ ngược về `User`.

### 1.3 RBAC và "grants" là gì?

**RBAC (Role-Based Access Control)** = phân quyền dựa trên vai trò. User không được gán quyền trực tiếp; User được gán **Role**, Role chứa danh sách **grants** (cấp phép).

Một "grant" trả lời 3 câu hỏi:

| Thành phần | Ý nghĩa | Ví dụ |
|---|---|---|
| `resource` | Tác động lên cái gì | `product`, `order`, `profile` |
| `action`   | Hành động gì + phạm vi | `create:any`, `read:own`, `update:own`, `delete:any` |
| `attributes` | Được đụng tới field nào | `*` (tất cả) hoặc `*, !usr_password` (trừ password) |

Hậu tố `:any` vs `:own` rất quan trọng:
- `:own` — chỉ thao tác trên tài nguyên **của chính mình** (seller chỉ sửa product của shop mình).
- `:any` — thao tác trên tài nguyên **của bất kỳ ai** (admin sửa product của mọi shop).

Ta dùng thư viện [`accesscontrol`](https://www.npmjs.com/package/accesscontrol) — chuẩn de-facto của RBAC trong Node. Nó nhận một "grant list" và cho phép check kiểu `ac.can('shop').createOwn('product').granted`.

> **Quyết định mô hình (quan trọng)**: `accesscontrol` luôn dùng `resource` ở **dạng string**. Vì vậy ta lưu thẳng **tên resource (string)** vào trong grant, **không** lưu `ObjectId ref Resource`. Lý do ở mục 1.5.

### 1.4 Reference data & vì sao phải cache

`Resource` và `Role` là **reference data**: tập dữ liệu **rất nhỏ**, **đọc cực nhiều** (mỗi request cần phân quyền), **ghi gần như không bao giờ** (chỉ khi dev/admin thêm vai trò mới).

Với loại dữ liệu này, "tối ưu" **không** phải là tối ưu câu query — mà là **đừng query MongoDB trên hot-path**. Ta cache "grant list" đã dựng sẵn trong RAM.

**Mặc định (1 process) — chỉ cần L1 in-memory + single-flight:**

```
L1: in-memory (biến _ac)  → nhanh nhất
L3: MongoDB (Roles)       → nguồn sự thật, query khi cache miss
```

- `_ac` build 1 lần, mọi request sau ăn cache RAM (~0ms). Khi sửa role → `invalidate()` chỉ cần `_ac = null` ngay trong process này (process vừa-ghi-vừa-đọc nên tự biết cache bẩn).
- Vấn đề cần lo ở traffic cao **không** phải đồng bộ đa instance, mà là **cache stampede**: khi `_ac == null` và nhiều request ập vào cùng lúc đều cùng build → giải bằng **single-flight** (gộp các lần build trùng vào một promise). Code ở Step 1.5c.

> **Nâng cấp khi chạy ≥ 2 process** (PM2 cluster `-i N`, nhiều container sau load balancer, docker compose master/slave): mỗi process có `_ac` riêng → sửa role ở process A thì B vẫn giữ bản cũ. Lúc đó thêm **L2 Redis + pub/sub** để invalidate xuyên process (đã có sẵn `pubClient`/`subClient`). Chi tiết: hộp "Nâng cấp" ở Step 1.5c và [redis-pubsub-guide.md](redis-pubsub-guide.md).
>
> ⚠️ Lưu ý: số process ≠ số port. "Chạy 1 port 5000" nhưng PM2 cluster 4 worker = **4 process** → vẫn cần pub/sub. Chỉ **đúng 1 process** mới bỏ được.

### 1.5 Vì sao grant lưu tên resource (string), không lưu ObjectId? — "Cách B"

Ta giữ collection `Resources` làm **registry** (danh bạ để liệt kê/validate), nhưng grant lưu **tên** resource:

```ts
rol_grants: [{ resource: 'product', actions: ['read:any'], attributes: '*' }]
//                       ▲ string, không phải ObjectId
```

- ✅ Build `AccessControl` chỉ cần đọc 1 collection `Roles`, **không `.populate()`, không join** — vì `accesscontrol` vốn cần string.
- ✅ Collection `Resources` vẫn dùng để: liệt kê cho màn admin, và **validate** tên resource hợp lệ lúc tạo grant.
- ⚖️ Đánh đổi: đổi tên resource phải sửa nhiều grant — nhưng resource **map vào code nên không bao giờ đổi tên**, nên đây là non-issue. Đúng tinh thần denormalize của MongoDB cho dữ liệu đọc-nhiều-ghi-hiếm.

### 1.6 Các pattern Mongoose dự án đang dùng (giữ nhất quán)

```ts
const DOCUMENT_NAME = 'Shop'        // tên model (đăng ký với mongoose.model)
const COLLECTION_NAME = 'Shops'     // tên collection trong Mongo

new Schema({...}, { timestamps: true, collection: COLLECTION_NAME })

export const ShopModel = model(DOCUMENT_NAME, shopSchema)
```

- **Ref giữa model**: `{ type: Schema.Types.ObjectId, ref: 'User' }` — `ref` khớp `DOCUMENT_NAME` model đích.
- **`.lean()`**: trả plain object (nhanh, nhẹ) khi chỉ đọc.
- **`.select()` / `select: false`**: field nhạy cảm (password) đặt `select: false` để mặc định không lộ.
- **Enum bằng `Object.freeze`** rồi `enum: Object.values(...)`.
- **Naming có prefix**: model mới prefix theo tên (`usr_`, `rol_`, `src_`).

---

## 2. Kiến trúc đích

```
   ┌─────────────┐   registry/validate    ┌──────────────────────────┐
   │  Resource   │◄───────────────────────│  Role                    │
   │  src_name   │                         │  rol_name: user|shop|... │
   └─────────────┘                         │  rol_grants[]:           │
                                           │   { resource:'product',  │  ← string
                                           │     actions, attributes }│
                                           └──────────▲───────────────┘
                                                      │ ref (mảng)
                                           ┌──────────┴───────────────┐
                              KeyToken ───►│           User           │◄─── Order.order_userId
                              .user        │  usr_email / usr_password │
                                           │  usr_roles[]              │
                                           └──────────▲───────────────┘
                                                      │ shop_owner (ref)
                                           ┌──────────┴───────────────┐
                                           │   Shop (hồ sơ người bán)  │
                                           └──────────────────────────┘
```

Lưu ý: `Resource` **không** được grant tham chiếu bằng `ObjectId` (Cách B) — nó chỉ là registry. Grant tự chứa tên resource.

**Module RBAC** gom Role + Resource vào một feature (chúng gắn chặt, quản lý chung):

```
src/features/rbac/
  models/
    resource.model.ts          # ResourceModel
    role.model.ts              # RoleModel
  services/
    resource.service.ts        # createResource / getResources
    role.service.ts            # createRole / updateRole / getRoles
    access-control.service.ts  # build + cache AccessControl  ← trái tim
  controllers/index.ts         # (Phase 2+) admin API
  routes/index.ts              # /rbac/roles, /rbac/resources (chỉ admin)
```

**Lộ trình 3 phase** (làm tuần tự, mỗi phase tự đứng được):

1. **Phase 1** — Tạo models + **module RBAC (services + cache)** + seed dữ liệu. *Không đụng code cũ.*
2. **Phase 2** — Chuyển `AuthService` sang `User`, thêm middleware `grantAccess`. KeyToken trỏ về User.
3. **Phase 3** — Refactor `Shop` thành profile, repoint `Order` → User, migrate dữ liệu Shop cũ → User.

---

# PHASE 1 — Models nền tảng + module RBAC

> Mục tiêu: có 3 collection mới, module RBAC quản lý role/resource có cache, + dữ liệu khởi tạo — mà **không** thay đổi hành vi hệ thống hiện tại.

## Step 1.1 — Resource model (registry)

`src/features/rbac/models/resource.model.ts`:

```ts
import { Schema, model } from 'mongoose'

const DOCUMENT_NAME = 'Resource'
const COLLECTION_NAME = 'Resources'

const resourceSchema = new Schema(
  {
    src_name: { type: String, required: true, unique: true }, // 'product' | 'order' | 'profile'
    src_slug: { type: String, default: '' },
    src_description: { type: String, default: '' },
  },
  { timestamps: true, collection: COLLECTION_NAME },
)

export const ResourceModel = model(DOCUMENT_NAME, resourceSchema)
```

## Step 1.2 — Role model (grant lưu tên resource — Cách B)

`src/features/rbac/models/role.model.ts`:

```ts
import { Schema, model } from 'mongoose'

const DOCUMENT_NAME = 'Role'
const COLLECTION_NAME = 'Roles'

export const ROLE_STATUS = Object.freeze({ ACTIVE: 'active', BLOCK: 'block', PENDING: 'pending' })

// Single source of truth cho tên role — tránh gõ tay string
export const ROLE_NAME = Object.freeze({
  USER: 'user',   // người mua (buyer) — mặc định khi đăng ký
  SHOP: 'shop',   // người bán (seller)
  ADMIN: 'admin', // quản trị
})

const roleSchema = new Schema(
  {
    rol_name: { type: String, enum: Object.values(ROLE_NAME), default: ROLE_NAME.USER },
    rol_slug: { type: String, required: true },
    rol_status: { type: String, enum: Object.values(ROLE_STATUS), default: ROLE_STATUS.ACTIVE },
    rol_description: { type: String, default: '' },

    // grant lưu TÊN resource (string), không phải ObjectId → khỏi populate khi build
    rol_grants: [
      {
        resource: { type: String, required: true }, // 'product' | 'order' | ...
        actions: { type: [String], required: true }, // ['create:any','read:own',...]
        attributes: { type: String, default: '*' },   // '*' | '*, !usr_password'
      },
    ],
  },
  { timestamps: true, collection: COLLECTION_NAME },
)

export const RoleModel = model(DOCUMENT_NAME, roleSchema)
```

## Step 1.3 — User model (model trọng tâm)

**WHY từng quyết định**:
- `usr_password` đặt `select: false` → query mặc định **không** trả password. Lúc login phải `.select('+usr_password')` có chủ đích → an toàn theo mặc định.
- `usr_roles` là **mảng** ref `Role` → 1 tài khoản vừa mua vừa bán.
- `usr_status` mặc định `pending` → ép verify trước khi `active`.

`src/features/user/models/index.ts`:

```ts
import { Schema, model } from 'mongoose'

const DOCUMENT_NAME = 'User'
const COLLECTION_NAME = 'Users'

export const USER_STATUS = Object.freeze({ ACTIVE: 'active', PENDING: 'pending', BLOCK: 'block' })

const userSchema = new Schema(
  {
    usr_slug: { type: String, default: '' },
    usr_name: { type: String, default: '', maxLength: 150, trim: true },
    usr_email: { type: String, required: true, unique: true, trim: true },
    usr_phone: { type: String, default: '' },

    usr_password: { type: String, required: true, select: false },
    usr_salt: { type: String, default: '', select: false },

    usr_avatar: { type: String, default: '' },
    usr_sex: { type: String, default: '' },
    usr_date_of_birth: { type: Date, default: null },

    usr_roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }], // nhiều role

    usr_status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.PENDING },
    usr_verified: { type: Schema.Types.Boolean, default: false },
  },
  { timestamps: true, collection: COLLECTION_NAME },
)

export const UserModel = model(DOCUMENT_NAME, userSchema)
```

## Step 1.4 — Đảm bảo model được "register"

**WHY**: Mongoose chỉ biết model khi file định nghĩa được `import` ít nhất một lần. Nếu một model chỉ được `ref` mà chưa từng import, `.populate()` ném `MissingSchemaError`. Các service ở Step 1.5/Phase 2 sẽ import nên thường đủ. Chắc chắn hơn: tạo `src/dbs/models.ts` import tất cả model rồi import file đó 1 lần trong `app.ts`.

## Step 1.5 — Module RBAC: services + cache

### 5a. Cài thư viện
```bash
npm i accesscontrol
```

### 5b. ResourceService (registry)
`src/features/rbac/services/resource.service.ts`:
```ts
import { ResourceModel } from '../models/resource.model'

export default class ResourceService {
  static createResource = (payload: { src_name: string; src_description?: string }) =>
    ResourceModel.create({ ...payload, src_slug: payload.src_name })

  // get list resource — reference data nhỏ: lean + select, không cần pagination
  static getResources = () => ResourceModel.find({}).select('src_name src_slug').lean()
}
```

### 5c. AccessControlService — trái tim (build + cache + invalidate)

**Bản mặc định — 1 process: L1 in-memory + single-flight.** Đây là bản nên dùng khi bạn chạy 1 instance (vd chỉ port 5000). Không đụng Redis.

`src/features/rbac/services/access-control.service.ts`:

```ts
import { AccessControl } from 'accesscontrol'
import { RoleModel } from '../models/role.model'

type Grant = { role: string; resource: string; action: string; attributes: string }

export default class AccessControlService {
  private static _ac: AccessControl | null = null            // L1 in-memory
  private static _building: Promise<AccessControl> | null = null // single-flight lock

  static getAccessControl = async (): Promise<AccessControl> => {
    if (AccessControlService._ac) return AccessControlService._ac          // cache hit
    if (AccessControlService._building) return AccessControlService._building // đợi ké lần build đang chạy

    AccessControlService._building = (async () => {
      try {
        const grantList = await AccessControlService.buildFromDB()
        AccessControlService._ac = new AccessControl(grantList)
        return AccessControlService._ac
      } finally {
        AccessControlService._building = null
      }
    })()
    return AccessControlService._building
  }

  // gọi sau mỗi lần ghi role: chỉ cần xoá L1 (process vừa-ghi-vừa-đọc)
  static invalidate = () => {
    AccessControlService._ac = null
  }

  private static buildFromDB = async (): Promise<Grant[]> => {
    const roles = await RoleModel.find({}).lean() // 1 query, không join (Cách B)
    const list: Grant[] = []
    for (const role of roles)
      for (const g of role.rol_grants || [])
        for (const action of g.actions)
          list.push({ role: role.rol_name, resource: g.resource, action, attributes: g.attributes || '*' })
    return list
  }
}
```

> **WHY single-flight**: khi `_ac == null` (vừa invalidate / cold start) mà nhiều user gọi cùng lúc, không có lock thì tất cả cùng `buildFromDB()` → "cache stampede". `_building` gom chúng vào **một** promise: chỉ 1 lần query Mongo, các request còn lại `await` ké. Đây là tối ưu đáng giá nhất cho kịch bản 1 instance traffic cao.

<details>
<summary><b>🔼 Bản nâng cấp — khi chạy ≥ 2 process (PM2 cluster / nhiều container / master-slave)</b></summary>

Mỗi process có `_ac` riêng → sửa role ở process A thì B vẫn giữ bản cũ tới khi restart/TTL. Thêm **L2 Redis** (chia sẻ) + **pub/sub** (báo mọi process drop L1). Chỉ đổi `AccessControlService`, phần khác giữ nguyên:

```ts
import { AccessControl } from 'accesscontrol'
import { pubClient, subClient } from '../../../utils/redis.util'
import { RoleModel } from '../models/role.model'

const CACHE_KEY = 'rbac:grants'
const CHANNEL = 'rbac:invalidate'
const TTL = 3600 // giây — lưới an toàn nếu lỡ miss event pub/sub

type Grant = { role: string; resource: string; action: string; attributes: string }

export default class AccessControlService {
  private static _ac: AccessControl | null = null
  private static _building: Promise<AccessControl> | null = null
  private static _subscribed = false

  // gọi 1 lần ở server.ts SAU initRedis() — mọi process lắng nghe lệnh invalidate
  static initInvalidationListener = async () => {
    if (AccessControlService._subscribed || !subClient.isOpen) return
    await subClient.subscribe(CHANNEL, () => { AccessControlService._ac = null }) // drop L1
    AccessControlService._subscribed = true
  }

  static getAccessControl = async (): Promise<AccessControl> => {
    if (AccessControlService._ac) return AccessControlService._ac
    if (AccessControlService._building) return AccessControlService._building

    AccessControlService._building = (async () => {
      try {
        if (pubClient.isOpen) {                          // L2 Redis
          const cached = await pubClient.get(CACHE_KEY)
          if (cached) return (AccessControlService._ac = new AccessControl(JSON.parse(cached) as Grant[]))
        }
        const grantList = await AccessControlService.buildFromDB() // L3 Mongo
        if (pubClient.isOpen) await pubClient.set(CACHE_KEY, JSON.stringify(grantList), { EX: TTL })
        return (AccessControlService._ac = new AccessControl(grantList))
      } finally {
        AccessControlService._building = null
      }
    })()
    return AccessControlService._building
  }

  static invalidate = async () => {            // xoá L1 + L2 + báo các process khác
    AccessControlService._ac = null
    if (pubClient.isOpen) {
      await pubClient.del(CACHE_KEY)
      await pubClient.publish(CHANNEL, '1')
    }
  }

  private static buildFromDB = async (): Promise<Grant[]> => {
    const roles = await RoleModel.find({}).lean()
    const list: Grant[] = []
    for (const role of roles)
      for (const g of role.rol_grants || [])
        for (const action of g.actions)
          list.push({ role: role.rol_name, resource: g.resource, action, attributes: g.attributes || '*' })
    return list
  }
}
```

Khi dùng bản này, nhớ gọi `AccessControlService.initInvalidationListener()` trong `server.ts` (sau `initRedis()`) — xem Step 2.4. Đầy đủ về pub/sub: [redis-pubsub-guide.md](redis-pubsub-guide.md).

</details>

### 5d. RoleService (ghi xong là invalidate)
`src/features/rbac/services/role.service.ts`:
```ts
import { RoleModel } from '../models/role.model'
import { ResourceModel } from '../models/resource.model'
import AccessControlService from './access-control.service'

export default class RoleService {
  static createRole = async (payload: any) => {
    await RoleService.assertResourcesExist(payload.rol_grants) // validate tên resource
    const role = await RoleModel.create(payload)
    await AccessControlService.invalidate()
    return role
  }

  static updateRole = async (id: string, payload: any) => {
    if (payload.rol_grants) await RoleService.assertResourcesExist(payload.rol_grants)
    const role = await RoleModel.findByIdAndUpdate(id, payload, { new: true })
    await AccessControlService.invalidate()
    return role
  }

  static getRoles = () => RoleModel.find({}).lean()

  // Cách B: registry dùng để validate tên resource trong grant hợp lệ
  private static assertResourcesExist = async (grants: { resource: string }[] = []) => {
    const names = [...new Set(grants.map((g) => g.resource))]
    const found = await ResourceModel.find({ src_name: { $in: names } }).select('src_name').lean()
    const ok = new Set(found.map((r) => r.src_name))
    const missing = names.filter((n) => !ok.has(n))
    if (missing.length) throw new Error(`Unknown resource(s): ${missing.join(', ')}`)
  }
}
```

> Bản mặc định: `invalidate()` là **đồng bộ** (`_ac = null`), nên `await AccessControlService.invalidate()` ở trên vẫn đúng (await trên non-promise là no-op). Khi bạn nâng cấp lên bản pub/sub thì `invalidate()` thành async — lúc đó `await` mới có tác dụng thật. Giữ `await` để không phải sửa khi nâng cấp.
>
> **WHY guard `pubClient.isOpen`** (chỉ ở bản nâng cấp): seed script (Step 1.6) gọi `createRole` → `invalidate`, nhưng chạy standalone bằng `ts-node` thì Redis chưa connect. Guard giúp cùng một code chạy được cả runtime (có Redis) lẫn script (không Redis).

## Step 1.6 — Seed qua service (DRY + idempotent)

**WHY**: seed **không** viết lại logic tạo role — nó **gọi service**. Một nơi duy nhất biết cách tạo role/resource.

`src/migrations/002_seed_roles_resources.ts`:
```ts
/** Usage: npx ts-node src/migrations/002_seed_roles_resources.ts */
import mongoose from 'mongoose'
import * as path from 'path'
import * as dotenv from 'dotenv'

const NODE_ENV = process.env.NODE_ENV || 'development'
dotenv.config()
dotenv.config({ path: path.resolve(process.cwd(), `.env.${NODE_ENV}`) })

import { ResourceModel } from '../features/rbac/models/resource.model'
import { RoleModel, ROLE_NAME } from '../features/rbac/models/role.model'

const RESOURCES = ['profile', 'product', 'order', 'discount', 'cart']

const ROLE_GRANTS: Record<string, any[]> = {
  [ROLE_NAME.USER]: [
    { resource: 'profile', actions: ['read:own', 'update:own'], attributes: '*, !usr_password' },
    { resource: 'product', actions: ['read:any'], attributes: '*' },
    { resource: 'cart',    actions: ['create:own', 'read:own', 'update:own', 'delete:own'], attributes: '*' },
    { resource: 'order',   actions: ['create:own', 'read:own'], attributes: '*' },
  ],
  [ROLE_NAME.SHOP]: [
    { resource: 'profile',  actions: ['read:own', 'update:own'], attributes: '*, !usr_password' },
    { resource: 'product',  actions: ['create:own', 'read:any', 'update:own', 'delete:own'], attributes: '*' },
    { resource: 'discount', actions: ['create:own', 'read:own', 'update:own', 'delete:own'], attributes: '*' },
    { resource: 'order',    actions: ['read:own', 'update:own'], attributes: '*' },
  ],
  [ROLE_NAME.ADMIN]: [
    { resource: 'profile',  actions: ['read:any', 'update:any', 'delete:any'], attributes: '*' },
    { resource: 'product',  actions: ['create:any', 'read:any', 'update:any', 'delete:any'], attributes: '*' },
    { resource: 'order',    actions: ['create:any', 'read:any', 'update:any', 'delete:any'], attributes: '*' },
    { resource: 'discount', actions: ['create:any', 'read:any', 'update:any', 'delete:any'], attributes: '*' },
  ],
}

const seed = async () => {
  const dbUrl = process.env.MONGODB_URI
  if (!dbUrl) { console.error('❌ MONGODB_URI not defined'); process.exit(1) }
  await mongoose.connect(dbUrl)
  console.log('✅ Connected to MongoDB')

  try {
    // 1) registry resources (idempotent qua upsert theo src_name)
    for (const name of RESOURCES) {
      await ResourceModel.findOneAndUpdate(
        { src_name: name }, { src_name: name, src_slug: name }, { upsert: true, new: true },
      )
      console.log(`   resource: ${name}`)
    }

    // 2) roles + grants (idempotent). Dùng upsert thẳng model để không phụ thuộc Redis trong seed.
    for (const roleName of Object.values(ROLE_NAME)) {
      await RoleModel.findOneAndUpdate(
        { rol_name: roleName },
        { rol_name: roleName, rol_slug: roleName, rol_grants: ROLE_GRANTS[roleName] },
        { upsert: true, new: true },
      )
      console.log(`   role: ${roleName} (${ROLE_GRANTS[roleName].length} grants)`)
    }

    console.log('🎉 Seed done!')
  } catch (err) {
    console.error('❌ Seed failed:', err); process.exit(1)
  } finally {
    await mongoose.connection.close()
  }
}

seed()
```

> Ghi chú: seed dùng `findOneAndUpdate upsert` trực tiếp model để **idempotent** và không cần Redis. Khi admin tạo role lúc runtime thì đi qua `RoleService.createRole` (có validate + invalidate cache). Hai con đường, cùng kết quả dữ liệu.
>
> ⚠️ Env: script đọc `process.env.MONGODB_URI`, app runtime đọc `config.dbUrl`. Đảm bảo cùng trỏ một DB.

## ✅ Verify Phase 1

```bash
npx ts-node src/migrations/002_seed_roles_resources.ts
```
Kỳ vọng: log 5 resource + 3 role. Mở Mongo kiểm tra `Roles` có doc `admin` với `rol_grants` (resource là **string** như `'product'`). Chạy lại lần 2 **không tạo trùng**.

---

# PHASE 2 — Chuyển Auth sang User + middleware phân quyền

> Mục tiêu: signup/login tạo `User`, token gắn role, middleware `grantAccess` chặn route theo quyền (đọc cache từ `AccessControlService`).

## Step 2.1 — UserService

`src/features/user/services/index.ts`:
```ts
import { UserModel } from '../models'

export default class UserService {
  static findByEmailWithPassword = async (email: string) =>
    UserModel.findOne({ usr_email: email })
      .select('+usr_password')
      .populate({ path: 'usr_roles', select: 'rol_name' })
      .lean()

  static findById = async (id: string) =>
    UserModel.findById(id).populate({ path: 'usr_roles', select: 'rol_name' }).lean()

  static createUser = async (payload: any) => UserModel.create(payload)
}
```

## Step 2.2 — AuthService dùng User + nhúng role vào token

**WHY nhúng role vào JWT**: middleware phân quyền cần biết role. Nhúng `roles` (slug) vào payload → check nhanh, không query user mỗi request. Đánh đổi: đổi role thì token cũ còn role cũ tới khi hết hạn (2 ngày).

Mở rộng `TokenPayload` trong `src/features/auth/utils/index.ts`:
```ts
export type TokenPayload = { userId: string; email: string; roles: string[] }
```

Sửa `src/features/auth/services/index.ts` (giữ cấu trúc class, đổi nguồn Shop → User):
```ts
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import KeyTokenService from '../../keyToken/services'
import { createTokenPair, TokenPayload } from '../utils'
import { getInfoData } from '../../../utils'
import { BadRequestError, UnauthorizedError } from '../../../core/error.response'
import { UserModel } from '../../user/models'
import { RoleModel, ROLE_NAME } from '../../rbac/models/role.model'

class AuthService {
  static signup = async ({ email, password, name }: { email: string; password: string; name: string }) => {
    const existing = await UserModel.findOne({ usr_email: email }).lean()
    if (existing) throw new BadRequestError('User already exists')

    const userRole = await RoleModel.findOne({ rol_name: ROLE_NAME.USER }).lean()
    if (!userRole) throw new BadRequestError('Default role not seeded. Run migration 002.')

    const hashPassword = await bcrypt.hash(password, 10)
    const newUser = await UserModel.create({
      usr_email: email, usr_password: hashPassword, usr_name: name, usr_roles: [userRole._id],
    })

    const secretKey = crypto.randomBytes(64).toString('hex')
    const payload: TokenPayload = { userId: String(newUser._id), email, roles: [userRole.rol_name] }
    const tokens = await createTokenPair(payload, secretKey)

    const keyToken = await KeyTokenService.createKeyToken({
      userId: String(newUser._id), secretKey, refreshToken: tokens.refreshToken,
    })
    if (!keyToken) throw new BadRequestError('Create key token failed')

    return { user: getInfoData({ fields: ['_id', 'usr_email', 'usr_name'], object: newUser }), tokens }
  }

  static login = async ({ email, password }: { email: string; password: string }) => {
    const user = await UserModel.findOne({ usr_email: email })
      .select('+usr_password')
      .populate({ path: 'usr_roles', select: 'rol_name' })
      .lean()
    if (!user) throw new BadRequestError('User not found')

    const isMatch = await bcrypt.compare(password, user.usr_password)
    if (!isMatch) throw new UnauthorizedError('Invalid password')

    const roles = (user.usr_roles as any[]).map((r) => r.rol_name)
    const secretKey = crypto.randomBytes(64).toString('hex')
    const payload: TokenPayload = { userId: String(user._id), email, roles }
    const tokens = await createTokenPair(payload, secretKey)

    await KeyTokenService.createKeyToken({
      userId: String(user._id), secretKey, refreshToken: tokens.refreshToken,
    })
    return { user: getInfoData({ fields: ['_id', 'usr_email', 'usr_name'], object: user }), tokens }
  }

  // logout / refreshToken: giữ nguyên; chỉ đảm bảo payload mới có `roles`
}

export default AuthService
```

## Step 2.3 — KeyToken trỏ về User

`src/features/keyToken/models/index.ts`:
```ts
user: { type: Schema.Types.ObjectId, required: true, ref: 'User' }, // đổi từ 'Shop'
```

## Step 2.4 — Middleware `grantAccess` (đọc cache) + đăng ký listener

`src/features/auth/utils/rbac.ts`:
```ts
import { Request, Response, NextFunction } from 'express'
import { ForbiddenError } from '../../../core/error.response'
import { asyncHandler } from '../../../utils'
import AccessControlService from '../../rbac/services/access-control.service'

type ActionScope = 'create' | 'read' | 'update' | 'delete'

export const grantAccess = (action: ActionScope, resource: string) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const roles = req.user?.roles || []
    if (roles.length === 0) throw new ForbiddenError('No role assigned')

    const ac = await AccessControlService.getAccessControl() // L1/L2/L3 tự lo

    const can = roles.some((role) => {
      const q = ac.can(role)
      const anyGranted = (q as any)[`${action}Any`]?.(resource)?.granted
      const ownGranted = (q as any)[`${action}Own`]?.(resource)?.granted
      return Boolean(anyGranted || ownGranted)
    })
    if (!can) throw new ForbiddenError(`You don't have permission to ${action} ${resource}`)
    next()
  })
```

**Chỉ khi dùng bản nâng cấp pub/sub** (≥2 process): đăng ký listener invalidate 1 lần ở `server.ts` — đúng chỗ `initRedis()` được gọi, **không** phải `app.ts`:
```ts
// server.ts
import AccessControlService from './src/features/rbac/services/access-control.service'

const startServer = async () => {
  await initRedis()                                     // connect Redis trước
  await AccessControlService.initInvalidationListener() // rồi mới subscribe
}
```
> Bản mặc định 1 process **không cần** bước này (không có Redis, không pub/sub).

> Nâng cao (làm sau khi chạy được bản cơ bản): để phân biệt `:own` vs `:any`, trong controller so `req.user.userId` với owner của tài nguyên; nếu chỉ có quyền `:own` mà không phải chủ sở hữu → chặn. Có thể dùng `permission.filter(data)` của accesscontrol để lọc field theo `attributes`.

## Step 2.5 — Áp middleware vào route (ví dụ product)

`src/features/product/routes/index.ts`:
```ts
import { authentication } from '../../auth/utils/checkAuth'
import { grantAccess } from '../../auth/utils/rbac'

router.use(authentication)                                   // AuthN
router.post('/', grantAccess('create', 'product'), controller.create) // AuthZ
```

## ✅ Verify Phase 2

1. `npm run dev` — server không lỗi, log "Redis connect successfully".
2. `POST /auth/signup` → tạo doc trong `Users`, `usr_roles` có 1 ObjectId, response không lộ `usr_password`.
3. `POST /auth/login` → trả tokens.
4. `POST /product` bằng token role `user` → **403**; bằng token role `shop` → **qua**.
5. Sửa grant của role trong DB qua `RoleService.updateRole` → quyền đổi **ngay** ở mọi instance (cache invalidate qua pub/sub).

---

# PHASE 3 — Shop thành profile + repoint refs + migrate data

> ⚠️ Phase này đụng dữ liệu cũ. **Backup DB trước khi chạy migration.**

## Step 3.1 — Refactor Shop model

`src/features/shop/models/index.ts` — bỏ `email/password/roles/verify/status`, thêm `shop_owner`:
```ts
const shopSchema = new Schema(
  {
    shop_owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, trim: true, maxLength: 150 },
    description: { type: String, default: '' },
    logo: { type: String, default: '' },
    shop_status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true, collection: COLLECTION_NAME },
)
```
> Cập nhật `ShopService.findByEmail`/`getShops` (đang select `email/password/roles`) — "tìm shop theo email" giờ thành "tìm user theo email → lấy shop theo `shop_owner`".

## Step 3.2 — Order trỏ về User

`src/features/order/model/index.ts`:
```ts
order_userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // bỏ comment "temporarily"
```
> `Product.product_shop` **vẫn ref `'Shop'`** — đúng, vì product thuộc gian hàng. Không đổi.

## Step 3.3 — Migration tách User ra khỏi Shop cũ

`src/migrations/003_split_shop_into_user.ts` (rút gọn — thêm connect + try/catch như mẫu 002):
```ts
import { ShopModel } from '../features/shop/models'
import { UserModel } from '../features/user/models'
import { RoleModel, ROLE_NAME } from '../features/rbac/models/role.model'
import { KeyTokenModel } from '../features/keyToken/models'
import { OrderModel } from '../features/order/model'

const run = async () => {
  const shopRole = await RoleModel.findOne({ rol_name: ROLE_NAME.SHOP }).lean()

  // đọc shop cũ KÈM field auth (qua collection thô, vì schema đã refactor)
  const oldShops = await ShopModel.collection.find({ email: { $exists: true } }).toArray()

  for (const shop of oldShops) {
    const user = await UserModel.findOneAndUpdate(
      { usr_email: shop.email },
      {
        usr_email: shop.email, usr_password: shop.password, // hash sẵn — copy nguyên
        usr_name: shop.name, usr_roles: [shopRole!._id],
        usr_status: 'active', usr_verified: shop.verify ?? false,
      },
      { upsert: true, new: true },
    )

    await ShopModel.collection.updateOne(
      { _id: shop._id },
      { $set: { shop_owner: user._id }, $unset: { email: '', password: '', roles: '', verify: '', status: '' } },
    )
    await KeyTokenModel.updateMany({ user: shop._id }, { $set: { user: user._id } })
    await OrderModel.updateMany({ order_userId: shop._id }, { $set: { order_userId: user._id } })

    console.log(`migrated ${shop.email} → user ${user._id}`)
  }
}
```
> **Phiên cũ**: token cũ mang `userId = shop._id`, payload chưa có `roles`. An toàn nhất cho dự án học: sau migrate `KeyTokenModel.deleteMany({})` để buộc login lại → token mới chuẩn.

## ✅ Verify Phase 3

1. Backup → chạy `003`. `Users` có user role shop; `Shops` đã `$unset` field auth + có `shop_owner`.
2. Login bằng email shop cũ (qua `/auth/login` → tra `User`) vẫn đúng password.
3. Tạo order → `order_userId` trỏ `User`.

---

## 4. Checklist tổng

- [ ] Phase 1: models `rbac/resource.model`, `rbac/role.model` (grant lưu string), `user`
- [ ] Phase 1: `npm i accesscontrol`
- [ ] Phase 1: `ResourceService`, `RoleService`, `AccessControlService` (cache 3 tầng + pub/sub)
- [ ] Phase 1: chạy `002_seed_roles_resources.ts`, DB có 3 role + 5 resource, chạy lại không trùng
- [ ] Phase 2: `AuthService` signup/login dùng `User` + token có `roles`
- [ ] Phase 2: `KeyToken.user` ref `User`
- [ ] Phase 2: `grantAccess` dùng `AccessControlService.getAccessControl()`
- [ ] (Chỉ nếu ≥2 process) đổi sang bản pub/sub + gọi `initInvalidationListener()` trong `server.ts` sau `initRedis()`
- [ ] Phase 2: test 403 (buyer) vs pass (seller); sửa grant → đổi quyền ngay (cache invalidate)
- [ ] Phase 3: backup DB → refactor `Shop` + `Order.order_userId` → User → chạy `003`
- [ ] Phase 3: login tài khoản cũ vẫn hoạt động

## 5. Bẫy thường gặp (kinh nghiệm)

1. **`MissingSchemaError`** → file model chưa được import lần nào. Import service tương ứng hoặc tạo `dbs/models.ts`.
2. **Login luôn sai password** → quên `.select('+usr_password')` nên field = undefined khi `bcrypt.compare`.
3. **`grantAccess` luôn 403** → token cũ chưa có `roles`, hoặc seed role chưa chạy. Login lại sau khi seed.
4. **Cache "stale"** → bản 1 process: sửa grant phải qua `RoleService` (gọi `invalidate` → `_ac=null`); bản ≥2 process: phải dùng nhánh pub/sub, nếu sửa thẳng DB bằng tay thì các process khác không biết → restart hoặc đợi TTL.
5. **Chạy 1 port nhưng vẫn stale** → có thể bạn đang chạy PM2 cluster / nhiều container (nhiều process) mà vẫn dùng bản L1-only. Đổi sang bản nâng cấp pub/sub.
6. **Seed báo lỗi Redis** (bản pub/sub) → đã guard `pubClient.isOpen`; nếu vẫn lỗi, kiểm tra seed có vô tình gọi nhánh runtime không. Seed nên upsert thẳng model như mẫu.
7. **Đổi tên resource (Cách B)** → phải update mọi grant chứa tên cũ. Nhưng resource map vào code nên gần như không xảy ra; nếu cần, viết script update `rol_grants.$[].resource`.
8. **Env mismatch** → script đọc `MONGODB_URI`, app đọc `config.dbUrl`. Cùng trỏ một DB.

## 6. Đọc thêm (tự nâng trình)

- `accesscontrol` docs — `Any/Own`, `.attributes`, `.filter()`.
- Mongoose: `select: false`, `lean()`, sub-documents, denormalize vs `populate`.
- Caching: cache-aside (lazy) pattern, cache invalidation, Redis pub/sub cho multi-instance.
- JWT: vì sao access token nên ngắn hạn, refresh token xoay vòng (dự án đã có `refreshTokensUsed`).
- OWASP: bcrypt cost factor, không bao giờ log password/secret.
```
