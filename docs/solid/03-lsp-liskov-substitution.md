# 🦆 L - Liskov Substitution Principle (Thay Thế Liskov)

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** *"Nếu nó trông giống con vịt, bơi giống con vịt, kêu quạc quạc như con vịt... nhưng nó lại chạy bằng pin và nổ tung khi bạn thả xuống hồ nước → Bạn đã tạo ra một lớp con phá hoại!"* 🦆🔋💥
> - 🎯 **Định nghĩa chuẩn của Giáo sư Barbara Liskov:** *"Subtypes must be substitutable for their base types without altering the correctness of the program."* (Lớp con phải có khả năng thay thế hoàn toàn cho lớp cha mà **không làm thay đổi tính đúng đắn** của chương trình).
> - 📁 **Trong project:** `src/core/error.response.ts`, các lớp xử lý phản hồi API và thanh toán.

---

## 🎪 Câu chuyện vui: Vụ án chú chim cánh cụt rơi tự do từ tầng 10

Một ngày nọ, một Junior Developer được giao nhiệm vụ viết game **Vườn Bách Thú** 🎪.

Bạn ấy thiết kế một lớp cha rất hợp lý theo kiến thức sinh học lớp 6:

```typescript
class Bird {
  fly() {
    console.log('Đang đập cánh bay lượn trên bầu trời xanh...');
  }
}

class Sparrow extends Bird {
  // Chim sẻ: Bay vù vù, hoàn hảo!
}
```

Mọi chuyện vẫn êm đềm cho đến khi vườn thú nhập về một chú **Chim Cánh Cụt (Penguin)**.  
Vì cánh cụt về mặt sinh học vẫn là "chim", bạn ấy liền cho kế thừa:

```typescript
class Penguin extends Bird {
  override fly() {
    // Ơ kìa, cánh cụt đâu biết bay!
    throw new Error('Cứu tôi với, tôi là cánh cụt, tôi không biết bayyyy!');
  }
}
```

Sau đó, một lập trình viên khác viết tính năng **"Phóng sinh chim về với thiên nhiên"**:

```typescript
function releaseBirdsToTheSky(birds: Bird[]) {
  for (const bird of birds) {
    // Vì danh sách là Bird[], ai cũng tin chắc chim nào cũng bay được!
    bird.fly();
  }
}

// Chạy thử nghiệm:
const birds: Bird[] = [new Sparrow(), new Penguin()];
releaseBirdsToTheSky(birds);
```

**KẾT QUẢ:**
1. Chim sẻ tung cánh bay vút lên trời 🕊️.
2. Đến lượt chú chim cánh cụt, hàm `bird.fly()` văng ra `Exception` to đùng!
3. Toàn bộ server Crash sập nguồn, hàng ngàn con chim khác bị kẹt lại lồng! 💀

**Tại sao bi kịch này xảy ra?**  
Bởi vì lớp con `Penguin` đã **phản bội lời hứa của lớp cha `Bird`**! Lớp cha hứa rằng *"Cứ là Bird thì gọi `fly()` sẽ bay"*, nhưng lớp con lại ném lỗi vào mặt người gọi!

---

## ❓ Dấu hiệu bạn đang "dẫm phải mìn" LSP

| 🚩 Mùi code (Code Smell) | 🩺 Căn bệnh tiềm ẩn |
| :---| :---|
| Hàm con ghi đè hàm cha bằng: `throw new Error("Not supported")` | Lớp con không có khả năng thực hiện hành vi của cha nhưng vẫn cố kế thừa. |
| Hàm con ghi đè hàm cha bằng một thân hàm... **rỗng tuếch** `{}` | Làm mất tác dụng của hàm cha, người gọi tưởng đã chạy nhưng thực tế không làm gì. |
| Phải dùng `if (obj instanceof ChildClass)` trước khi gọi hàm | Sự sụp đổ của tính Đa hình (Polymorphism): Phải soi xem thằng con là ai mới dám dùng. |
| Hàm cha trả về `number`, hàm con hứng chí trả về `null` hoặc `string` | Vi phạm kiểu dữ liệu đầu ra khiến code bên ngoài bị `TypeError: Cannot read property...`. |

---

## 💻 Code thực chiến: Node.js E-commerce

### ❌ Anti-pattern: Thanh toán COD "bóp cổ" tiến trình Hoàn tiền tự động

Trong hệ thống E-commerce, ta có lớp cha `Payment` dùng để trừ tiền và hoàn tiền:

```typescript
// Lớp cha đại diện cho cổng thanh toán
export class Payment {
  async processPayment(amount: number): Promise<void> {
    console.log(`Đã thu ${amount} VNĐ`);
  }

  async refund(amount: number): Promise<void> {
    console.log(`Đã hoàn trả ${amount} VNĐ về tài khoản khách hàng`);
  }
}

// Cổng thẻ tín dụng: Hoàn tiền online cực chuẩn
export class CreditCardPayment extends Payment {
  override async refund(amount: number) {
    // Gọi Stripe API hoàn tiền vào thẻ
    console.log(`Stripe: Hoàn trả ${amount} vào thẻ Visa`);
  }
}

// Cổng COD (Tiền mặt khi giao hàng): Ối giồi ôi!
export class CodPayment extends Payment {
  override async refund(amount: number) {
    // Khách trả tiền mặt cho shipper thì làm sao hoàn tiền qua API được?!
    throw new Error('LỖI: Đơn hàng COD không thể hoàn tiền tự động qua API!');
  }
}
```

Bây giờ, hệ thống có một Cron Job chạy lúc nửa đêm để **hoàn tiền cho các đơn hàng bị hủy**:

```typescript
async function processMidnightRefunds(payments: Payment[], amount: number) {
  for (const payment of payments) {
    // 💥 NẾU GẶP CodPayment -> TOÀN BỘ CRON JOB BỊ DỪNG LẠI!
    // Các khách hàng dùng thẻ phía sau KHÔNG NHẬN ĐƯỢC TIỀN HOÀN!
    await payment.refund(amount);
  }
}
```

> **Cách chữa cháy tệ hại mà nhiều dev hay làm:**
> ```typescript
> if (!(payment instanceof CodPayment)) {
>   await payment.refund(amount);
> }
> ```
> *(Đoạn `if` này chính là bằng chứng tố cáo bạn đã vi phạm cả LSP lẫn OCP! Sau này có thêm `BankTransferPayment` cũng không hoàn tự động được thì lại vào thêm `if` à?)*

---

### ✅ Refactored: Tách biệt năng lực (Interface Segregation + LSP)

Không phải phương thức thanh toán nào cũng có năng lực hoàn tiền online tự động. Đừng ép lớp cha ôm đồm hành vi mà lớp con không làm được!

```typescript
// 1. Lớp cha cơ bản: Chỉ làm nhiệm vụ thanh toán
export interface IPayment {
  processPayment(amount: number): Promise<void>;
}

// 2. Năng lực đặc biệt: Chỉ dành cho các cổng hỗ trợ Hoàn Tiền Online
export interface IRefundablePayment extends IPayment {
  refund(amount: number): Promise<void>;
}

// 3. CreditCard vừa thanh toán được, vừa hoàn tiền được
export class CreditCardPayment implements IRefundablePayment {
  async processPayment(amount: number) {
    console.log(`Thu tiền thẻ tín dụng: ${amount}$`);
  }

  async refund(amount: number) {
    console.log(`Hoàn tiền thẻ tín dụng: ${amount}$`);
  }
}

// 4. COD chỉ là IPayment thông thường, không có hàm refund
export class CodPayment implements IPayment {
  async processPayment(amount: number) {
    console.log(`Shipper thu tiền mặt khi giao hàng: ${amount} VNĐ`);
  }
}
```

Bây giờ hàm hoàn tiền tự động chỉ chấp nhận những phương thức **thực sự hoàn được**:

```typescript
// Hàm chỉ nhận những payment có năng lực hoàn tiền!
async function processMidnightRefunds(refundablePayments: IRefundablePayment[], amount: number) {
  for (const payment of refundablePayments) {
    // Tuyệt đối an toàn 100%, không bao giờ ném lỗi "Not supported"!
    await payment.refund(amount);
  }
}
```

> 🎯 **Quy tắc vàng của LSP:**  
> Bất kỳ hàm nào đang dùng `IPayment` thì truyền `CodPayment` hay `CreditCardPayment` vào đều chạy trơn tru, không có sự bất ngờ khó chịu nào xảy ra!

---

## 🔍 Trong project E-commerce này nằm ở đâu?

Hãy mở ngay file **`src/core/error.response.ts`** ra xem!

Trong project, tác giả xây dựng cây gia phả Exception cực kỳ chuẩn chỉ theo LSP:

```
Error (Built-in của JavaScript)
 └── ErrorResponse (Lớp cha của toàn bộ lỗi trong hệ thống)
      ├── AuthFailureError (Lỗi 401: Sai token, chưa đăng nhập)
      ├── NotFoundError (Lỗi 404: Không tìm thấy sản phẩm/user)
      ├── ForbiddenError (Lỗi 403: Không có quyền truy cập)
      └── BadRequestError (Lỗi 400: Dữ liệu gửi lên sai quy chuẩn)
```

Ở file bắt lỗi tổng `src/app.ts`, middleware xử lý lỗi hoạt động như sau:
```typescript
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = error.status || 500;
  return res.status(statusCode).json({
    status: 'error',
    code: statusCode,
    message: error.message || 'Internal Server Error'
  });
});
```

👉 Cho dù controller quăng ra `NotFoundError`, `AuthFailureError` hay bất kỳ lỗi con nào, chúng đều có thể **thay thế hoàn hảo cho `ErrorResponse`** với đầy đủ thuộc tính `status` và `message`. Không có lỗi con nào tự dưng đổi tên thuộc tính thành `httpCode` hay xóa mất thuộc tính `message` làm sập middleware!

---

## ⚠️ Cạm bẫy kinh điển: "Hình vuông vs Hình chữ nhật"

Trong hình học phổ thông:  
*“Hình vuông là một hình chữ nhật đặc biệt (có 4 cạnh bằng nhau)”* → Nhiều người liền viết: `class Square extends Rectangle`.

```typescript
class Rectangle {
  constructor(protected width: number, protected height: number) {}
  setWidth(w: number) { this.width = w; }
  setHeight(h: number) { this.height = h; }
  getArea() { return this.width * this.height; }
}

class Square extends Rectangle {
  override setWidth(w: number) {
    this.width = w;
    this.height = w; // Hình vuông cạnh bằng nhau
  }
  override setHeight(h: number) {
    this.width = h;
    this.height = h;
  }
}
```

**Bẫy LSP xuất hiện:**
```typescript
function resizeAndVerifyArea(rect: Rectangle) {
  rect.setWidth(5);
  rect.setHeight(4);
  // Người gọi kỳ vọng: Diện tích hình chữ nhật 5 x 4 phải = 20!
  console.assert(rect.getArea() === 20, 'Toang rồi!');
}

// Nếu truyền Rectangle thật: 5 x 4 = 20 (Đúng)
// Nếu truyền Square: setWidth(5) -> cạnh 5. setHeight(4) -> cạnh thành 4! 4 x 4 = 16! (SAI BÉT) 💥
```

> 💡 **Bài học xương máu:** Ngoài đời thật trông có vẻ là cha con, nhưng trong lập trình nếu **hành vi (Behavior)** không thay thế được nhau thì **TUYỆT ĐỐI KHÔNG KẾ THỪA**! Hãy ưu tiên **Composition over Inheritance** (Gom cụm thay vì kế thừa).

---

## 💡 Câu ghi nhớ nhập tâm

> 🦆 *"Con phải giữ trọn lời thề của cha. Nếu là con vịt mà không biết bơi thì đừng nhận mình là vịt!"*

---

## 🎯 Quick Quiz: Thử tài tinh mắt!

**Câu hỏi:** Đoạn code TypeScript sau có vi phạm LSP không?

```typescript
class ReadOnlyRepository {
  async findById(id: string) { /* ... */ }
}

class SqlRepository extends ReadOnlyRepository {
  async save(data: any) { /* ... */ }
  async delete(id: string) { /* ... */ }
}
```

- **A.** Có vi phạm, vì class con có nhiều hàm hơn class cha.
- **B.** Không vi phạm, vì mọi nơi cần `ReadOnlyRepository` truyền `SqlRepository` vào vẫn đọc dữ liệu bình thường, không hàm nào bị ném lỗi hay phá vỡ hành vi cũ.

<details>
<summary>👉 Bấm vào đây để xem đáp án</summary>

**Đáp án chính xác: B!** 🎉  
Lớp con được phép **mở rộng thêm** tính năng (`save`, `delete`). Miễn là nó vẫn thực hiện trọn vẹn và đúng đắn các hành vi mà lớp cha cam kết (`findById`), thì nó hoàn toàn tuân thủ LSP!
</details>

---

Tiếp tục hành trình với **[Bài 4: I - Interface Segregation Principle](./04-isp-interface-segregation.md)** 🍽️!
