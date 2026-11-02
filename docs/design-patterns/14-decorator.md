# 🧋 Decorator Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Trà sữa + trân châu + pudding. Ly vẫn là ly, mỗi lớp topping thêm một chút.
> - 🎯 **Dùng khi:** thêm hành vi (bắt lỗi, log, retry, đo giờ) quanh function có sẵn mà không sửa nó.
> - 📁 **Trong project:** `asyncHandler` trong `src/utils/common.ts`, `grantAccess` trong `src/features/auth/utils/rbac.ts`

---

## 🎪 Câu chuyện vui

Bạn order ở quán trà sữa 🧋:

```
🧋 Trà sữa              25k
  + 🟤 Trân châu        +5k
    + 🍮 Pudding        +7k
      + 🧀 Kem cheese   +10k
                       ─────
                        47k
```

Quán **không** tạo ra món "TràSữaTrânChâuPuddingKemCheese". Nếu làm vậy thì menu có 2⁸ = 256 món chỉ với 8 loại topping 😵.

Thay vào đó, mỗi topping **bọc** lên ly trước đó. Mỗi lớp:
- **Vẫn là trà sữa** (cùng interface: `getPrice()`)
- **Thêm một chút gì đó** (cộng giá, thêm vị)
- **Gọi vào lớp bên trong** để lấy phần còn lại

**Decorator = Bọc object/function bằng một lớp mới cùng interface, thêm hành vi mà không sửa code gốc.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Thêm logging, retry, cache, timing cho function có sẵn | Khi chỉ có 1 chỗ cần, viết thẳng vào cho nhanh |
| Bắt lỗi async chung cho mọi controller | Khi thứ tự lớp bọc quan trọng mà team hay quên |
| Kết hợp hành vi tuỳ ý (A+B, A+C, B+C...) | Khi phải sửa hành vi *bên trong* (lúc đó sửa class gốc) |
| Không được/không nên sửa code gốc (thư viện) | Bọc 7 lớp → debug stack trace muốn khóc |

---

## 💻 Code ví dụ

### ❌ Không có Decorator – Copy-paste try/catch khắp nơi (thời Express 4)

```typescript
// 😱 Controller nào cũng phải tự try/catch
const getProduct = async (req, res, next) => {
  try {
    const product = await ProductService.findById(req.params.id)
    res.json(product)
  } catch (err) {
    next(err) // Express 4: quên dòng này = request treo mãi mãi 💀
  }
}

const createProduct = async (req, res, next) => {
  try {
    // ...
  } catch (err) {
    next(err) // copy-paste lần thứ 47...
  }
}
```

### ✅ Với Decorator – Bọc 1 lần, xài mọi nơi

```typescript
// 🧋 Decorator: nhận 1 function, trả về 1 function MỚI cùng "chữ ký"
const asyncHandler = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next) // ← topping "bắt lỗi"
  }
}

// Controller sạch bong, chỉ còn business logic
const getProduct = async (req, res) => {
  const product = await ProductService.findById(req.params.id)
  res.json(product)
}

router.get('/:id', asyncHandler(getProduct)) // 🧋 + 🟤
```

### 🧠 Xếp chồng nhiều topping

```typescript
// Mỗi decorator nhận function, trả function cùng kiểu → xếp chồng được!
const withTiming = (fn) => async (...args) => {
  const start = Date.now()
  try {
    return await fn(...args)
  } finally {
    logger.info(`${fn.name} took ${Date.now() - start}ms`)
  }
}

const withRetry = (fn, times = 3) => async (...args) => {
  for (let i = 1; ; i++) {
    try {
      return await fn(...args)
    } catch (err) {
      if (i >= times) throw err
    }
  }
}

// 🧋 + 🟤 + 🍮 — bọc từ trong ra ngoài
const fetchExchangeRate = withTiming(withRetry(callBankApi, 3))
```

```
fetchExchangeRate()
   │
   ▼
┌─ withTiming ──────────────────────┐   bấm giờ
│  ┌─ withRetry ─────────────────┐  │   thử lại 3 lần
│  │  ┌─ callBankApi ─────────┐  │  │   việc thật
│  │  │  🏦 gọi API ngân hàng │  │  │
│  │  └───────────────────────┘  │  │
│  └─────────────────────────────┘  │
└───────────────────────────────────┘
```

### 🎀 Bonus: cú pháp `@decorator` của TypeScript

```typescript
// Nếu từng dùng NestJS, bạn đã gặp: @Get(), @UseGuards(), @Injectable()
// Bản chất vẫn vậy — bọc method gốc bằng một lớp mới.
function LogCall(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value
  descriptor.value = async function (...args: any[]) {
    logger.info(`→ ${key}`, { args })
    return original.apply(this, args)
  }
}

class OrderService {
  @LogCall
  async placeOrder(userId: string) { /* ... */ }
}
```

> Project này **không** dùng cú pháp `@`. Decorator ở đây là kiểu **higher-order function**, phổ biến nhất trong Express.

---

## 🔗 Chỗ nào dùng trong project?

### 📁 `src/utils/common.ts` – `asyncHandler`

```typescript
export const asyncHandler = (
  func: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    func(req, res, next).catch(next)
  }
}
```

Đúng 5 dòng. Mọi route đều bọc qua nó, ví dụ `src/features/checkout/routes/index.ts`:

```typescript
router.post('/review', asyncHandler(CheckoutController.checkoutReview))
```

> 📌 **Sự thật thú vị:** project đang dùng **Express 5**, bản này đã tự `.catch(next)` cho async handler. Nên `asyncHandler` giờ là "topping bảo hiểm". Nó vô hại, giữ thói quen tốt từ thời Express 4, nhưng không còn bắt buộc. Thời Express 4 thì thiếu nó là request treo 💀.

### 📁 `src/features/auth/utils/rbac.ts` – Decorator *có tham số*

```typescript
export const grantAccess = (action: ActionScope, resource: string) => {
  return asyncHandler(              // ← bọc thêm lớp "bắt lỗi"
    async (req, res, next) => {
      const ac = await AccessControlService.getAccessControl()
      // ... check quyền, không đủ → throw ForbiddenError
      next()
    },
  )
}

// Dùng: grantAccess('create', 'product')
```

`grantAccess(...)` là một **"nhà máy decorator"**: truyền tham số vào → nhận về middleware đã được bọc sẵn `asyncHandler`. Hai lớp topping trong một dòng 🧋🟤🍮.

---

## ⚠️ Cạm bẫy

### 1. 🔀 Thứ tự bọc thay đổi kết quả

```typescript
withTiming(withRetry(fn))  // đo TỔNG thời gian cả 3 lần thử
withRetry(withTiming(fn))  // đo TỪNG lần thử, log 3 dòng
```

Giống mặc áo: áo thun trong, áo khoác ngoài. Đảo ngược thì... vẫn mặc được, nhưng trông kỳ 🧥.

### 2. 🕳️ Quên `return` / quên `await`

```typescript
// ❌ Decorator nuốt mất kết quả
const withLog = (fn) => async (...args) => {
  logger.info('calling')
  fn(...args)             // không return, không await
}
// → caller luôn nhận undefined, lỗi async thành unhandled rejection 💥

// ✅
const withLog = (fn) => async (...args) => {
  logger.info('calling')
  return await fn(...args)
}
```

### 3. 🤔 Nhầm với Proxy

```
Decorator: THÊM hành vi, luôn gọi vào bên trong       → 🧋 thêm topping
Proxy:     KIỂM SOÁT truy cập, có thể KHÔNG gọi vào   → 🛡️ vệ sĩ chặn cửa
```

Code nhìn giống hệt nhau, khác ở **ý định**. Xem thêm [10-proxy.md](./10-proxy.md).

---

## 📝 Ghi nhớ

> **"Decorator = Topping trà sữa. Ly vẫn là ly, chỉ là ngon hơn mỗi lớp."** 🧋
>
> Nhớ 3 điều:
> 1. **Nhận vào** thứ X → **trả về** thứ X mới (cùng interface)
> 2. Lớp mới **luôn gọi** lớp bên trong (khác Proxy)
> 3. Xếp chồng được, nhưng **thứ tự quan trọng**

---

## 🎯 Quick Quiz

**Q: Hàm nào là Decorator đúng nghĩa?**

```typescript
// A
const withCache = (fn) => async (id) => {
  const hit = await redis.get(id)
  if (hit) return JSON.parse(hit)
  const data = await fn(id)
  await redis.set(id, JSON.stringify(data))
  return data
}

// B
const withAudit = (fn) => async (...args) => {
  const result = await fn(...args)
  await AuditLog.create({ action: fn.name, args })
  return result
}
```

<details>
<summary>💡 Đáp án</summary>

**B là Decorator chuẩn.** Nó *luôn* gọi `fn`, rồi thêm một hành vi (ghi audit log). Đúng kiểu thêm topping 🧋.

**A là Cache Proxy.** Có cache thì nó *không* gọi `fn` luôn, tức là kiểm soát việc có được vào hay không 🛡️.

Code y hệt nhau về hình dạng: nhận function, trả function. Thứ phân biệt là **ý định**: thêm hành vi (Decorator) hay chặn/kiểm soát (Proxy). Phỏng vấn mà trả lời được câu này là ăn điểm ✨.
</details>

---

[⬅️ Composite](./13-composite.md) | [Về mục lục](./README.md) | [Tiếp: 🏨 Facade →](./15-facade.md)
