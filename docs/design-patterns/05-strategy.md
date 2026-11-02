# 🛵 Strategy Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Đi làm buổi sáng: mưa thì ô tô, tắc đường thì xe ôm, gần thì đi bộ. Đích không đổi, cách đi thay.
> - 🎯 **Dùng khi:** nhiều cách làm cùng một việc, chọn lúc runtime (thanh toán, giảm giá, phí ship).
> - 📁 **Trong project:** đề xuất cho discount (`percentage` / `fixed_amount`) và các kiểu đăng nhập.

---

## 🎪 Câu chuyện vui

Bạn đi từ nhà đến công ty 🏢. Có nhiều **chiến lược** di chuyển:

- 🚗 **Lái xe** – Nhanh nhưng tốn xăng, kẹt xe
- 🚌 **Xe bus** – Rẻ nhưng chậm
- 🏍️ **Xe máy** – Linh hoạt nhưng nguy hiểm
- 🚶 **Đi bộ** – Miễn phí nhưng lâu

Mỗi sáng, bạn **chọn chiến lược** tuỳ tình huống:
- Trời mưa → 🚗 Lái xe
- Hết xăng → 🚌 Xe bus  
- Gần quá → 🚶 Đi bộ

**Điểm đến không đổi, cách đi thay đổi.** Đó là Strategy Pattern.

**Strategy = Chọn "chiến thuật" runtime, thay đổi mà không sửa code.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Nhiều cách thực hiện cùng 1 việc | Chỉ có 1 cách duy nhất |
| Muốn thay đổi algorithm runtime | Logic cố định, không bao giờ đổi |
| Tránh if/else hoặc switch dài | Khi có 2-3 case đơn giản |
| Payment methods, sorting, auth | Over-engineering cho logic nhỏ |

---

## 💻 Code ví dụ

### ❌ Không có Strategy – If/else dài ngoằng

```typescript
// 😱 Thêm payment method = sửa function này!
class PaymentService {
  async pay(method: string, amount: number, orderInfo: any) {
    if (method === 'credit_card') {
      // 50 dòng xử lý credit card...
      const stripe = new Stripe(config.stripeKey)
      const charge = await stripe.charges.create({
        amount,
        currency: 'vnd',
        source: orderInfo.token,
      })
      return charge
    } else if (method === 'momo') {
      // 40 dòng xử lý MoMo...
      const signature = createHmac(...)
      const response = await axios.post('https://momo.vn/api/...')
      return response.data
    } else if (method === 'vnpay') {
      // 60 dòng xử lý VNPay...
    } else if (method === 'zalopay') {
      // 45 dòng xử lý ZaloPay... 
    }
    // Function 200+ dòng, ai dám sửa? 💀
  }
}
```

### ✅ Với Strategy – Mỗi cách thanh toán = 1 class riêng

```typescript
// 📋 Interface – "Hợp đồng" chung cho mọi strategy
interface PaymentStrategy {
  pay(amount: number, orderInfo: any): Promise<PaymentResult>
  refund(transactionId: string): Promise<RefundResult>
  getName(): string
}

// 💳 Strategy 1: Credit Card
class CreditCardPayment implements PaymentStrategy {
  async pay(amount: number, orderInfo: any): Promise<PaymentResult> {
    const stripe = new Stripe(config.stripeKey)
    const charge = await stripe.charges.create({
      amount,
      currency: 'vnd',
      source: orderInfo.token,
    })
    return { success: true, transactionId: charge.id }
  }

  async refund(transactionId: string) {
    return await stripe.refunds.create({ charge: transactionId })
  }

  getName() { return 'Credit Card' }
}

// 📱 Strategy 2: MoMo
class MoMoPayment implements PaymentStrategy {
  async pay(amount: number, orderInfo: any): Promise<PaymentResult> {
    const signature = this.createSignature(amount, orderInfo)
    const response = await axios.post('https://momo.vn/api/...', {
      amount, signature, ...orderInfo
    })
    return { success: true, transactionId: response.data.transId }
  }

  async refund(transactionId: string) { /* ... */ }
  getName() { return 'MoMo' }

  private createSignature(amount: number, info: any) { /* ... */ }
}

// 🏦 Strategy 3: VNPay
class VNPayPayment implements PaymentStrategy {
  async pay(amount: number, orderInfo: any): Promise<PaymentResult> {
    // Logic riêng cho VNPay...
    return { success: true, transactionId: '...' }
  }

  async refund(transactionId: string) { /* ... */ }
  getName() { return 'VNPay' }
}
```

### 🧠 Context – Nơi "chọn chiến lược"

```typescript
class PaymentService {
  // 📦 Map chứa tất cả strategies
  private strategies = new Map<string, PaymentStrategy>()

  constructor() {
    // Đăng ký strategies
    this.strategies.set('credit_card', new CreditCardPayment())
    this.strategies.set('momo', new MoMoPayment())
    this.strategies.set('vnpay', new VNPayPayment())
  }

  // 🎯 Chọn strategy và thực thi
  async processPayment(method: string, amount: number, orderInfo: any) {
    const strategy = this.strategies.get(method)
    if (!strategy) {
      throw new BadRequestError(`Payment method '${method}' not supported`)
    }

    console.log(`Paying with: ${strategy.getName()}`)
    return await strategy.pay(amount, orderInfo)
  }

  // 🔄 Thêm strategy mới runtime!
  registerStrategy(name: string, strategy: PaymentStrategy) {
    this.strategies.set(name, strategy)
  }
}
```

### 🧠 Luồng hoạt động

```
Client: processPayment('momo', 500000, orderInfo)
         │
         ▼
PaymentService:
  strategies.get('momo')
         │
         ▼
  ┌──────────────────┐
  │  MoMoPayment     │ ← Strategy được chọn
  │  .pay(500000, ..)│
  │                  │
  │  createSignature │
  │  axios.post(...) │
  │  return result   │
  └──────────────────┘
         │
         ▼
  { success: true, transactionId: 'MOMO_xxx' }

  // Đổi sang VNPay? Chỉ cần đổi key!
  processPayment('vnpay', 500000, orderInfo)  ← Không sửa gì cả!
```

---

## 🔗 Ứng dụng trong project E-commerce

### Discount Strategy (tiềm năng)

```typescript
// src/features/discount/ có thể áp dụng Strategy cho các loại giảm giá
interface DiscountStrategy {
  calculate(originalPrice: number, discountValue: number): number
}

class PercentageDiscount implements DiscountStrategy {
  calculate(price: number, percent: number) {
    return price * (1 - percent / 100)  // Giảm 20% → price × 0.8
  }
}

class FixedAmountDiscount implements DiscountStrategy {
  calculate(price: number, amount: number) {
    return Math.max(0, price - amount)  // Giảm 50k → price - 50000
  }
}

class BuyXGetYDiscount implements DiscountStrategy {
  calculate(price: number, freeItems: number) {
    // Mua 3 tặng 1 logic...
    return price
  }
}
```

### Auth Strategy

```typescript
// Trong src/features/auth/ – có thể dùng Strategy cho login methods
interface AuthStrategy {
  authenticate(credentials: any): Promise<User>
}

class PasswordAuth implements AuthStrategy { /* ... */ }
class OtpAuth implements AuthStrategy { /* ... */ }
class PasskeyAuth implements AuthStrategy { /* ... */ }  // WebAuthn!
class OAuth2Auth implements AuthStrategy { /* Google, Facebook */ }
```

---

## ⚠️ Cạm bẫy

### 1. 🤯 Client phải biết tất cả strategies
```typescript
// ❌ Client phải biết "momo", "vnpay", "credit_card"...
paymentService.processPayment('momo', amount, info)

// ✅ Giấu đi bằng enum hoặc config
enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  MOMO = 'momo',
  VNPAY = 'vnpay',
}
// hoặc lấy từ database/config
const method = order.paymentMethod  // User đã chọn trên UI
paymentService.processPayment(method, amount, info)
```

### 2. 🧩 Strategy stateful = bug
```typescript
// ❌ Strategy giữ state → share giữa các request = bug!
class MoMoPayment implements PaymentStrategy {
  private lastTransactionId: string  // 😱 State!

  async pay(amount, info) {
    this.lastTransactionId = '...'  // Request A set
    // Request B cũng set → ghi đè! 💥
  }
}

// ✅ Strategy nên stateless
class MoMoPayment implements PaymentStrategy {
  async pay(amount, info) {
    const transactionId = '...'  // Local variable, không share
    return { transactionId }
  }
}
```

### 3. 📦 Quá ít strategies → overengineering
```typescript
// ❌ Chỉ có 1 strategy → tạo interface + class cho vui?
interface HashStrategy {
  hash(password: string): string
}
class BcryptHash implements HashStrategy { ... }
// Chỉ có bcrypt thôi mà! Khi nào thêm argon2 hãy refactor!
```

---

## 📝 Ghi nhớ

> **"Strategy = Đi làm buổi sáng. Mưa ô tô, tắc xe ôm, gần đi bộ. Đích không đổi, cách đi thay."** 🛵
>
> Nhớ 3 thứ:
> 1. **Interface** – hợp đồng chung (mọi strategy đều có `.pay()`)
> 2. **Concrete strategies** – mỗi cách làm = 1 class riêng
> 3. **Context** – nơi chọn và gọi strategy (không biết chi tiết bên trong)

---

## 🎯 Quick Quiz

**Q: Refactor đoạn code sau dùng Strategy Pattern:**
```typescript
function calculateShipping(type: string, weight: number): number {
  if (type === 'standard') return weight * 5000
  if (type === 'express') return weight * 15000 + 30000
  if (type === 'same_day') return weight * 25000 + 50000
  throw new Error('Unknown shipping type')
}
```

<details>
<summary>💡 Đáp án</summary>

```typescript
interface ShippingStrategy {
  calculate(weight: number): number
}

class StandardShipping implements ShippingStrategy {
  calculate(weight: number) { return weight * 5000 }
}

class ExpressShipping implements ShippingStrategy {
  calculate(weight: number) { return weight * 15000 + 30000 }
}

class SameDayShipping implements ShippingStrategy {
  calculate(weight: number) { return weight * 25000 + 50000 }
}

// Sử dụng:
const strategies: Record<string, ShippingStrategy> = {
  standard: new StandardShipping(),
  express: new ExpressShipping(),
  same_day: new SameDayShipping(),
}

function calculateShipping(type: string, weight: number): number {
  const strategy = strategies[type]
  if (!strategy) throw new Error('Unknown shipping type')
  return strategy.calculate(weight)
}
```

Tuy nhiên, với 3 case đơn giản thế này, if/else gốc cũng OK! Chỉ nên refactor khi logic mỗi case **phức tạp** (>10 dòng) hoặc **hay thay đổi**.
</details>

---

[⬅️ Builder](./04-builder.md) | [Về mục lục](./README.md) | [Tiếp: 🔔 Observer/Pub-Sub →](./06-observer-pubsub.md)
