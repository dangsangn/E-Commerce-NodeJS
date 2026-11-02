# 🔌 D - Dependency Inversion Principle (Đảo Ngược Phụ Thuộc)

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Chiếc quạt máy trong phòng bạn 🌪️. Bạn cắm phích cắm quạt vào **ổ điện trên tường** (Chuẩn giao tiếp chung - Interface). Tuyệt đối không ai đi lột vỏ dây điện quạt, trèo lên trần nhà hàn chết dây đồng vào đường dây điện cao thế quốc gia! Nhờ cắm qua ổ điện: mai này quạt hỏng, bạn rút ra cắm quạt mới; hoặc nhà đổi sang máy phát điện, quạt vẫn chạy ngon lành.
> - 🎯 **Định nghĩa chuẩn của Uncle Bob (2 vế bất hủ):**
>   1. *Module cấp cao (High-level) không được phụ thuộc vào module cấp thấp (Low-level). Cả hai phải phụ thuộc vào sự trừu tượng (Abstraction/Interface).*
>   2. *Sự trừu tượng không được phụ thuộc vào chi tiết. Chi tiết phải phụ thuộc vào sự trừu tượng.*
> - 📁 **Trong project:** `src/features/comments/` (Mô hình Clean Architecture), `src/features/upload/services/`

---

## 🎪 Câu chuyện vui: Mối tình "Hàn chết vào nhau" giữa Service và MongoDB

Hãy lắng nghe bi kịch có thật của một Tech Lead tại một sàn thương mại điện tử 🥀:

Vào năm đầu khởi nghiệp, ứng dụng nhỏ, anh em dev viết code rất nhanh và tiện:
Trong file `OrderService.ts`, cứ cần lưu đơn là gõ thẳng:

```typescript
// 😱 Gắn chặt số phận với MongoDB Mongoose
import { OrderModel } from '../dbs/models/order.mongo.model';

export class OrderService {
  async checkout(orderData: any) {
    // Logic nghiệp vụ...
    // Và sau đó lưu thẳng vào Mongoose Model:
    const newOrder = await OrderModel.create(orderData);
    return newOrder;
  }
}
```

Mọi chuyện vẫn êm đẹp cho đến 3 năm sau:
- Công ty phát triển thần tốc, lượng đơn hàng lên tới **10 triệu đơn/tháng**.
- MongoDB bắt đầu hụt hơi khi chạy các truy vấn báo cáo tài chính phức tạp và khóa giao dịch đa bảng.
- Giám đốc Công nghệ (CTO) họp khẩn và ra lệnh:  
  > *"Tháng sau toàn bộ hệ thống Order phải chuyển sang dùng **PostgreSQL** để đảm bảo tính toàn vẹn dữ liệu ACID!"* 🐘🚀

Cả phòng kỹ thuật chết lặng trong sợ hãi... 🥶
Bởi vì:
- `OrderModel` của Mongoose đã xuất hiện ở **85 file service khác nhau**.
- Các câu lệnh đặc thù của Mongo như `.aggregate()`, `$lookup`, `ObjectId` đã ngấm sâu vào từng ngóc ngách của code nghiệp vụ.
- **Không thể thay thế nổi!** Muốn đổi DB, công ty buộc phải đập đi xây lại toàn bộ codebase suốt 6 tháng, tiêu tốn hàng tỷ đồng!

**Tại sao bi kịch này xảy ra?**  
Bởi vì Module nghiệp vụ cấp cao (`OrderService`) đã **quỳ lạy và phụ thuộc trực tiếp vào chi tiết hạ tầng cấp thấp (Thư viện MongoDB Mongoose)**! Khi hạ tầng thay đổi, toàn bộ nghiệp vụ sụp đổ theo!

---

## ❓ Dấu hiệu nhận biết bạn đang "Hàn chết code vào tường"

| 🚩 Mùi code (Code Smell) | 🩺 Căn bệnh tiềm ẩn |
| :---| :---|
| Thấy từ khóa `new ThưViệnNgoạiLai()` nằm bên trong Service | Service tự sinh ra dependency thay vì được "bơm" (inject) từ ngoài vào. |
| Muốn chạy Unit Test mà bắt buộc phải bật MongoDB / Redis | Code bị dính chặt vào DB thật, không thể dùng Mock/Fake để test logic thuần. |
| Thay đổi nhà cung cấp (AWS SES sang SendGrid) làm sửa nát cả Service | Nghiệp vụ gửi mail bị trói chặt vào SDK của một vendor cụ thể. |
| File domain nghiệp vụ import các thư viện của tầng cơ sở dữ liệu | Đảo lộn thứ bậc kiến trúc: Lõi nghiệp vụ lại đi phục vụ công cụ lưu trữ. |

---

## 💻 Code thực chiến: Node.js & TypeScript E-commerce

### ❌ Anti-pattern: NotificationService dính chặt vào AWS SES

```typescript
// 😱 File: NotificationService.ts (Tự tạo SDK cấp thấp trong bụng)
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'; // Low-level SDK

export class NotificationService {
  private sesClient: SESClient;

  constructor() {
    // 💥 TỰ NEW CỤ THỂ: Hàn chết vào AWS!
    this.sesClient = new SESClient({ region: 'ap-southeast-1' });
  }

  async notifyCustomer(email: string, message: string) {
    const command = new SendEmailCommand({
      Destination: { ToAddresses: [email] },
      Message: { Body: { Text: { Data: message } }, Subject: { Data: 'Shop Alert' } },
      Source: 'no-reply@shop.com',
    });

    // Gọi trực tiếp AWS SES
    await this.sesClient.send(command);
  }
}
```

> **Bi kịch ập đến:**
> 1. **Không thể viết Unit Test:** Mỗi lần chạy test là tốn tiền gửi mail thật qua AWS!
> 2. **Không thể đổi nhà mạng:** Sếp bảo: *"AWS đắt quá, tháng này đổi sang **SendGrid** cho rẻ nhé em"* → Phải sửa toác cả file `NotificationService.ts`!

---

### ✅ Refactored: Đảo ngược phụ thuộc bằng Interface & Dependency Injection (DIP)

Áp dụng DIP: **Cả Service và Hạ tầng đều phải nhìn vào một Interface chung!**

#### Bước 1: Tạo bản hợp đồng trừu tượng (Abstraction)
```typescript
// File: IEmailService.ts (Nằm ở tầng Core/Domain - Không phụ thuộc ai!)
export interface IEmailService {
  send(to: string, subject: string, body: string): Promise<boolean>;
}
```

#### Bước 2: Tầng hạ tầng (Low-level) tuân thủ Interface
```typescript
// 1. Triển khai bằng AWS SES
export class AwsSesEmailService implements IEmailService {
  async send(to: string, subject: string, body: string): Promise<boolean> {
    console.log(`[AWS SES] Đang bắn mail tới ${to}...`);
    return true;
  }
}

// 2. Triển khai bằng SendGrid (Dễ dàng thay thế bất kỳ lúc nào!)
export class SendgridEmailService implements IEmailService {
  async send(to: string, subject: string, body: string): Promise<boolean> {
    console.log(`[SendGrid API] Đang gửi mail siêu tốc tới ${to}...`);
    return true;
  }
}

// 3. DÀNH RIÊNG CHO UNIT TEST (Giả lập trong RAM, chạy 0.001 giây, 0 đồng!)
export class MockEmailService implements IEmailService {
  public sentEmails: { to: string; subject: string }[] = [];

  async send(to: string, subject: string, body: string): Promise<boolean> {
    this.sentEmails.push({ to, subject });
    return true; // Giả lập gửi thành công
  }
}
```

#### Bước 3: Tầng nghiệp vụ (High-level) nhận Interface qua Constructor (Dependency Injection)
```typescript
// File: NotificationService.ts (Hoàn toàn độc lập, thanh tao, thoát tục!)
export class NotificationService {
  // 🔌 Ổ cắm điện: Chỉ nhận Interface, KHÔNG QUAN TÂM bên trong là AWS hay SendGrid!
  constructor(private emailService: IEmailService) {}

  async notifyCustomer(email: string, message: string) {
    await this.emailService.send(email, 'Thông báo đơn hàng', message);
  }
}
```

#### 🚀 Điều kỳ diệu xảy ra khi sử dụng:

```typescript
// 1. Chạy trên Production (Dùng AWS):
const prodNotification = new NotificationService(new AwsSesEmailService());
await prodNotification.notifyCustomer('khach@gmail.com', 'Đơn hàng đã tới!');

// 2. Ngày sếp muốn đổi sang SendGrid? CHỈ ĐỔI Ở FILE CONFIG KHỞI ĐỘNG:
const newNotification = new NotificationService(new SendgridEmailService());

// 3. Viết Unit Test cực sướng:
const mockEmail = new MockEmailService();
const testService = new NotificationService(mockEmail);
await testService.notifyCustomer('test@gmail.com', 'Alo');
console.assert(mockEmail.sentEmails.length === 1, 'Test Passed!');
```

> 🎯 **Thắng lợi giòn giã:**  
> Logic nghiệp vụ `NotificationService` không hề thay đổi một chữ nào! Nó không còn bị trói vào bất kỳ nhà mạng nào nữa!

---

## 🔍 Trong project E-commerce này nằm ở đâu?

Hãy mở ngay thư mục siêu sao của project: **`src/features/comments/`**!

Toàn bộ tính năng bình luận được xây dựng theo **Clean Architecture** – hiện thân đỉnh cao của DIP:

```
src/features/comments/
├── domain/
│   └── repositories/
│       └── comment.repository.interface.ts  ← 🔌 ABSTRACTION: Định nghĩa ICommentRepository
│
├── application/
│   └── services/
│       └── comment.service.ts              ← 🧠 HIGH-LEVEL: Chỉ import ICommentRepository!
│                                              constructor(private repo: ICommentRepository) {}
│
└── infrastructure/
    └── repositories/
        └── mongo-comment.repository.ts     ← 🔧 LOW-LEVEL DETAIL: Class Mongoose cụ thể
```

👉 `CommentService` **hoàn toàn không biết MongoDB là cái gì**! Nó chỉ biết nói chuyện với `ICommentRepository`.  
Sau này nếu dự án chuyển sang lưu comment trên Redis Graph hay PostgreSQL, bạn chỉ cần tạo file `postgres-comment.repository.ts` implement interface trên và cắm vào `CommentService` là xong!

---

## ⚠️ Giải ngố tam giác vàng: DIP vs DI vs IoC Container

Rất nhiều bạn đi phỏng vấn hay bị lúng túng giữa 3 khái niệm này:

```
      ┌─────────────────────────────────────────────────────────┐
      │  DIP (Dependency Inversion Principle)                   │
      │  → NGUYÊN TẮC THIẾT KẾ: "Hãy phụ thuộc vào Interface"   │
      └───────────────────────────┬─────────────────────────────┘
                                  │ Thực hiện bằng cách
                                  ▼
      ┌─────────────────────────────────────────────────────────┐
      │  DI (Dependency Injection)                              │
      │  → KỸ THUẬT / MẪU THIẾT KẾ: Truyền object qua           │
      │     constructor: constructor(private repo: IRepo)       │
      └───────────────────────────┬─────────────────────────────┘
                                  │ Tự động hóa bằng
                                  ▼
      ┌─────────────────────────────────────────────────────────┐
      │  IoC Container (Inversion of Control Container)         │
      │  → CÔNG CỤ / THƯ VIỆN: Tự quét và bơm dependency        │
      │     (Ví dụ: InversifyJS, NestJS, Awilix, TypeDI)        │
      └─────────────────────────────────────────────────────────┘
```

> 💡 **Nhớ ngắn gọn:**  
> - **DIP** là tư tưởng (muốn nhà có ổ cắm).
> - **DI** là hành động (lấy dây cắm vào ổ).
> - **IoC Container** là robot tự động cắm dây hộ bạn!

---

## 💡 Câu ghi nhớ nhập tâm

> 🔌 *"Hàn chết bóng đèn vào dây điện tổng là tự sát. Hãy dùng ổ cắm để tự do cắm quạt, cắm sạc hay cắm tivi!"*

---

## 🎯 Quick Quiz: Trùm cuối thử thách!

**Câu hỏi:** Đâu là biểu hiện chuẩn xác nhất của việc tuân thủ Dependency Inversion Principle (DIP)?

- **A.** Sử dụng framework NestJS vì nó có sẵn `@Injectable()`.
- **B.** Class nghiệp vụ `AuthService` nhận một Interface `ITokenGenerator` qua constructor thay vì trực tiếp `import jwt from 'jsonwebtoken'` và gọi `jwt.sign()`.
- **C.** Tách class lớn thành 10 class nhỏ.

<details>
<summary>👉 Bấm vào đây để xem đáp án</summary>

**Đáp án chính xác: B!** 🏆  
DIP không phụ thuộc vào framework (dùng Express hay NestJS đều làm được DIP). Việc `AuthService` giao tiếp qua interface `ITokenGenerator` giúp ta tự do chuyển đổi giữa JWT, PASETO hay Mock Token trong Unit Test mà không sửa code nghiệp vụ!
</details>

---

Ôn lại toàn bộ bí kíp với **[🧭 99. SOLID Cheat Sheet & Bác Sĩ Bắt Bệnh Code](./99-solid-cheat-sheet.md)** 🚀!
