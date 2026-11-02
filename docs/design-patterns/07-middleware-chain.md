# ✈️ Middleware / Chain of Responsibility Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Cửa an ninh sân bay: soát vé → soát hành lý → quét người. Mỗi trạm check một thứ, ổn thì `next()`, không ổn thì giữ lại.
> - 🎯 **Dùng khi:** mọi request phải đi qua cùng một dây chuyền (log, auth, validate, rate limit).
> - 📁 **Trong project:** `src/app.ts`, `src/middlewares/`

---

## 🎪 Câu chuyện vui

Bạn qua **cửa an ninh sân bay** ✈️.

Mỗi trạm kiểm tra **1 thứ** rồi cho đi tiếp:

```
Bạn → 🛂 Check vé    → 🔍 Soi hành lý  → 🚶 Quét người  → 🛃 Check passport  → ✅ Lên máy bay!
         │                 │                  │                  │
         │ Vé hợp lệ?      │ Có bom?          │ Có kim loại?     │ Visa OK?
         │ ✅ → next()     │ ✅ → next()      │ ✅ → next()      │ ✅ → next()
         │ ❌ → STOP!      │ ❌ → STOP!       │ ❌ → STOP!       │ ❌ → STOP!
```

- Mỗi trạm **độc lập** – chỉ biết việc của mình
- Mỗi trạm có quyền **dừng** (không gọi `next()`) hoặc **cho qua** (gọi `next()`)
- **Thêm trạm mới?** Chen vào dây chuyền, không ảnh hưởng trạm khác

**Middleware = Dây chuyền kiểm tra. Mỗi mắt xích xử lý 1 phần, gọi `next()` để tiếp.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Request processing pipeline | Logic tuần tự cố định |
| Input validation chain | Khi chỉ có 1 bước xử lý |
| Auth → Rate limit → Parse → Route | Khi thứ tự không quan trọng |
| Logging, error handling | Khi cần trả kết quả từ bước trung gian |

---

## 💻 Code ví dụ

### Express Middleware – Bạn dùng mỗi ngày!

```typescript
// Mỗi middleware có dạng: (req, res, next) => { ... }
//                                         ↑
//                                    Gọi next() = cho qua

// 🔗 Mắt xích 1: Log request
const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log(`📝 ${req.method} ${req.url}`)
  next()  // ← Cho qua! Tiếp tục mắt xích tiếp theo
}

// 🔗 Mắt xích 2: Parse JSON body
const jsonParser = express.json()
// Tự động gọi next() sau khi parse

// 🔗 Mắt xích 3: Check authentication
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization
  if (!token) {
    return res.status(401).json({ message: 'No token!' })  // ❌ STOP!
    // Không gọi next() → dây chuyền dừng ở đây!
  }
  req.user = verifyToken(token)
  next()  // ✅ Token hợp lệ → cho qua!
}

// 🔗 Mắt xích 4: Check permission
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user.roles.includes('admin')) {
    return res.status(403).json({ message: 'Admin only!' })  // ❌ STOP!
  }
  next()  // ✅ Là admin → cho qua!
}
```

### 🧠 Lắp ráp dây chuyền

```typescript
const app = express()

// Dây chuyền TOÀN CỤC (mọi request đều đi qua)
app.use(compression())        // Nén response
app.use(helmet())             // Security headers
app.use(loggingMiddleware)    // Log request
app.use(express.json())       // Parse body

// Dây chuyền cho ROUTE CỤ THỂ
app.get('/api/v1/users',
  authMiddleware,              // Check đăng nhập
  requireAdmin,                // Check quyền admin
  UserController.getAll        // Handler cuối cùng
)

// Thêm rate-limit? Chen vào thôi!
app.get('/api/v1/users',
  rateLimitMiddleware,         // ← Thêm vào đây!
  authMiddleware,
  requireAdmin,
  UserController.getAll
)
```

### 🧠 Luồng hoạt động

```
Request: GET /api/v1/users
         │
         ▼
┌─ compression() ─┐
│  Nén response    │
│  next() ✅       │
└────────┬─────────┘
         ▼
┌─ helmet() ───────┐
│  Security headers │
│  next() ✅        │
└────────┬──────────┘
         ▼
┌─ loggingMiddleware ┐
│  📝 "GET /users"   │
│  next() ✅          │
└────────┬────────────┘
         ▼
┌─ authMiddleware ────┐
│  Token OK?           │
│  ✅ → next()         │──── ❌ No token → 401 STOP!
└────────┬─────────────┘
         ▼
┌─ requireAdmin ──────┐
│  Is admin?           │
│  ✅ → next()         │──── ❌ Not admin → 403 STOP!
└────────┬─────────────┘
         ▼
┌─ UserController ────┐
│  getAll()            │
│  res.json(users)     │
└──────────────────────┘
         │
         ▼
     200 OK 🎉
```

---

## 🔗 Chỗ nào dùng trong project?

### 📁 `src/app.ts` – Dây chuyền chính

```typescript
const app = express()

// Middleware chain:
app.use(compression())          // 🗜️ Nén
app.use(helmet())               // 🛡️ Security
app.use(loggingMiddleware)      // 📝 Log
app.use(express.json())         // 📦 Parse JSON
app.use(express.urlencoded(...))// 📦 Parse URL-encoded

// Routes
app.use('/api/v1', router)

// Error handlers (cuối chain)
app.use((req, res, next) => { /* 404 */ })
app.use((err, req, res, next) => { /* Error handler */ })
```

### 📁 `src/middlewares/` – Các mắt xích custom

```
src/middlewares/
├── logging.middleware.ts      ← 📝 Log mọi request
├── validation.middleware.ts   ← ✅ Validate input
├── multer.middleware.ts       ← 📎 Upload file
└── rate-limit.middleware.ts   ← 🚦 Giới hạn request/IP
```

### 📁 Error Handling – Middleware cuối chain

```typescript
// Error middleware đặc biệt: 4 params (err, req, res, next)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500

  if (statusCode >= 500) {
    logger.error('Unhandled request error', { ... })
  }

  return res.status(statusCode).json({
    code: statusCode,
    message: statusCode >= 500 ? 'Internal Server Error' : err.message,
  })
})
```

---

## 💡 Tự implement Chain of Responsibility

```typescript
// Không dùng Express? Tự làm!
abstract class Handler {
  private nextHandler?: Handler

  // Gắn mắt xích tiếp theo
  setNext(handler: Handler): Handler {
    this.nextHandler = handler
    return handler  // Cho phép chaining: a.setNext(b).setNext(c)
  }

  // Xử lý hoặc chuyển tiếp
  handle(request: any): any {
    if (this.nextHandler) {
      return this.nextHandler.handle(request)
    }
    return null
  }
}

// Mắt xích: Check tuổi
class AgeCheckHandler extends Handler {
  handle(request: { age: number }) {
    if (request.age < 18) {
      return { error: 'Must be 18+' }
    }
    console.log('✅ Age check passed')
    return super.handle(request)  // next()
  }
}

// Mắt xích: Check email
class EmailCheckHandler extends Handler {
  handle(request: { email: string }) {
    if (!request.email.includes('@')) {
      return { error: 'Invalid email' }
    }
    console.log('✅ Email check passed')
    return super.handle(request)
  }
}

// Lắp ráp chain
const ageCheck = new AgeCheckHandler()
const emailCheck = new EmailCheckHandler()

ageCheck.setNext(emailCheck)

// Sử dụng
ageCheck.handle({ age: 20, email: 'test@mail.com' })
// ✅ Age check passed
// ✅ Email check passed
```

---

## ⚠️ Cạm bẫy

### 1. 🔄 Quên gọi next()
```typescript
// ❌ Request bị "treo" – không response, không next!
app.use((req, res, next) => {
  console.log('Processing...')
  // Quên next() → request treo mãi! Client timeout! ⏰
})

// ✅ LUÔN gọi next() hoặc gửi response
app.use((req, res, next) => {
  console.log('Processing...')
  next()  // ← Đừng quên!
})
```

### 2. 📊 Thứ tự middleware quan trọng!
```typescript
// ❌ Parse body SAU auth → req.body = undefined!
app.use(authMiddleware)     // Cần đọc body nhưng chưa parse!
app.use(express.json())     // Parse body → nhưng đã qua auth rồi!

// ✅ Parse body TRƯỚC auth
app.use(express.json())     // Parse body trước
app.use(authMiddleware)     // Giờ req.body có dữ liệu ✅
```

### 3. 🐛 Gọi next() sau khi đã response
```typescript
// ❌ Response rồi vẫn gọi next → "headers already sent" error!
app.use((req, res, next) => {
  res.json({ ok: true })  // Đã gửi response
  next()                   // 💥 Error! Cannot set headers after sent!
})

// ✅ return sau khi response
app.use((req, res, next) => {
  if (condition) {
    return res.json({ ok: true })  // return → dừng function
  }
  next()  // Chỉ gọi khi KHÔNG response
})
```

---

## 📝 Ghi nhớ

> **"Middleware = An ninh sân bay. Qua từng trạm, mỗi trạm check 1 thứ, gọi `next()` để đi tiếp."** ✈️
>
> Nhớ 3 thứ:
> 1. **`next()`** – "cho qua" trạm hiện tại
> 2. **Không gọi `next()`** – "chặn lại" (phải gửi response!)
> 3. **Thứ tự matters** – parse body trước auth, auth trước handler

---

[⬅️ Observer/Pub-Sub](./06-observer-pubsub.md) | [Về mục lục](./README.md) | [Tiếp: 📚 Repository →](./08-repository.md)
