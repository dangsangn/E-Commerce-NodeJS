# 🐱 Hành trình shop của Mèo – 18 pattern trong một câu chuyện

> **"Không ai thức dậy và nói 'hôm nay mình sẽ dùng Facade'. Người ta gặp rắc rối trước, pattern đến sau."**

Mèo là một dev mới, quyết định tự viết backend cho shop online của mình. Code thật của shop chính là **project này**.

Mỗi chương là một ngày Mèo gặp rắc rối, kèm 👉 link tới pattern đã cứu Mèo. Đọc một mạch là thấy vì sao pattern **sinh ra**. Muốn đào sâu thì bấm link.

---

## 📅 Chương 1 – Ngày khai trương: "Mongo ơi, sao 100 connection?"

Mèo viết `new Database()` ở mỗi file cần đọc DB. Chạy được một tuần, MongoDB Atlas gửi mail cảnh báo: **quá nhiều kết nối** 😵.

Mèo nghĩ: *"Quán cà phê đâu có mua một máy espresso cho mỗi nhân viên..."*

👉 [☕ **Singleton**](./01-singleton.md): cả app xài chung **một** kết nối.
📁 `src/dbs/init.mongodb.ts`

---

## 📅 Chương 2 – Request đầu tiên: "Ai cũng phải qua cửa"

API mở ra là có ngay ba yêu cầu: request nào cũng phải **ghi log**, **parse JSON**, **kiểm tra token**. Copy ba đoạn đó vào từng route thì Mèo chịu không nổi.

👉 [✈️ **Middleware**](./07-middleware-chain.md): xếp thành dây chuyền như cửa an ninh sân bay, mỗi trạm gọi `next()`.
📁 `src/app.ts`, `src/middlewares/`

Tuần sau, một con bot dùng hàng nghìn email khác nhau để spam API gửi OTP 🤖. Mèo đặt một **vệ sĩ** đứng trước route đăng ký: mỗi IP chỉ được gọi vài lần một phút.

👉 [🛡️ **Proxy**](./10-proxy.md): kiểm soát *trước khi* request chạm tới handler thật.
📁 `src/middlewares/rate-limit.middleware.ts` (gắn ở `src/features/auth/routes/`)

Controller nào cũng có `try { ... } catch (e) { next(e) }`. Mèo viết một hàm 5 dòng để **bọc** handler lại, giống thêm topping cho ly trà sữa.

👉 [🧋 **Decorator**](./14-decorator.md): `asyncHandler`, rồi `grantAccess(action, resource)`.
📁 `src/utils/common.ts`, `src/features/auth/utils/rbac.ts`

---

## 📅 Chương 3 – Bán áo thun, rồi bán thêm tai nghe

Ban đầu shop chỉ bán quần áo. Rồi Mèo nhập thêm đồ điện tử, và trong service xuất hiện:

```typescript
if (type === 'CLOTHING') new ClothingService(...)
else if (type === 'ELECTRONICS') new ElectronicService(...)
// sắp tới: SHOES, OTHER... 😰
```

👉 [🥤 **Simple Factory**](./02-simple-factory.md) + registry: như máy bán nước, bấm `product_type` nào thì ra service đó. Thêm loại mới chỉ cần thêm **một dòng** đăng ký.
📁 `ProductServiceFactory` trong `src/features/product/service/index.ts`

Nhưng nhìn kỹ thì `ClothingService` và `ElectronicService` copy-paste nhau hơn 20 dòng transaction, chỉ khác đúng một dòng 🫠.

👉 [🍜 **Template Method**](./16-template-method.md): bếp trưởng giữ công thức (mở transaction → ghi → commit/abort), mỗi loại sản phẩm chỉ điền phần "thịt".
📁 Cùng file. *Project mới đi được nửa đường, bài 16 chỉ cách đi nốt.*

---

## 📅 Chương 4 – Khách bắt đầu bình luận

Query Mongo bắt đầu mọc khắp các service. Muốn đổi một index cũng phải lục 6 file.

👉 [📚 **Repository**](./08-repository.md): gom truy vấn về một "thủ thư" duy nhất.
📁 `src/features/*/repository/`

Với tính năng bình luận, Mèo muốn **test** luật *"xóa comment gốc thì xóa luôn replies"*, nhưng không muốn mỗi lần test lại phải bật Mongo.

👉 [🔋 **Dependency Injection**](./17-dependency-injection.md): use-case chừa sẵn "hộc pin". Chạy thật thì lắp `MongoCommentRepository`, chạy test thì lắp repo giả trong RAM.
📁 `src/features/comments/` (lắp ráp ở `presentation/routes/index.ts`)

---

## 📅 Chương 5 – Giỏ hàng và cú lừa devtools

Một khách mở devtools, sửa giá iPhone thành 1.000đ rồi bấm thanh toán 🕵️. Mèo hiểu ra: **giá phải lấy từ server**. Mà tính tiền thì phải gọi ProductRepository, DiscountService, kiểm tra shop... và cả màn "Xem lại đơn" lẫn "Đặt hàng" đều cần đúng chuỗi đó.

👉 [🏨 **Facade**](./15-facade.md): một "lễ tân" `checkoutReview` lo hết, hai nơi cùng gọi chung.
📁 `src/features/checkout/service/index.ts`

---

## 📅 Chương 6 – Mùa sale: mã giảm giá

Có mã giảm **theo %** và mã giảm **số tiền cố định**. Rồi marketing hỏi: *"Thêm 'mua 3 tặng 1' được không anh?"* 😅

👉 [🛵 **Strategy**](./05-strategy.md): mỗi kiểu giảm giá là một "cách đi", chọn lúc runtime. Đích (số tiền cuối cùng) không đổi.
📁 *Đề xuất* cho `calculateDiscountAmount` trong `src/features/discount/services/discount.service.ts`

---

## 📅 Chương 7 – Phân quyền: 100 request cùng gõ cửa

Shop có admin, seller, khách. Bảng quyền đọc từ DB. Sáng thứ Hai, server vừa khởi động thì 100 request ập vào cùng lúc, và cả 100 đều đi build bảng quyền 💥.

👉 [☕ **Singleton**, bản async](./01-singleton.md): giữ lại *promise đang chạy*, ai đến sau thì chờ chung một mẻ.
📁 `src/features/rbac/services/access-control.service.ts`

---

## 📅 Chương 8 – Đơn hàng: "Hủy đơn đang trên xe tải?"

Một khách bấm hủy đơn khi shipper đã cầm hàng đi được nửa đường 🚚. Mèo nhận ra mỗi trạng thái đơn hàng là một **ga tàu**, và mỗi ga có luật riêng.

👉 [🚂 **State**](./18-state.md): liệt kê các ga, vẽ bảng "được đi tới đâu", chỉ đổi status qua đúng một cửa.
📁 `ORDER_STATUS` trong `src/features/order/` (mới có luật `pending → cancelled`)

---

## 📅 Chương 9 – Đặt hàng xong, ai cần biết?

Đặt hàng xong thì phải gửi mail xác nhận, báo cho shop, ghi log... Nếu `OrderService` tự gọi tay từng việc thì nó sẽ biết quá nhiều.

👉 [🔔 **Observer / Pub-Sub**](./06-observer-pubsub.md): phát một tin "có đơn mới", ai quan tâm thì bấm chuông nghe.
📁 `src/services/pubsub.service.ts` (Redis, hiện mới dùng trong route test)

Rồi nhà cung cấp mail tăng giá, Mèo muốn chuyển sang dịch vụ khác. Nhưng `nodemailer` đang được gọi thẳng trong từng hàm gửi mail...

👉 [🔌 **Adapter**](./09-adapter.md): bọc provider sau một interface chung, đổi nhà cung cấp chỉ cần đổi một dòng.
📁 *Đề xuất* cho `src/services/email.service.ts`, upload Cloudinary

---

## 📅 Chương 10 – Những ước mơ của Mèo

Shop chạy ổn. Mèo ghi lại danh sách việc muốn làm, mỗi việc đều có sẵn một pattern chờ:

| 💭 Mèo muốn... | 👉 Pattern |
|---|---|
| Bán **combo**: thùng quà chứa sản phẩm, chứa cả combo nhỏ | [📦 Composite](./13-composite.md) |
| Nút **"Nhân bản sản phẩm"** cho seller | [🖨️ Prototype](./12-prototype.md) |
| Chạy local với **cả bộ** hạ tầng giả (cache RAM, ổ đĩa, Mailpit) | [🛋️ Abstract Factory](./11-abstract-factory.md) |
| Tạo đơn hàng phức tạp mà không cần constructor 15 tham số | [🥪 Builder](./04-builder.md) |
| Hiểu gốc rễ của Factory: để class con tự quyết định tạo gì | [🍕 Factory Method](./03-factory-method.md) |

---

## 🎬 Hết phim

> Mèo không học thuộc 18 pattern rồi mới code. Mèo **gặp rắc rối**, **nhận ra hình dạng** của nó, rồi **gọi đúng tên**.
>
> Lần tới thấy code mình "khó chịu", hãy mở [🧭 Cheat Sheet](./99-cheat-sheet.md) và tra triệu chứng. Biết đâu Mèo đã gặp rồi 🐱.

---

[⬅️ Về mục lục](./README.md) | [Bắt đầu: ☕ Singleton →](./01-singleton.md)
