# 🛡️ Proxy Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Vệ sĩ đứng trước cửa phòng sếp: hỏi có hẹn chưa, ghi sổ, rồi mới cho vào, hoặc chặn luôn.
> - 🎯 **Dùng khi:** cần kiểm soát *trước khi* gọi object thật: cache, phân quyền, rate limit, lazy load.
> - 📁 **Trong project:** `src/middlewares/rate-limit.middleware.ts`, auth middleware

---

## 🎪 Câu chuyện vui

Bạn muốn gặp **CEO của Google** 🏢.

### ❌ Gặp trực tiếp (không có Proxy)
Bạn xông thẳng vào phòng CEO → An ninh bắt ngay 👮

### ✅ Qua vệ sĩ (Proxy) 🕶️
1. 📅 **Vệ sĩ check lịch**: sếp có rảnh không?
2. 🔑 **Check quyền**: bạn có hẹn không?
3. 📝 **Ghi sổ**: "Anh Sang đến gặp lúc 10h"
4. 💾 **Trả lời hộ**: "Câu này sếp trả lời hôm qua rồi, đây là đáp án" (cache)
5. ✅ **Cho vào**, hoặc 🚫 chặn ngay ở cửa

Vệ sĩ đứng **đúng chỗ cửa phòng sếp**: ai muốn gặp sếp cũng phải nói chuyện với vệ sĩ trước (cùng interface). Vệ sĩ có quyền **không cho vào**.

**Proxy = Vệ sĩ gác cửa. Cùng interface với object thật, kiểm soát trước khi (và có khi không) gọi vào.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Caching (đỡ gọi DB/API) | Logic đơn giản, không cần lớp trung gian |
| Access control (check quyền) | Khi overhead proxy > lợi ích |
| Logging / monitoring | Khi đã có middleware pattern |
| Lazy loading (tải khi cần) | Over-abstraction cho wrapper đơn giản |
| Rate limiting | Khi proxy không thêm giá trị gì |

---

## 💻 Code ví dụ

### 🏷️ Các loại Proxy

```
1. 💾 Cache Proxy     – Lưu kết quả, tránh gọi lại
2. 🔑 Protection Proxy – Check quyền trước khi cho truy cập
3. 📝 Logging Proxy    – Ghi log mọi hoạt động
4. ⏳ Virtual Proxy    – Lazy loading, tải khi cần
```

### 💾 Cache Proxy – Phổ biến nhất trong E-commerce

```typescript
// 🎯 Interface chung – Proxy và Real Object cùng implement
interface IProductService {
  getProductById(id: string): Promise<Product>
  getProductsByCategory(category: string): Promise<Product[]>
}

// 🏪 Real Service – Gọi database thật
class ProductService implements IProductService {
  async getProductById(id: string) {
    console.log(`🗄️ Querying database for product ${id}...`)
    return await ProductModel.findById(id).lean()
  }

  async getProductsByCategory(category: string) {
    console.log(`🗄️ Querying database for category ${category}...`)
    return await ProductModel.find({ category }).lean()
  }
}

// 🛡️ Cache Proxy – Kiểm tra cache trước, tránh gọi DB
class CachedProductService implements IProductService {
  constructor(
    private realService: ProductService,   // ← Object thật
    private redis: Redis
  ) {}

  async getProductById(id: string) {
    const cacheKey = `product:${id}`

    // 1️⃣ Check cache trước
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      console.log(`⚡ Cache HIT for product ${id}`)
      return JSON.parse(cached)
    }

    // 2️⃣ Cache miss → gọi service thật
    console.log(`❌ Cache MISS for product ${id}`)
    const product = await this.realService.getProductById(id)

    // 3️⃣ Lưu vào cache cho lần sau
    await this.redis.setex(cacheKey, 3600, JSON.stringify(product))

    return product
  }

  async getProductsByCategory(category: string) {
    const cacheKey = `products:category:${category}`
    const cached = await this.redis.get(cacheKey)

    if (cached) return JSON.parse(cached)

    const products = await this.realService.getProductsByCategory(category)
    await this.redis.setex(cacheKey, 1800, JSON.stringify(products))

    return products
  }
}
```

### 🧠 Sử dụng – Client không biết đang dùng Proxy!

```typescript
// Tạo proxy
const realService = new ProductService()
const productService = new CachedProductService(realService, redis)

// Client dùng bình thường – không biết có cache!
const product = await productService.getProductById('123')

// Lần 1: Cache MISS → query DB (200ms)
// Lần 2: Cache HIT  → từ Redis (2ms) ← 100x nhanh hơn! ⚡
// Lần 3: Cache HIT  → từ Redis (2ms)
```

### 🧠 Luồng hoạt động

```
Client                CachedProductService          ProductService       Database
  │                         │                            │                  │
  │  getProductById('123')  │                            │                  │
  │ ──────────────────────► │                            │                  │
  │                         │                            │                  │
  │                   ┌─────┴─────┐                      │                  │
  │                   │ Redis has  │                      │                  │
  │                   │ cache?     │                      │                  │
  │                   └─────┬─────┘                      │                  │
  │                         │                            │                  │
  │                    YES ─┼── NO                       │                  │
  │                   ┌─────┘    └──────┐                │                  │
  │                   │                 │ getProductById  │                  │
  │                   │                 │ ──────────────► │                  │
  │                   │                 │                 │  findById('123') │
  │                   │                 │                 │ ────────────────►│
  │                   │                 │                 │    Product       │
  │                   │                 │                 │ ◄────────────────│
  │                   │                 │    Product      │                  │
  │                   │                 │ ◄────────────── │                  │
  │                   │                 │                 │                  │
  │                   │      Save to Redis               │                  │
  │                   │                 │                 │                  │
  │       Product     │ ◄──────────────┘                 │                  │
  │ ◄──────────────── │                                  │                  │
```

---

## 📝 Logging Proxy

```typescript
class LoggedProductService implements IProductService {
  constructor(private realService: ProductService) {}

  async getProductById(id: string) {
    const start = Date.now()
    console.log(`📝 [${new Date().toISOString()}] getProductById(${id}) - START`)

    try {
      const result = await this.realService.getProductById(id)
      const duration = Date.now() - start
      console.log(`✅ getProductById(${id}) - ${duration}ms`)
      return result
    } catch (error) {
      const duration = Date.now() - start
      console.error(`❌ getProductById(${id}) - FAILED after ${duration}ms`, error)
      throw error
    }
  }

  async getProductsByCategory(category: string) {
    // Tương tự...
  }
}
```

## 🔑 Protection Proxy

```typescript
class ProtectedProductService implements IProductService {
  constructor(
    private realService: ProductService,
    private currentUser: User
  ) {}

  async getProductById(id: string) {
    // Ai cũng xem được product
    return this.realService.getProductById(id)
  }

  async deleteProduct(id: string) {
    // Chỉ admin mới xoá được!
    if (!this.currentUser.roles.includes('admin')) {
      throw new ForbiddenError('Only admin can delete products!')
    }
    return this.realService.deleteProduct(id)
  }
}
```

## 🎭 Kết hợp nhiều Proxy (Decorator style)

```typescript
// Stack proxy lên nhau như Russian doll! 🪆

const realService = new ProductService()
const cachedService = new CachedProductService(realService, redis)     // Layer 1: Cache
const loggedService = new LoggedProductService(cachedService)          // Layer 2: Log
const protectedService = new ProtectedProductService(loggedService, user) // Layer 3: Auth

// Request đi qua: Auth → Log → Cache → (DB nếu cache miss)
const product = await protectedService.getProductById('123')
```

---

## 🔗 Ứng dụng trong project E-commerce

### Rate Limiting = Proxy

```typescript
// src/middlewares/rate-limit.middleware.ts
// Rate limiter hoạt động như Proxy cho route handlers:
// Check số request → cho phép hoặc chặn → gọi handler thật

// Request → [Rate Limit Proxy] → [Auth Proxy] → [Handler]
//                │
//          Quá 100 req/min?
//          ├── YES → 429 Too Many Requests
//          └── NO  → next()
```

### Authentication Middleware = Protection Proxy

```typescript
// Middleware auth check token → cho phép hoặc chặn
// Đây chính là Protection Proxy pattern!
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization
  if (!token) return res.status(401).json(...)  // ← Proxy chặn!
  req.user = verifyToken(token)
  next()  // ← Proxy cho qua!
}
```

---

## ⚠️ Cạm bẫy

### 1. 💾 Cache Proxy – Stale data
```typescript
// ❌ Cache không invalidate → user thấy data cũ!
class CachedProductService {
  async getProductById(id: string) {
    const cached = await redis.get(`product:${id}`)
    if (cached) return JSON.parse(cached)  // Data từ 2 ngày trước? 😱
    // ...
  }
}

// ✅ Invalidate cache khi data thay đổi!
async updateProduct(id: string, data: any) {
  await this.realService.updateProduct(id, data)
  await this.redis.del(`product:${id}`)  // ← Xoá cache cũ!
  await this.redis.del(`products:category:${data.category}`)
}
```

### 2. 🐌 Proxy overhead
```typescript
// ❌ Quá nhiều proxy layer → chậm hơn không có proxy!
const service = new LogProxy(
  new MetricsProxy(
    new CacheProxy(
      new AuthProxy(
        new ValidationProxy(
          new RealService()  // 5 lớp proxy! 😵
        )
      )
    )
  )
)

// ✅ Chỉ thêm proxy khi CẦN THIẾT
const service = new CacheProxy(new RealService())  // 1 lớp đủ rồi!
```

### 3. 🤔 Nhầm Proxy vs Decorator
```
Proxy:     KIỂM SOÁT truy cập (cache, auth, rate-limit)
           → Proxy tự quyết có gọi real object hay không

Decorator: THÊM CHỨC NĂNG (thêm log, thêm metrics)
           → Decorator luôn gọi real object + thêm gì đó

Thực tế: Code giống nhau, khác ở MỤC ĐÍCH.
```

---

## 📝 Ghi nhớ

> **"Proxy = Vệ sĩ gác cửa. Ai gặp sếp cũng phải qua vệ sĩ, và vệ sĩ có quyền nói không."** 🛡️
>
> Nhớ 4 loại:
> 1. 💾 **Cache Proxy** – "Đã hỏi câu này rồi, đây là đáp án cũ"
> 2. 🔑 **Protection Proxy** – "Anh có quyền vào không?"
> 3. 📝 **Logging Proxy** – "Ghi sổ: ai, lúc nào, làm gì"
> 4. ⏳ **Virtual Proxy** – "Chưa cần thì chưa tải"

---

## 🎯 Quick Quiz

**Q: Đoạn code nào KHÔNG phải Proxy pattern?**

```typescript
// A: Cache
async getUser(id) {
  const cached = await redis.get(id)
  if (cached) return cached
  const user = await db.findUser(id)
  await redis.set(id, user)
  return user
}

// B: Lazy loading
class HeavyImage {
  private realImage?: RealImage
  display() {
    if (!this.realImage) this.realImage = new RealImage(this.path)
    this.realImage.display()
  }
}

// C: Error retry
async fetchData(url) {
  for (let i = 0; i < 3; i++) {
    try { return await fetch(url) }
    catch (e) { if (i === 2) throw e }
  }
}
```

<details>
<summary>💡 Đáp án</summary>

**Tất cả đều là Proxy!** 🎉

- **A** – Cache Proxy (kiểm tra cache trước khi gọi DB)
- **B** – Virtual Proxy (lazy loading – tải khi cần)
- **C** – Protection/Retry Proxy (thử lại khi lỗi)

Proxy pattern rất phổ biến và bạn đang dùng nó hàng ngày!
</details>

---

[⬅️ Adapter](./09-adapter.md) | [Về mục lục](./README.md) | [Tiếp: 🛋️ Abstract Factory →](./11-abstract-factory.md)
