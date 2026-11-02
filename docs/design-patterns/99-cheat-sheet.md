# 🧭 Cheat Sheet – Bắt bệnh, kê đơn pattern

> **"Đừng học pattern để tìm chỗ nhét vào. Hãy nhìn triệu chứng trong code, rồi mới kê đơn."** 🩺

---

## 🤒 Triệu chứng → 💊 Pattern

| 🤒 Code của bạn đang... | 💊 Thử pattern | 📖 |
|---|---|---|
| `new Database()` ở 10 file, mở 10 connection | ☕ Singleton | [01](./01-singleton.md) |
| `if (type === 'clothing') new A() else if ...` để **tạo object** | 🥤 Simple Factory + registry | [02](./02-simple-factory.md) |
| Class cha cần tạo object, nhưng mỗi class con tạo một loại khác | 🍕 Factory Method | [03](./03-factory-method.md) |
| Phải tạo **cả bộ** object đi cùng nhau (theme, bộ hạ tầng) | 🛋️ Abstract Factory | [11](./11-abstract-factory.md) |
| Constructor 10 tham số, nửa số đó là optional | 🥪 Builder | [04](./04-builder.md) |
| Muốn "nhân bản" một object có sẵn rồi sửa vài chỗ | 🖨️ Prototype | [12](./12-prototype.md) |
| `if (method === 'momo') ... else if ('vnpay')` để **chọn cách làm** | 🛵 Strategy | [05](./05-strategy.md) |
| Làm xong việc A, phải gọi tay B, C, D (gửi mail, log, cache...) | 🔔 Observer / Pub-Sub | [06](./06-observer-pubsub.md) |
| Mọi request đều phải qua: log → auth → validate → handler | ✈️ Middleware Chain | [07](./07-middleware-chain.md) |
| Query Mongo rải khắp service, muốn test mà không cần DB | 📚 Repository | [08](./08-repository.md) |
| Thư viện bên thứ 3 có interface "khó chịu", sợ sau này đổi provider | 🔌 Adapter | [09](./09-adapter.md) |
| Muốn cache / chặn quyền / lazy-load **trước khi** gọi object thật | 🛡️ Proxy | [10](./10-proxy.md) |
| Dữ liệu dạng cây, muốn gọi `.getPrice()` như nhau cho lá và cành | 📦 Composite | [13](./13-composite.md) |
| Copy-paste `try/catch`, timing, retry quanh nhiều function | 🧋 Decorator | [14](./14-decorator.md) |
| Controller gọi 4 service theo đúng thứ tự, và chỗ khác cũng cần y vậy | 🏨 Facade | [15](./15-facade.md) |
| Nhiều subclass copy-paste cùng "bộ khung", chỉ khác 1–2 dòng | 🍜 Template Method | [16](./16-template-method.md) |
| `new MongoRepo()` bên trong class → không test được | 🔋 Dependency Injection | [17](./17-dependency-injection.md) |
| `if (status === ...)` rải khắp nơi, chuyển trạng thái sai = mất tiền | 🚂 State | [18](./18-state.md) |

---

## 👯 Các cặp "sinh đôi" hay bị nhầm

Nhìn code giống nhau, nhưng **ý định** khác nhau. Phỏng vấn rất thích hỏi mấy cặp này 😏.

### 🏭 Bộ tứ "tạo object"

```
🥤 Simple Factory    1 hàm, 1 switch, chọn class để new     → máy bán nước: bấm số, ra lon
🍕 Factory Method    class con quyết định new cái gì         → chi nhánh tự nướng pizza
🛋️ Abstract Factory  1 factory tạo CẢ BỘ sản phẩm đồng bộ    → IKEA cùng bộ sưu tập
🥪 Builder           lắp ráp TỪNG BƯỚC một object phức tạp   → Subway chọn từng món
```

### 🎀 Bộ ba "bọc ngoài"

```
🔌 Adapter    ĐỔI HÌNH DẠNG interface cho khớp      → cục chuyển phích cắm
🧋 Decorator  THÊM hành vi, luôn gọi vào trong      → thêm topping
🛡️ Proxy      KIỂM SOÁT, có thể KHÔNG gọi vào       → vệ sĩ chặn cửa
```

### 🔀 Bộ ba "đổi hành vi"

```
🛵 Strategy         CLIENT chọn cách làm (truyền vào)       → sáng nay mưa, chọn ô tô
🚂 State            OBJECT tự đổi hành vi theo trạng thái   → tàu tới ga nào, theo luật ga đó
🍜 Template Method  CLASS CON điền bước trống (kế thừa)     → công thức phở, chỉ đổi thịt
```

### ⚖️ Một với nhiều

```
🔌 Adapter   1 → 1   làm cho VỪA
🏨 Facade    N → 1   làm cho GỌN
```

---

## 🗺️ Pattern "sống" ở đâu trong project?

| Pattern | File | Mức độ |
|---|---|---|
| ☕ Singleton | `src/dbs/init.mongodb.ts` | ✅ dùng thật |
| ☕ Lazy Singleton + cache | `src/features/rbac/services/access-control.service.ts` | ✅ dùng thật, xem mẹo chống race ở bài 01 |
| 🥤 Factory + Registry | `src/features/product/service/index.ts` (`ProductServiceFactory`) | ✅ dùng thật |
| 🥤🍕 Factory (bản học) | `src/design_patterns/*.ts` | 📚 ví dụ học |
| 🍜 Template Method | `src/features/product/service/index.ts` (`ProductService`) | 🟡 nửa đường, xem bài 16 |
| 🏨 Facade | `src/features/checkout/service/index.ts` | ✅ dùng thật |
| 🔋 DI + 📚 Repository | `src/features/comments/` | ✅ dùng thật |
| 📚 Repository (static) | `src/features/*/repository/` | ✅ dùng thật |
| 🧋 Decorator | `src/utils/common.ts` (`asyncHandler`), `src/features/auth/utils/rbac.ts` | ✅ dùng thật |
| ✈️ Middleware Chain | `src/app.ts`, `src/middlewares/` | ✅ dùng thật |
| 🛡️ Proxy | `src/middlewares/rate-limit.middleware.ts`, auth middleware | ✅ dùng thật |
| 🔔 Pub/Sub | `src/services/pubsub.service.ts` | ✅ dùng thật |
| 🚂 State | `src/features/order/` (`ORDER_STATUS`) | 🟡 mới có 1 luật chuyển |
| 🛵 Strategy | discount (`percentage` / `fixed_amount`), auth | 💡 đề xuất |
| 🔌 Adapter | `src/services/email.service.ts`, upload | 💡 đề xuất |
| 📦 Composite | comments (đang là `parentId` phẳng) | 💡 đề xuất |
| 🛋️ Abstract Factory, 🖨️ Prototype, 🥪 Builder | – | 📚 chỉ có ví dụ |

---

## 🎶 Lục bát ôn bài – 18 pattern, 38 câu

Mỗi cặp câu là đúng **hình ảnh** của pattern đó. Đọc to vài lần là thuộc 😄

> ☕ **Singleton**\
> Quán xinh một máy pha thôi,\
> Ai cần thì cứ tới ngồi dùng chung.
>
> 🥤 **Simple Factory**\
> Bấm nút máy nước ung dung,\
> Muốn lon nào có, lon đùng rơi ra.
>
> 🍕 **Factory Method**\
> Pizza chuỗi lớn một nhà,\
> Mỗi chi nhánh tự nướng ra bánh mình.
>
> 🛋️ **Abstract Factory**\
> Bàn ghế mua trọn bộ xinh,\
> Cùng một phong cách, chẳng linh tinh màu.
>
> 🥪 **Builder**\
> Bánh mì từng bước nối nhau,\
> Thêm rau thêm thịt, sốt sau mới thành.
>
> 🖨️ **Prototype**\
> Đề thi photo cho nhanh,\
> Sửa đôi ba chỗ, đỡ dành cả ngày.
>
> 🛵 **Strategy**\
> Đi làm đích chẳng đổi thay,\
> Mưa thì ô tô, tắc ngay xe ôm.
>
> 🔔 **Observer**\
> Bấm chuông kênh nhạc một hôm,\
> Tin về tận máy, khỏi dòm mỗi ngày.
>
> ✈️ **Middleware**\
> Sân bay trạm nối trạm này,\
> Soát xong một thứ, đẩy ngay trạm kề.
>
> 📚 **Repository**\
> Thủ thư giữ sách bốn bề,\
> Hỏi sách là có, chẳng hề lục kho.
>
> 🔌 **Adapter**\
> Phích ngoại ổ nội nhỏ to,\
> Thêm cục chuyển đổi, hết lo cắm liền.
>
> 🛡️ **Proxy**\
> Vệ sĩ gác cửa ngoài hiên,\
> Có quyền mới vào, kẻ phiền chặn ngay.
>
> 📦 **Composite**\
> Thùng to chứa thùng nhỏ đầy,\
> Hỏi giá một tiếng, cộng ngay từ trong.
>
> 🧋 **Decorator**\
> Trà sữa topping xếp chồng,\
> Ly vẫn là ly, mỗi vòng thêm ngon.
>
> 🏨 **Facade**\
> Lễ tân một cuộc gọi tròn,\
> Xe, bàn, giặt giũ, vẫn còn thảnh thơi.
>
> 🍜 **Template Method**\
> Phở ngon công thức đời đời,\
> Xương ninh cố định, tùy người thịt nào.
>
> 🔋 **Dependency Injection**\
> Điều khiển đợi pin lắp vào,\
> Pin thật pin giả, pin nào cũng xong.
>
> 🚂 **State**\
> Tàu chạy từng ga một vòng,\
> Ga nào luật nấy, đừng mong nhảy càn.
>
> 🎉 **Kết**\
> Thuộc xong mười tám chiêu ngoan,\
> Code sáu tháng nữa vẫn nhàn như chơi!

> 🎵 Vần nối liền một mạch từ đầu tới cuối: chữ cuối câu 8 của cặp này vần với chữ cuối câu 6 của cặp sau (*chung → dung*, *ra → nhà*, *mình → xinh*...). Quên một cặp thì nhẩm vần của cặp trước là nhớ ra.

---

## ⚠️ Lời khuyên cuối

1. **YAGNI trước, pattern sau.** 2–3 `if` thì cứ để `if`. Khi đến cái thứ 4, hoặc khi mỗi nhánh dài 20 dòng, hãy refactor.
2. **Pattern là từ vựng.** Nói *"cái này là Facade"* trong code review sẽ nhanh hơn giải thích 5 phút.
3. **Đọc code thật.** Mở file trong bảng trên, tìm pattern bằng mắt. Nhớ lâu gấp 10 lần đọc lý thuyết 👀.

---

[⬅️ State](./18-state.md) | [Về mục lục](./README.md)
