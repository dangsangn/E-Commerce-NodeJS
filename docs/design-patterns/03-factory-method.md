# 🍕 Factory Method Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Chuỗi pizza: tổng công ty ra quy trình, mỗi chi nhánh tự *nướng ra* chiếc pizza của mình.
> - 🎯 **Dùng khi:** class cha có quy trình chung, nhưng bước *tạo object* thì mỗi class con một kiểu.
> - 📁 **Trong project:** `src/design_patterns/method.factory.pattern.ts` (bản học)

---

## 🎪 Câu chuyện vui

Bạn là CEO của chuỗi **pizza toàn cầu** 🍕.

- Quy trình chung: Nhào bột → Thêm topping → Nướng → Đóng hộp
- Nhưng **chi nhánh Việt Nam** dùng topping bún chả 🇻🇳
- **Chi nhánh Nhật** dùng topping takoyaki 🇯🇵
- **Chi nhánh Ý** dùng topping truyền thống 🇮🇹

CEO **không cần biết** mỗi chi nhánh dùng topping gì. CEO chỉ nói: *"Làm pizza đi!"*. Mỗi chi nhánh (subclass) **tự quyết** tạo loại pizza nào.

**Factory Method = CEO ra lệnh, chi nhánh tự chọn cách làm.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Khi subclass cần tự quyết tạo object nào | Khi chỉ có 1-2 loại đơn giản |
| Muốn mở rộng mà không sửa code cũ (OCP) | Khi không có inheritance hierarchy |
| Framework/library để user extend | Khi Simple Factory đã đủ |
| Khi có quy trình chung nhưng "nguyên liệu" khác | Over-engineering cho app nhỏ |

---

## 💻 Code ví dụ

### So sánh: Simple Factory vs Factory Method

```
Simple Factory:                    Factory Method:
┌─────────────────┐               ┌─────────────────┐
│  Factory        │               │  BaseFactory     │ ← Abstract
│  (1 class)      │               │  getTransport()  │ ← Template
│                 │               └────────┬─────────┘
│  switch(type):  │                   ┌────┴────┐
│   car → Car     │                   │         │
│   truck → Truck │            ┌──────┴──┐  ┌──┴───────┐
└─────────────────┘            │CarFactory│  │TruckFact.│
                               │→ new Car │  │→ new Truck│
Thêm loại = sửa switch        └─────────┘  └──────────┘
                               Thêm loại = thêm class mới ✅
```

### ✅ Factory Method trong project

```typescript
// 🏛️ Class cha – định nghĩa "quy trình" nhưng KHÔNG biết tạo xe gì
export class ServiceLogistic {
  transportClass: any  // ← Subclass sẽ gán loại xe cụ thể

  // "Quy trình" chung – gọi transportClass mà không biết nó là gì
  getTransport = (customerInfo: Object) => {
    return new this.transportClass(customerInfo)
  }
}

// 🚗 "Chi nhánh" xe hơi
class Car {
  name?: string
  price?: number
  customerInfo?: Object

  constructor({ name = 'Car', price = 1000, customerInfo = {} }) {
    this.name = name
    this.price = price
    this.customerInfo = customerInfo
  }
}

// 🚛 "Chi nhánh" xe tải
class Truck {
  name?: string
  price?: number
  customerInfo?: Object

  constructor({ name = 'Truck', price = 10000, customerInfo = {} }) {
    this.name = name
    this.price = price
    this.customerInfo = customerInfo
  }
}

// Mỗi subclass TỰ CHỌN loại xe
class CarServiceLogistic extends ServiceLogistic {
  transportClass = Car     // ← "Chi nhánh này bán xe hơi"
}

class TruckServiceLogistic extends ServiceLogistic {
  transportClass = Truck   // ← "Chi nhánh này bán xe tải"
}
```

### 🧠 Sử dụng

```typescript
const carService = new CarServiceLogistic()
const truckService = new TruckServiceLogistic()

// Cùng gọi getTransport() – nhưng kết quả khác nhau!
carService.getTransport({ name: 'Sang' })
// → Car { name: 'Car', price: 1000, customerInfo: { name: 'Sang' } }

truckService.getTransport({ name: 'Sang' })
// → Truck { name: 'Truck', price: 10000, customerInfo: { name: 'Sang' } }
```

### 🧠 Luồng hoạt động

```
carService.getTransport(info)
  │
  ▼
ServiceLogistic.getTransport()
  │
  │  return new this.transportClass(info)
  │                │
  │   this = CarServiceLogistic
  │   this.transportClass = Car  ← Subclass quyết định!
  │                │
  ▼                ▼
         new Car(info) → Car instance 🚗
```

---

## 🔗 Chỗ nào dùng trong project?

📁 **`src/design_patterns/method.factory.pattern.ts`**

Project đã có sẵn ví dụ:
```typescript
const carServiceLogistic = new CarServiceLogistic()
console.log(carServiceLogistic.getTransport({
  customerInfo: { name: 'Sang 1' }
}))
// 🚗 Car { name: 'Car', price: 1000, customerInfo: { name: 'Sang 1' } }
```

### 💡 Ứng dụng thực tế trong E-commerce

```typescript
// Notification system – mỗi channel tự tạo message riêng
abstract class NotificationService {
  // Template method – quy trình chung
  async send(userId: string, data: any) {
    const message = this.createMessage(data)   // ← Factory method
    await this.deliver(message)
    await this.log(userId, message)
  }

  abstract createMessage(data: any): Message   // ← Subclass tự định nghĩa
  abstract deliver(message: Message): Promise<void>
}

class EmailNotificationService extends NotificationService {
  createMessage(data: any): Message {
    return new EmailMessage(data.subject, data.body)  // ← Tạo email
  }
  async deliver(msg: Message) { /* gửi email */ }
}

class SmsNotificationService extends NotificationService {
  createMessage(data: any): Message {
    return new SmsMessage(data.phone, data.text)  // ← Tạo SMS
  }
  async deliver(msg: Message) { /* gửi SMS */ }
}

// Thêm Push notification? Chỉ cần thêm 1 class mới!
// Không sửa code cũ! ✅ Open/Closed Principle
```

---

## ⚠️ Cạm bẫy

### 1. 🏗️ Over-engineering
```typescript
// ❌ Chỉ có 1 loại → đừng dùng Factory Method
abstract class PaymentFactory {
  abstract createPayment(): Payment
}
class StripePaymentFactory extends PaymentFactory {
  createPayment() { return new StripePayment() }
}
// Chỉ có Stripe thôi mà tạo 2 class? → Simple Factory đủ rồi!

// ✅ Dùng khi THẬT SỰ có nhiều loại và sẽ mở rộng
```

### 2. 🔀 Nhầm với Simple Factory
```typescript
// Simple Factory: 1 class, switch/case bên trong
class Factory {
  static create(type: string) {  // ← Static method
    switch(type) { ... }
  }
}

// Factory Method: nhiều class, subclass tự quyết
abstract class Factory {
  abstract create(): Product    // ← Abstract method
}
class ConcreteFactory extends Factory {
  create() { return new ConcreteProduct() }  // ← Subclass override
}
```

---

## 📝 Ghi nhớ

> **"Factory Method = Chuỗi pizza. CEO ra quy trình, chi nhánh tự chọn topping."** 🍕
>
> Nhớ 3 thứ:
> 1. **Abstract class** – "CEO/công ty mẹ" (có quy trình, không có chi tiết)
> 2. **Concrete subclass** – "chi nhánh" (override để tạo product cụ thể)
> 3. **Thêm loại = thêm class** – không sửa code cũ (Open/Closed ✅)

---

## 🎯 Quick Quiz

**Q: Khi nào nên "nâng cấp" từ Simple Factory lên Factory Method?**

<details>
<summary>💡 Đáp án</summary>

Khi bạn thấy **3 dấu hiệu**:

1. **Switch/case ngày càng dài** → Mỗi case nên là 1 class riêng
2. **Mỗi loại product có logic tạo phức tạp riêng** → Không nên nhồi vào 1 method
3. **Bạn muốn người khác extend mà không sửa code gốc** → Framework design

Nếu chỉ có 2-3 loại đơn giản và ít thay đổi → Simple Factory ngon hơn!
</details>

---

[⬅️ Simple Factory](./02-simple-factory.md) | [Về mục lục](./README.md) | [Tiếp: 🥪 Builder →](./04-builder.md)
