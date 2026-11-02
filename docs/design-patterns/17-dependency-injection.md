# 🔋 Dependency Injection (DI)

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Điều khiển TV không tự đẻ ra pin. Nó chừa sẵn hộc pin, bạn lắp pin Con Ó, pin sạc hay pin test đều chạy.
> - 🎯 **Dùng khi:** muốn test không cần DB thật, muốn đổi implementation mà không sửa business logic.
> - 📁 **Trong project:** `src/features/comments/` (lắp ráp ở `presentation/routes/index.ts`)

---

## 🎪 Câu chuyện vui

Hai cái điều khiển TV, hai số phận 📺:

### ❌ Điều khiển A – "Pin hàn chết"
```
Nhà sản xuất hàn cứng một viên pin vào mạch. Không nắp, không tháo được.
```
- Pin hết → **vứt luôn cả cái điều khiển** 💀
- Muốn xài pin sạc cho tiết kiệm → không được
- Xưởng muốn test nút bấm bằng pin giả → phải hàn pin thật vào mới test được

### ✅ Điều khiển B – "Có hộc pin"
```
Mặt sau có hộc pin ghi rõ: "2 viên AAA". Ai lắp gì cũng được, miễn đúng chuẩn.
```
- Hết pin → thay viên mới, 10 giây xong
- Pin Con Ó, pin sạc, pin test của xưởng → điều khiển **không hề biết**, vẫn bấm như thường 🧪

Hộc pin ghi "2 viên AAA" chính là **interface**. Người lắp pin chính là **người "tiêm" phụ thuộc**.

**DI = Đừng tự `new` thứ mình cần. Hãy chừa "hộc pin" (constructor) để người khác lắp vào.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Muốn unit test mà không cần DB thật | Script chạy 1 lần, không test |
| Có thể đổi implementation (Mongo → Postgres, thật → fake) | Utility thuần (`formatPrice`, `slugify`) |
| Use-case/business logic cần tách khỏi hạ tầng | Kéo cả DI container vào app 5 file |
| Clean Architecture / Hexagonal | |

---

## 💻 Code ví dụ

### ❌ Không có DI – "Pin hàn chết" bên trong class

```typescript
class CommentUseCase {
  async createComment(payload) {
    const repo = new MongoCommentRepository()  // 🔒 hàn chết vào Mongo
    return repo.create(payload)
  }
}

// Test thế nào? Phải bật MongoDB thật... cho một unit test 😩
```

### ✅ Với DI – Chừa "hộc pin" ở constructor

```typescript
// 1️⃣ Hộc pin ghi "2 viên AAA": "tôi cần ai đó biết làm mấy việc này"
interface ICommentRepository {
  create(comment: CommentEntity): Promise<CommentEntity>
  findById(id: string): Promise<CommentEntity | null>
}

// 2️⃣ Use-case chỉ biết HỢP ĐỒNG, không biết Mongo là gì
class CommentUseCase {
  constructor(private readonly commentRepository: ICommentRepository) {}

  createComment(payload) {
    return this.commentRepository.create({ ...payload, isDeleted: false })
  }
}

// 3️⃣ Ai đó "lắp pin" ở ngoài cùng
const useCase = new CommentUseCase(new MongoCommentRepository())
```

```
         Ai tạo?                       Ai dùng?
┌────────────────────────┐      ┌──────────────────────┐
│ routes/index.ts        │      │ CommentUseCase       │
│ (Composition Root) 🏗️  │─────▶│ chỉ biết             │
│ new MongoCommentRepo() │ tiêm │ ICommentRepository   │
└────────────────────────┘      └──────────────────────┘
```

---

## 🔗 Chỗ nào dùng trong project?

### 📁 `src/features/comments/` – DI chuẩn sách giáo khoa

Toàn bộ dây chuyền được "lắp ráp" ở **một chỗ duy nhất**, file `presentation/routes/index.ts`:

```typescript
// --- DEPENDENCY INJECTION ---
// 1. create DB implementation (Infra)
const commentRepository = new MongoCommentRepository()
// 2. inject Repo Interface into UseCase (Application)
const commentUseCase = new CommentUseCase(commentRepository)
// 3. inject UseCase into Controller (Presentation)
const commentController = new CommentController(commentUseCase)
```

Và use-case **chỉ** biết interface (`application/use-cases/comment.use-case.ts`):

```typescript
export class CommentUseCase {
  // Dependency Injection
  constructor(private readonly commentRepository: ICommentRepository) {}
}
```

Chỗ "lắp ráp" đó có tên gọi riêng: **Composition Root**. Đó là nơi duy nhất được phép biết *"dùng Mongo"*. Mọi chỗ khác chỉ biết *"dùng một cái gì đó có `create()`"*.

### 🧪 Phần thưởng: test không cần Mongo

> Backend hiện chưa cài test runner. Đoạn dưới viết theo cú pháp Jest/Vitest để minh hoạ.

```typescript
// Fake repository = "pin test của xưởng": 10 dòng, chạy trong RAM ⚡
class InMemoryCommentRepository implements ICommentRepository {
  private rows: CommentEntity[] = []
  async create(c: CommentEntity) { this.rows.push(c); return c }
  async findById(id: string) { return this.rows.find((r) => r.id === id) ?? null }
  // ...
}

it('new comment is never deleted', async () => {
  const useCase = new CommentUseCase(new InMemoryCommentRepository())
  const c = await useCase.createComment({
    content: 'hi', productId: 'p1', userId: 'u1', parentId: null, replyToUserId: null,
  })
  expect(c.isDeleted).toBe(false)  // ✅ chạy trong 2ms, không cần Docker
})
```

### 🔍 So sánh: các feature khác chưa dùng DI

```typescript
// src/features/checkout/service/index.ts
import { ProductRepository } from '../../product/repository'   // import thẳng
const product = await ProductRepository.getProductPublishedById(...)  // gọi static
```

Cách này **không sai**, vì nó đơn giản và đủ dùng. Nhưng muốn test `CheckoutService` thì phải mock cả module (`jest.mock` / `vi.mock`) hoặc bật DB thật. Module `comments` chính là "mẫu" để học khi cần làm feature dễ test hơn.

---

## ⚠️ Cạm bẫy

### 1. 🐙 Constructor 9 tham số

```typescript
// ❌ Class này đang làm quá nhiều việc
new OrderUseCase(orderRepo, productRepo, cartRepo, discountRepo,
                 inventoryRepo, mailer, logger, cache, paymentGateway)
```

DI không gây ra vấn đề này. Nó **phơi bày** vấn đề. Tách class đi!

### 2. 🎩 "Service Locator" đội lốt DI

```typescript
// ❌ Trông như DI, nhưng điều khiển vẫn tự đi lục kho lấy pin
class CommentUseCase {
  private repo = container.get('CommentRepository')
}
```

Nhìn constructor không biết class cần gì → vẫn khó test. **Nhận qua constructor** mới là DI thật.

### 3. 🏭 Kéo DI container vào quá sớm

`inversify`, `tsyringe`, `awilix`... rất mạnh, nhưng với vài chục class, **lắp tay** như `comments/routes` là đủ, dễ đọc và không có "phép thuật" nào.

---

## 📝 Ghi nhớ

> **"DI = Điều khiển có hộc pin. Nó không tự đẻ pin, ai lắp pin gì nó chạy pin đó."** 🔋
>
> Nhớ 3 điều:
> 1. **Phụ thuộc vào interface**, không phụ thuộc class cụ thể
> 2. **Nhận qua constructor**, không `new` bên trong
> 3. **Lắp ráp ở một chỗ** (Composition Root), như `comments/presentation/routes/index.ts`

---

## 🎯 Quick Quiz

**Q: Muốn đổi comment từ MongoDB sang PostgreSQL, cần sửa những file nào trong module `comments`?**

<details>
<summary>💡 Đáp án</summary>

Chỉ **2 việc**:
1. Viết file mới `PostgresCommentRepository implements ICommentRepository`
2. Sửa **1 dòng** ở Composition Root:
   ```typescript
   const commentRepository = new PostgresCommentRepository()
   ```

`CommentUseCase`, `CommentController` và `CommentEntity` **không cần đụng tới**. Business rule như *"xóa comment gốc thì xóa luôn replies"* vẫn nguyên vẹn 🎉.

Đó là lý do DI và [Repository](./08-repository.md) luôn đi cùng nhau, như cà phê với sữa đặc ☕.
</details>

---

[⬅️ Template Method](./16-template-method.md) | [Về mục lục](./README.md) | [Tiếp: 🚂 State →](./18-state.md)
