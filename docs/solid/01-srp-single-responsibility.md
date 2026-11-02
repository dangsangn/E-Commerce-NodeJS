# 🔪 S - Single Responsibility Principle (Đơn Trách Nhiệm)

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Con dao đa năng Thụy Sĩ (Swiss Army Knife) 50 món: vừa khui bia, nhổ lông mày, cưa gỗ, bấm móng tay, gọt táo. Kết quả: gọt táo dính mùi bia, cưa cành cây thì gãy cán, cắt móng tay thì chảy máu! Bộ dao bếp chuyên dụng con nào làm việc nấy mới là đỉnh cao.
> - 🎯 **Định nghĩa chuẩn của Bác Bob (Uncle Bob):** *"A class should have one, and only one, reason to change."* (Một class chỉ nên có một, và chỉ một lý do để thay đổi).
> - 📁 **Trong project:** `src/features/checkout/`, `src/features/comments/application/`, `src/middlewares/`

---

## 🎪 Câu chuyện vui: Đêm kinh hoàng của chàng Dev và `OrderService`

Hãy tưởng tượng bạn là lập trình viên duy nhất trực ca đêm. Lúc 2 giờ sáng, chị Trưởng phòng Marketing nhắn tin gấp:

> *"Em ơi, mai là Valentine 14/2, em sửa giúp chị tiêu đề email gửi cho khách thành: '🌹 Đơn hàng Valentine ngọt ngào đã được đặt thành công' nhé! Chịu khó tí nha!"*

Bạn ngáp ngủ, mở file `OrderService.ts` lên. File này dài **1.800 dòng**, làm tất cả mọi thứ trên đời:
1. Nhận request từ giỏ hàng
2. Tính toán tiền hàng, mã giảm giá
3. Trừ số lượng trong kho MongoDB
4. Gọi API thanh toán Stripe
5. Tạo chuỗi HTML gửi email cho khách
6. Ghi log ra file trên đĩa cứng

Mắt nhắm mắt mở, bạn tìm đến đoạn gửi email, sửa lại câu chữ. Vô tình tay quẹt trúng bàn phím, bạn xóa nhầm một dấu ngoặc nhọn `{` ở logic tính toán tiền giảm giá ngay bên trên.

Bạn gõ `git commit -m "fix email copy" && git push`, server tự động deploy.

Sáng hôm sau thức dậy, công ty nhận được **50.000 đơn đặt hàng**. Nhưng thay vì ăn mừng, sếp vào phòng túm cổ bạn:
- Email gửi đi rất ngọt ngào 🌹.
- Nhưng vì lỗi tính giá, **tất cả iPhone 16 Pro Max đều được áp dụng mã giảm giá 100% (0 VNĐ)**. Công ty bốc hơi 50 tỷ chỉ sau một đêm! 💸💀

**Tại sao bi kịch này xảy ra?**  
Bởi vì việc **đổi giao diện Email (Marketing)** và việc **tính toán tiền hàng (Kế toán/Tài chính)** lại đang sống chung trong một mái nhà `OrderService`! Khi Marketing hắt hơi, Kế toán lăn ra đột quỵ!

---

## ❓ Khi nào biết mình đang vi phạm SRP?

Hãy nhìn vào bảng "Bắt bệnh" dưới đây:

| 🚩 Triệu chứng "Code có mùi" | 🩺 Bệnh lý thực tế |
| :---| :---|
| File dài hơn **300 - 500 dòng** | Bạn đang tạo ra một "God Class" (Class Thần Thánh ôm cả vũ trụ). |
| Tên class có từ: `Manager`, `Processor`, `Helper`, `DoAll` | Tên mơ hồ vì chính tác giả cũng không biết nó làm những cái gì. |
| Có hơn **3 phòng ban** yêu cầu bạn sửa cùng một file | Marketing đòi đổi text, Kế toán đòi đổi thuế, Kho đòi đổi trừ tồn... |
| Class import tới **20 dependencies** khác nhau | DB, Stripe, Nodemailer, Redis, S3, Winston... tất cả tụ họp một chỗ. |
| Test file dài gấp 5 lần file code, mock tới 15 thư viện | Muốn test 1 hàm nhỏ mà phải mock cả hệ thống thanh toán và email. |

---

## 💻 Code thực chiến: Node.js & TypeScript

### ❌ Anti-pattern: Gã "Bốc vác toàn năng" `OrderService`

```typescript
// 😱 File: OrderService.ts (Ôm đồm từ A đến Z)
import { db } from '../dbs/mongo';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import fs from 'fs';

export class OrderService {
  private stripe = new Stripe('sk_test_...');

  async createOrder(userId: string, cartItems: any[]) {
    // 1. Tính toán giá tiền (Nghiệp vụ Tài chính)
    let total = 0;
    for (const item of cartItems) {
      total += item.price * item.quantity;
    }
    const tax = total * 0.1;
    const finalAmount = total + tax;

    // 2. Trừ tồn kho (Nghiệp vụ Quản lý Kho)
    for (const item of cartItems) {
      await db.collection('inventories').updateOne(
        { productId: item.productId },
        { $inc: { stock: -item.quantity } }
      );
    }

    // 3. Quẹt thẻ thanh toán (Nghiệp vụ Cổng thanh toán)
    const charge = await this.stripe.charges.create({
      amount: finalAmount * 100,
      currency: 'vnd',
      source: 'tok_visa',
    });

    // 4. Lưu vào Database (Nghiệp vụ Lưu trữ)
    const order = await db.collection('orders').insertOne({
      userId,
      items: cartItems,
      amount: finalAmount,
      stripeChargeId: charge.id,
      createdAt: new Date(),
    });

    // 5. Gửi email xác nhận (Nghiệp vụ CSKH / Marketing)
    const transporter = nodemailer.createTransport({ /* config */ });
    await transporter.sendMail({
      to: 'customer@gmail.com',
      subject: 'Đơn hàng thành công',
      html: `<h1>Cảm ơn bạn đã mua hàng với giá ${finalAmount}!</h1>`,
    });

    // 6. Ghi log ra file (Nghiệp vụ Hạ tầng / System)
    fs.appendFileSync('orders.log', `Order ${order.insertedId} created at ${new Date()}\n`);

    return order;
  }
}
```

> **Hậu quả:** 
> - Muốn đổi từ Stripe sang VNPay? Vào đây sửa.
> - Muốn đổi Nodemailer sang SendGrid? Vào đây sửa.
> - Muốn đổi MongoDB sang PostgreSQL? Vào đây sửa.
> - Càng nhiều người sửa, conflict git triền miên, bug đẻ ra bug!

---

### ✅ Refactored: Mỗi hiệp sĩ một nhiệm vụ (Chuẩn SRP)

Ta băm nhỏ nhiệm vụ ra thành các Service độc lập, mỗi class chỉ lo đúng chuyên môn của mình:

```typescript
// 1. Chuyên gia tính giá và điều phối đơn hàng
export class PricingService {
  calculateTotal(items: { price: number; quantity: number }[]): number {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.1;
    return subtotal + tax;
  }
}

// 2. Chuyên gia trừ kho
export class InventoryService {
  async deductStock(items: { productId: string; quantity: number }[]): Promise<void> {
    // Chỉ lo trừ kho, kiểm tra tồn kho
  }
}

// 3. Chuyên gia quẹt thẻ
export class PaymentProcessor {
  async charge(amount: number, token: string): Promise<string> {
    // Chỉ lo gọi Stripe/Paypal, không quan tâm giỏ hàng có gì
    return 'charge_id_123';
  }
}

// 4. Chuyên gia thư từ / thông báo
export class OrderNotificationService {
  async sendOrderConfirmation(customerEmail: string, orderId: string, amount: number): Promise<void> {
    // Chỉ lo format HTML, gửi mail/SMS, Marketing muốn sửa chữ thì vào đây!
  }
}

// 5. Nhạc trưởng (OrderService): Chỉ đóng vai trò điều phối luồng!
export class OrderService {
  constructor(
    private pricingService: PricingService,
    private inventoryService: InventoryService,
    private paymentProcessor: PaymentProcessor,
    private orderRepo: OrderRepository,
    private notifier: OrderNotificationService
  ) {}

  async createOrder(userId: string, cartItems: any[]) {
    const totalAmount = this.pricingService.calculateTotal(cartItems);

    await this.inventoryService.deductStock(cartItems);
    const paymentId = await this.paymentProcessor.charge(totalAmount, 'tok_visa');
    
    const order = await this.orderRepo.save({
      userId,
      items: cartItems,
      amount: totalAmount,
      paymentId,
    });

    // Bắn thông báo (bất đồng bộ, lỗi mail cũng không làm hủy đơn hàng)
    this.notifier.sendOrderConfirmation('customer@gmail.com', order.id, totalAmount).catch(console.error);

    return order;
  }
}
```

> 🎯 **Kết quả tuyệt vời:**
> - Marketing muốn đổi template email? Chỉ sửa `OrderNotificationService`. Tiền bạc và kho hàng an toàn 100%!
> - Kế toán đổi cách tính thuế? Chỉ sửa `PricingService`.
> - Viết Unit Test cho `PricingService` siêu dễ: truyền mảng items vào là test được ngay, không cần kết nối DB hay mock Stripe!

---

## 🔍 Trong project E-commerce này nằm ở đâu?

1. **`src/features/comments/` (Mô hình Clean Architecture chuẩn mực):**
   - `domain/`: Chỉ chứa thực thể Comment và logic thuần túy (không dính dáng DB).
   - `application/use-cases/`: Mỗi use case là 1 file riêng (`create-comment.use-case.ts`, `reply-comment.use-case.ts`).
   - `infrastructure/`: Chỉ lo việc truy vấn MongoDB.
2. **`src/middlewares/`:**
   - `authentication.middleware.ts`: Chỉ lo kiểm tra Token và xác thực danh tính.
   - `rbac.middleware.ts`: Chỉ lo kiểm tra quyền (Permission).
   - Tuyệt đối không có chuyện 1 middleware vừa check token vừa query tồn kho sản phẩm!

---

## ⚠️ Cạm bẫy cần tránh (Đừng hóa thành "Kẻ cuồng tín SRP")

> 🚨 **Over-engineering (Băm code thành vụn bánh mì):**  
> SRP không có nghĩa là mỗi hàm phải là một class, hay một class chỉ được dài 5 dòng!  
> Đừng tạo ra các class quái đản như: `AddTwoNumbersService`, `StringCapitalizeService`. Gom các hành vi phục vụ **cùng một trách nhiệm và cùng một lý do thay đổi** vào chung một nơi là hoàn toàn chuẩn xác.

---

## 💡 Câu ghi nhớ nhập tâm

> 🥋 *"Một thợ làm bánh giỏi không đi sửa đường ống nước. Một class chỉ đổi khi đúng một phòng ban thay đổi yêu cầu!"*

---

## 🎯 Quick Quiz: Thử tài bắt bệnh!

**Câu hỏi:** Đoạn code sau đây của bạn đồng nghiệp có vi phạm SRP không? Vì sao?

```typescript
class User {
  constructor(public name: string, public email: string) {}

  validateEmail(): boolean {
    return this.email.includes('@');
  }

  saveToDatabase(): Promise<void> {
    return db.query(`INSERT INTO users VALUES ('${this.name}', '${this.email}')`);
  }

  sendWelcomeEmail(): Promise<void> {
    return emailClient.send(this.email, 'Welcome to Shop!');
  }
}
```

<details>
<summary>👉 Bấm vào đây để xem đáp án</summary>

**Đáp án: VI PHẠM NẶNG NỀ!** 💣  
Class `User` đang gánh tới 3 trách nhiệm:
1. **Nghiệp vụ Entity / Validation:** Quản lý dữ liệu người dùng (`validateEmail`).
2. **Lưu trữ dữ liệu (Persistence):** Trực tiếp viết câu SQL insert vào Database (`saveToDatabase`).
3. **Giao tiếp bên ngoài (Notification):** Gọi `emailClient` để gửi mail (`sendWelcomeEmail`).

👉 **Cách sửa:** Giữ `User` là pure entity, tách việc lưu trữ sang `UserRepository`, tách việc gửi mail sang `UserMailer` hoặc `NotificationService`!
</details>

---

Tiếp tục hành trình với **[Bài 2: O - Open/Closed Principle](./02-ocp-open-closed.md)** 🚀!
