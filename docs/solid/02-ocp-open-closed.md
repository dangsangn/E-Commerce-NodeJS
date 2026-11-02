# 🦾 O - Open/Closed Principle (Nguyên Tắc Đóng - Mở)

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Chiếc điện thoại thông minh và cổng USB-C. Khi bạn muốn nghe nhạc, sạc pin hay cắm chuột, bạn chỉ việc **cắm phụ kiện vào cổng Type-C** (Mở rộng). Tuyệt đối không ai đi lấy tua-vít tháo tung vỏ điện thoại, hàn dây đồng vào bo mạch chủ mỗi khi muốn cắm tai nghe (Sửa code cũ)!
> - 🎯 **Định nghĩa chuẩn của Bertrand Meyer:** *"Software entities should be open for extension, but closed for modification."* (Thực thể phần mềm nên **mở để mở rộng**, nhưng **đóng để sửa đổi**).
> - 📁 **Trong project:** `src/features/product/service/product.factory.ts`, `src/features/discount/service/`

---

## 🎪 Câu chuyện vui: Cuộc "Mổ tim sống" lúc nửa đêm vì cái cổng MoMo

Website E-commerce của bạn đang chạy rất mượt mà với cổng thanh toán **Stripe** (quẹt thẻ quốc tế). 

Vào một buổi sáng thứ Hai đẹp trời, Sếp bước vào phòng kỹ thuật, mặt tươi như hoa:

> *"Team ơi, sắp tới Black Friday, dân mình chuộng xài ví điện tử lắm! Team tích hợp thêm **MoMo** và **VNPay** trước thứ Sáu này nhé. Dễ mà, chỉ là thanh toán thôi mà!"* ☕😎

Bạn tự tin mở file `PaymentService.ts` lên. Bên trong là một hàm huyền thoại:

```typescript
switch (paymentMethod) {
  case 'stripe':
    // 150 dòng code xử lý Stripe
    break;
  case 'paypal':
    // 120 dòng code xử lý PayPal
    break;
  case 'cod':
    // 50 dòng code xử lý Tiền mặt khi nhận hàng
    break;
}
```

Bạn hí hửng viết thêm:
```typescript
case 'momo':
  // 100 dòng code xử lý MoMo
  // ... Ôi chết, mải nghe nhạc quên gõ lệnh `break;`! 😱
```

Tối thứ Sáu deploy lên production. Thảm họa ập đến:
1. Khách hàng Tây chọn thanh toán qua **Stripe**.
2. Do bạn quên lệnh `break;`, code chạy tuột xuống luôn đoạn xử lý **MoMo**.
3. Khách Tây vừa bị trừ tiền thẻ Visa, vừa nhận được thông báo lỗi từ MoMo, giỏ hàng thì bị hủy!
4. Khách Tây chửi bới, khách Việt khiếu nại, cả team kỹ thuật phải thức trắng đêm **"mổ tim sống"** cho file `PaymentService.ts`.

**Tại sao bi kịch này xảy ra?**  
Bởi vì mỗi khi thêm một cổng thanh toán mới, bạn lại **mở toang file code cũ đang chạy ổn định 3 năm nay ra để sửa**! Chỉ một chút sơ sẩy là bạn làm gãy luôn các tính năng cũ đang kiếm tiền cho công ty!

---

## ❓ Dấu hiệu nhận biết bạn đang "phá hoại" OCP

| 🚩 Mùi code (Code Smell) | 🩺 Căn bệnh tiềm ẩn |
| :---| :---|
| Cụm `if-else if-else` hoặc `switch-case` dài cả mét theo `type` | Cứ có type mới là lại chui vào file cũ thêm một nhánh `case`. |
| Mỗi lần thêm tính năng mới, git diff đỏ lòm ở các file cốt lõi | Rủi ro hồi quy (Regression bug) cực cao: tính năng mới chưa thấy đâu đã làm hỏng tính năng cũ. |
| Test suite cũ tự dưng fail hàng loạt khi thêm tính năng mới | Bạn vừa sửa code cũ khiến các hành vi vốn đã được kiểm thử bị biến dạng. |
| Developer sợ hãi, khấn vái mỗi khi chạm vào một file "huyền thoại" | File đó quá nhạy cảm vì ai cũng từng nhét thêm `if` vào đấy. |

---

## 💻 Code thực chiến: Node.js & TypeScript

### ❌ Anti-pattern: Đống rác Switch-Case (Vi phạm OCP trắng trợn)

```typescript
// 😱 File: PaymentService.ts (Mỗi tuần lại vào đây mổ xẻ một lần)
export class BadPaymentService {
  async processPayment(method: string, amount: number) {
    if (method === 'stripe') {
      console.log(`Quẹt thẻ Stripe: ${amount}$`);
      // Logic gọi Stripe API...
    } else if (method === 'paypal') {
      console.log(`Chuyển hướng PayPal: ${amount}$`);
      // Logic gọi PayPal API...
    } else if (method === 'momo') {
      console.log(`Tạo mã QR MoMo: ${amount} VNĐ`);
      // Logic tạo QR MoMo...
    } else if (method === 'vnpay') {
      console.log(`Gọi cổng VNPay: ${amount} VNĐ`);
      // Logic gọi VNPay...
    } else {
      throw new Error('Cổng thanh toán không hỗ trợ!');
    }
  }
}
```

> **Bi kịch:** Ngày mai Sếp bảo: *"Tích hợp thêm ZaloPay và Apple Pay nhé em!"*  
> → Bạn lại phải chui vào đây, viết thêm 2 cái `else if`, nguy cơ đụng chạm code Stripe/PayPal cũ là 100%!

---

### ✅ Refactored: Sử dụng Strategy & Registry Pattern (Chuẩn chỉ OCP)

Thay vì sửa code cũ, ta biến hệ thống thành một **bảng cắm mô-đun (Plugin Architecture)**:

```typescript
// 1. Bản hợp đồng chung (Interface) - Không bao giờ thay đổi!
export interface IPaymentStrategy {
  readonly code: string;
  pay(amount: number): Promise<{ success: boolean; transactionId: string }>;
}

// 2. Từng cổng thanh toán là 1 file độc lập riêng biệt:

// File: StripePaymentStrategy.ts
export class StripePaymentStrategy implements IPaymentStrategy {
  readonly code = 'stripe';
  async pay(amount: number) {
    console.log(`Quẹt thẻ Stripe xịn xò: ${amount}$`);
    return { success: true, transactionId: 'stripe_tx_123' };
  }
}

// File: MomoPaymentStrategy.ts
export class MomoPaymentStrategy implements IPaymentStrategy {
  readonly code = 'momo';
  async pay(amount: number) {
    console.log(`Tạo mã QR MoMo quét cực nhanh: ${amount} VNĐ`);
    return { success: true, transactionId: 'momo_tx_999' };
  }
}

// 3. Nhạc trưởng PaymentContext (ĐÓNG để sửa, MỞ để cắm thêm)
export class PaymentContext {
  private strategies = new Map<string, IPaymentStrategy>();

  // Cổng cắm mở rộng: Đăng ký cổng mới bất kỳ lúc nào!
  registerStrategy(strategy: IPaymentStrategy): void {
    this.strategies.set(strategy.code, strategy);
  }

  async executePayment(method: string, amount: number) {
    const strategy = this.strategies.get(method);
    if (!strategy) {
      throw new Error(`Phương thức thanh toán [${method}] chưa được hỗ trợ!`);
    }
    return strategy.pay(amount);
  }
}
```

#### 🎉 Giờ sếp đòi thêm **ZaloPay**? Dễ như ăn kẹo:
Bạn chỉ cần **tạo một file mới toanh** `ZaloPayStrategy.ts`:

```typescript
// File mới: ZaloPayStrategy.ts (Không sửa bất kỳ dòng nào ở code cũ!)
export class ZaloPayStrategy implements IPaymentStrategy {
  readonly code = 'zalopay';
  async pay(amount: number) {
    console.log(`Bắn tiền qua ZaloPay siêu tốc: ${amount} VNĐ`);
    return { success: true, transactionId: 'zalo_tx_555' };
  }
}

// Ở file khởi chạy app (bootstrap):
const paymentContext = new PaymentContext();
paymentContext.registerStrategy(new StripePaymentStrategy());
paymentContext.registerStrategy(new MomoPaymentStrategy());
paymentContext.registerStrategy(new ZaloPayStrategy()); // Cắm thêm vào là xong!
```

> 🌟 **Lợi ích ngút ngàn:**
> - Code cũ của Stripe, MoMo được **đóng băng (Closed)**: Không ai chạm vào, an toàn 100%!
> - Tính năng mới được **mở rộng (Open)** thông qua việc implement interface.
> - Git diff chỉ có `+ Added ZaloPayStrategy.ts`. Đồng nghiệp review code vỗ tay tán thưởng vì không sợ ảnh hưởng hệ thống!

---

## 🔍 Trong project E-commerce này nằm ở đâu?

Hãy mở ngay file **`src/features/product/service/product.factory.ts`** của repo này ra xem!

Trong project, hệ thống bán rất nhiều loại mặt hàng:
- `Clothing` (Quần áo: có size, màu, chất liệu)
- `Electronics` (Đồ điện tử: có bảo hành, hãng sản xuất)
- `Furniture` (Nội thất: có kích thước, chất liệu gỗ)

Team dự án đã áp dụng chuẩn **OCP qua Product Factory Registry**:
```typescript
// Đăng ký class xử lý cho từng loại product mà KHÔNG CẦN switch-case!
ProductFactory.registerProductType('Clothing', Clothing);
ProductFactory.registerProductType('Electronics', Electronics);
ProductFactory.registerProductType('Furniture', Furniture);

// Ngày mai muốn bán thêm "Sách" (Book)?
// Chỉ cần tạo class Book và gọi:
ProductFactory.registerProductType('Book', Book);
// Toàn bộ logic tạo sản phẩm cũ giữ nguyên 100%!
```

---

## ⚠️ Cạm bẫy cần tránh: Đừng vội biến mọi thứ thành plugin!

> 🚨 **Căn bệnh "Ảo tưởng tương lai":**  
> Nếu bạn chỉ có đúng 2 trường hợp cố định không bao giờ thay đổi (ví dụ: Giới tính `MALE` / `FEMALE`), đừng vẽ ra `GenderStrategy`, `MaleStrategyFactory`...  
> **Nguyên tắc vàng:** *Lần 1 cứ viết bình thường. Lần 2 bắt đầu để ý. Lần 3 xuất hiện trường hợp tương tự thì mới Refactor sang OCP!*

---

## 💡 Câu ghi nhớ nhập tâm

> 🦾 *"Lắp thêm vũ khí vào cánh tay Iron Man chứ đừng bao giờ mổ tim Tony Stark. Thêm tính năng = Viết file mới, đừng sửa file cũ!"*

---

## 🎯 Quick Quiz: Thử tài kiến trúc sư!

**Câu hỏi:** Giả sử bạn cần tính phí ship cho các đơn vị vận chuyển: `GiaoHangNhanh`, `GiaoHangTietKiem`, `Ahamove`. Cách thiết kế nào dưới đây vi phạm OCP?

- **A.** Tạo interface `IShippingCarrier` với hàm `calculateFee(weight, distance)`. Mỗi đơn vị là 1 class riêng.
- **B.** Viết một hàm `calculateShipping(carrierName, weight)` với một chuỗi `switch(carrierName)`.
- **C.** Dùng Map lưu key là tên hãng và value là hàm tính phí tương ứng.

<details>
<summary>👉 Bấm vào đây để xem đáp án</summary>

**Đáp án chính xác: B!** 🎯  
Dùng `switch(carrierName)` đồng nghĩa với việc mỗi lần ký hợp đồng với đơn vị vận chuyển mới (ví dụ: ViettelPost), bạn lại phải mở hàm đó ra thêm `case 'ViettelPost'`, vi phạm nghiêm trọng nguyên tắc Closed for modification!
</details>

---

Tiếp tục khám phá **[Bài 3: L - Liskov Substitution Principle](./03-lsp-liskov-substitution.md)** 🦆!
