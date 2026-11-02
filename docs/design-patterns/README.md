# 🎨 Design Patterns – Học Vui, Nhớ Lâu!

> **"Biết pattern không phải để flex, mà để viết code mà 6 tháng sau đọc lại không muốn khóc."**

🐱 **Thích đọc theo mạch truyện?** Bắt đầu với [Hành trình shop của Mèo](./00-hanh-trinh.md): 10 chương, mỗi chương một rắc rối có thật trong project này, và pattern đã giải quyết nó.

🩺 **Mới bắt đầu, hoặc đang có "bệnh" trong code?** Mở [🧭 Cheat Sheet](./99-cheat-sheet.md) trước: tra triệu chứng → ra pattern, kèm bài thơ lục bát ôn 18 pattern.

🖼️ **Mỗi pattern = một hình ảnh duy nhất.** Emoji ở tên bài, câu chuyện và câu ghi nhớ đều là cùng một hình. Nhớ được hình là nhớ được pattern.

## 📚 Mục lục

### 🏗️ Creational – Tạo đối tượng
| # | Pattern | Hình dung | Trong project |
|---|---------|-----------|:---:|
| 1 | [☕ Singleton](./01-singleton.md) | Một máy espresso, cả quán xài chung | ✅ |
| 2 | [🥤 Simple Factory](./02-simple-factory.md) | Máy bán nước: bấm số nào, rơi ra lon đó | ✅ |
| 3 | [🍕 Factory Method](./03-factory-method.md) | Chuỗi pizza: chi nhánh tự nướng bánh của mình | 📚 |
| 4 | [🥪 Builder](./04-builder.md) | Subway: chọn từng bước rồi `.build()` | 📚 |
| 11 | [🛋️ Abstract Factory](./11-abstract-factory.md) | IKEA: mua cả bộ cùng style | 📚 |
| 12 | [🖨️ Prototype](./12-prototype.md) | Photocopy đề mẫu rồi sửa vài câu | 🟡 |

### 🧩 Structural – Cấu trúc
| # | Pattern | Hình dung | Trong project |
|---|---------|-----------|:---:|
| 8 | [📚 Repository](./08-repository.md) | Thủ thư: hỏi sách là có, khỏi lục kho | ✅ |
| 9 | [🔌 Adapter](./09-adapter.md) | Cục chuyển đổi ổ cắm | 💡 |
| 10 | [🛡️ Proxy](./10-proxy.md) | Vệ sĩ gác cửa: có quyền mới cho vào | ✅ |
| 13 | [📦 Composite](./13-composite.md) | Thùng trong thùng: hỏi giá thùng to, tự cộng hết | 💡 |
| 14 | [🧋 Decorator](./14-decorator.md) | Topping trà sữa: bọc thêm, không sửa gốc | ✅ |
| 15 | [🏨 Facade](./15-facade.md) | Lễ tân khách sạn: một cuộc gọi, mười việc | ✅ |
| 17 | [🔋 Dependency Injection](./17-dependency-injection.md) | Hộc pin điều khiển: ai lắp pin gì cũng chạy | ✅ |

### 🎭 Behavioral – Hành vi
| # | Pattern | Hình dung | Trong project |
|---|---------|-----------|:---:|
| 5 | [🛵 Strategy](./05-strategy.md) | Đi làm: mưa ô tô, tắc xe ôm, đích không đổi | 💡 |
| 6 | [🔔 Observer / Pub-Sub](./06-observer-pubsub.md) | Bấm chuông kênh YouTube, có video mới tự báo | ✅ |
| 7 | [✈️ Middleware (Chain of Responsibility)](./07-middleware-chain.md) | Cửa an ninh sân bay: qua từng trạm, `next()` | ✅ |
| 16 | [🍜 Template Method](./16-template-method.md) | Công thức phở: khung cố định, chỉ đổi thịt | 🟡 |
| 18 | [🚂 State](./18-state.md) | Tàu qua từng ga: không nhảy cóc | 🟡 |

**Chú thích:** ✅ dùng thật · 🟡 mới có một phần · 💡 đề xuất áp dụng · 📚 chỉ có ví dụ học

> 🔋 DI không thuộc 23 pattern GoF gốc, nhưng là "keo dán" của Clean Architecture nên được xếp vào đây.

---

### 🗺️ Bản đồ: Pattern nào đang "sống" trong project?

```
E-commerce NodeJS
├── src/app.ts, src/middlewares/                ← ✈️ Middleware Chain, 🛡️ Proxy (rate limit, auth)
├── src/utils/common.ts (asyncHandler)          ← 🧋 Decorator
├── src/dbs/init.mongodb.ts                     ← ☕ Singleton
├── src/services/pubsub.service.ts              ← 🔔 Pub/Sub
├── src/design_patterns/                        ← 🥤🍕 Factory (bản học)
└── src/features/
    ├── product/service/                        ← 🥤 Factory + Registry, 🍜 Template Method (nửa đường)
    ├── checkout/service/                       ← 🏨 Facade
    ├── comments/                               ← 🔋 DI + 📚 Repository (Clean Architecture)
    ├── order/                                  ← 🚂 State (ORDER_STATUS)
    ├── rbac/services/access-control.service.ts ← ☕ Lazy Singleton + cache
    └── auth/utils/rbac.ts (grantAccess)        ← 🧋 Decorator có tham số
```

---

### 🎯 Cách đọc hiệu quả

1. **Bận? Đọc khung ⚡ "Đọc 30 giây"** ở đầu mỗi bài: hình dung, khi nào dùng, file trong project
2. **Đọc câu chuyện vui** để hiểu bản chất pattern
3. **Xem code ví dụ** ❌/✅ và chạy thử trong đầu
4. **Mở file project** để thấy pattern "sống" trong code thật
5. **Đọc cạm bẫy**, rồi chốt bằng câu ghi nhớ và Quick Quiz

### 🛤️ Lộ trình gợi ý (nếu chưa biết đọc gì trước)

```
Tuần 1 – "Ngày nào cũng gặp":  ✈️ Middleware → 🧋 Decorator → ☕ Singleton → 📚 Repository
Tuần 2 – "Tạo object cho khéo": 🥤 Simple Factory → 🍕 Factory Method → 🥪 Builder
Tuần 3 – "Code sạch, dễ test":  🔋 DI → 🏨 Facade → 🔌 Adapter → 🛡️ Proxy
Tuần 4 – "Logic linh hoạt":     🛵 Strategy → 🍜 Template Method → 🚂 State → 🔔 Observer
Bonus:                          🛋️ Abstract Factory, 🖨️ Prototype, 📦 Composite
```

> 💡 **Tip:** Mỗi file đọc độc lập được. Cần pattern nào thì đọc pattern đó trước, không cần theo thứ tự!
