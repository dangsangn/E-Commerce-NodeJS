# 🔔 Observer / Pub-Sub Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Bấm 🔔 kênh YouTube của Sơn Tùng. Có video mới là điện thoại tự báo, khỏi F5 mỗi ngày.
> - 🎯 **Dùng khi:** làm xong một việc, nhiều nơi khác cần biết (gửi mail, ghi log, xoá cache...).
> - 📁 **Trong project:** `src/services/pubsub.service.ts` (Redis Pub/Sub)

---

## 🎪 Câu chuyện vui

Bạn là fan **Sơn Tùng MTP** 🎤.

### ❌ Không có Observer (Polling)
Mỗi ngày bạn lên YouTube kiểm tra: *"Sơn Tùng đăng video mới chưa?"*
- Thứ 2: Chưa có 😞
- Thứ 3: Chưa có 😞
- Thứ 4: Chưa có 😞
- ...
- 6 tháng sau: VẪN CHƯA CÓ 😭 (và bạn đã check 180 lần vô ích)

### ✅ Có Observer (Subscribe)
Bạn bấm nút **Subscribe** 🔔 → YouTube **tự thông báo** khi có video mới.
- Bạn không cần kiểm tra.
- 100 triệu subscriber cũng nhận thông báo cùng lúc.
- Bạn có thể **Unsubscribe** bất cứ lúc nào.

**Observer = Hệ thống Subscribe/Notify. Publisher đăng → tất cả Subscriber nhận.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Event system (emit/on) | Giao tiếp 1-1 đơn giản |
| Notification system | Khi cần response đồng bộ |
| Real-time updates (WebSocket) | Logic tuần tự, không cần decouple |
| Decouple modules (loose coupling) | Khi debug khó vì event "bay" lung tung |
| Message queue (Redis PubSub, Kafka) | Khi có quá nhiều event không ai quản lý |

---

## 💻 Code ví dụ

### Observer cơ bản – Tự implement

```typescript
// 📺 Subject (Publisher) – "YouTube Channel"
class EventEmitter {
  private listeners = new Map<string, Set<Function>>()

  // 🔔 Subscribe – "Bấm chuông"
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    console.log(`[Sub] Subscribed to "${event}"`)
  }

  // 🔕 Unsubscribe – "Bỏ theo dõi"
  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback)
  }

  // 📢 Publish – "Đăng video mới"
  emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event)
    if (!callbacks) return

    console.log(`[Pub] Emitting "${event}" to ${callbacks.size} listeners`)
    callbacks.forEach(cb => cb(data))
  }
}
```

### 🧠 Sử dụng

```typescript
const eventBus = new EventEmitter()

// 👤 Subscriber 1: Gửi email xác nhận
eventBus.on('order:created', (order) => {
  console.log(`📧 Sending confirmation email for order ${order.id}`)
  EmailService.sendOrderConfirmation(order)
})

// 👤 Subscriber 2: Trừ tồn kho
eventBus.on('order:created', (order) => {
  console.log(`📦 Reducing stock for order ${order.id}`)
  InventoryService.reduceStock(order.items)
})

// 👤 Subscriber 3: Thông báo shop
eventBus.on('order:created', (order) => {
  console.log(`🔔 Notifying shop about order ${order.id}`)
  NotificationService.notifyShop(order.shopId, order)
})

// 📢 Publisher: Khi có đơn hàng mới
function createOrder(orderData: any) {
  const order = OrderModel.create(orderData)

  // 1 dòng emit → 3 subscriber tự chạy!
  eventBus.emit('order:created', order)

  return order
}
```

### 🧠 Luồng hoạt động

```
createOrder() → eventBus.emit('order:created', order)
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
     📧 Email   📦 Stock   🔔 Notify
     Service    Service    Service

  Thêm analytics? Chỉ cần thêm 1 subscriber!
  eventBus.on('order:created', (order) => {
    AnalyticsService.trackPurchase(order)  // ← Không sửa createOrder()!
  })
```

---

## 🔗 Chỗ nào dùng trong project?

### 📁 `src/services/pubsub.service.ts` – Redis Pub/Sub

```typescript
class PubSubService {
  // 📢 Publisher
  async publish(channel: string, message: any) {
    const payload = typeof message === 'string'
      ? message
      : JSON.stringify(message)
    await pubClient.publish(channel, payload)
    console.log(`[Pub] Publish message ${payload} to channel ${channel}`)
  }

  // 🔔 Subscriber
  async subscribe(channel: string, callback: (message: string) => void) {
    await subClient.subscribe(channel, (message: string) => {
      console.log(`[Sub] Receive message ${message} from channel ${channel}`)
      callback(message)
    })
    console.log(`[Sub] Subscribed to channel: ${channel}`)
  }
}

export default new PubSubService()
```

### Cách dùng trong project:

```typescript
import pubsubService from '@/services/pubsub.service'

// Service A: Publish khi có sản phẩm mới
await pubsubService.publish('product:created', {
  productId: '123',
  shopId: '456',
})

// Service B: Subscribe để cập nhật search index
await pubsubService.subscribe('product:created', (message) => {
  const product = JSON.parse(message)
  ElasticsearchService.indexProduct(product)
})
```

---

## 🤔 Observer vs Pub/Sub – Khác nhau chỗ nào?

```
Observer (Direct):              Pub/Sub (Through Broker):

┌──────────┐                   ┌──────────┐
│ Subject  │──notify──▶│Obs A│ │Publisher │
│(YouTube) │──notify──▶│Obs B│ │  (Shop)  │
│          │──notify──▶│Obs C│ └────┬─────┘
└──────────┘                        │ publish
  Subject BIẾT observers            ▼
                              ┌──────────┐
                              │  Broker  │ ← Redis, Kafka, RabbitMQ
                              │(Bưu điện)│
                              └─┬───┬──┬─┘
                                │   │  │ deliver
                              ┌─▼─┐│┌─▼─┐
                              │Sub││││Sub│
                              │ A │││ C │
                              └───┘│└───┘
                              ┌───▼┐
                              │Sub │
                              │ B  │
                              └────┘
                          Publisher KHÔNG BIẾT subscribers
                          → Loose coupling hơn!
```

| | Observer | Pub/Sub |
|---|---|---|
| **Coupling** | Subject biết observers | Publisher không biết subscribers |
| **Broker** | Không cần | Cần (Redis, Kafka, RabbitMQ) |
| **Scale** | Trong 1 process | Across processes/services |
| **Ví dụ** | EventEmitter, DOM events | Redis PubSub, Kafka |

---

## ⚠️ Cạm bẫy

### 1. 🌀 Event storm – Quá nhiều event
```typescript
// ❌ Event gọi event → vòng lặp vô hạn!
eventBus.on('user:updated', (user) => {
  user.lastModified = new Date()
  UserModel.save(user)          // Trigger 'user:updated' → lặp! 💀
})

// ✅ Tách rõ event, tránh circular
eventBus.on('user:profile_changed', (user) => {
  // Chỉ update lastModified, KHÔNG emit thêm event
  UserModel.updateOne({ _id: user.id }, { lastModified: new Date() })
})
```

### 2. 🐛 Debug khó – "Event bay đi đâu?"
```typescript
// emit ở file A, subscribe ở file B, C, D...
// Khi bug xảy ra, tìm ai đang listen event "order:created"?

// ✅ Fix: Centralize event registration
// events/order.events.ts
export function registerOrderEvents(eventBus: EventEmitter) {
  eventBus.on('order:created', handleOrderEmail)     // ← Rõ ràng
  eventBus.on('order:created', handleOrderStock)     // ← 1 file
  eventBus.on('order:created', handleOrderAnalytics) // ← dễ tìm
}
```

### 3. 🔇 Subscriber lỗi → ảnh hưởng cả hệ thống
```typescript
// ❌ 1 subscriber throw → các subscriber sau không chạy!
eventBus.on('order:created', () => {
  throw new Error('Email service down!')  // 💥 Boom!
})
eventBus.on('order:created', () => {
  // Cái này KHÔNG BAO GIỜ CHẠY 😱
  inventoryService.reduceStock(...)
})

// ✅ Wrap mỗi subscriber trong try/catch
emit(event: string, data?: any) {
  this.listeners.get(event)?.forEach(cb => {
    try {
      cb(data)
    } catch (error) {
      logger.error(`Error in listener for "${event}"`, { error })
      // Tiếp tục chạy subscriber khác!
    }
  })
}
```

---

## 📝 Ghi nhớ

> **"Observer = YouTube Subscribe. Bấm 🔔 một lần, nhận thông báo mãi mãi."**
>
> Nhớ 3 vai:
> 1. **Publisher** (Subject) – "YouTuber" đăng video
> 2. **Subscriber** (Observer) – "Fan" nhận thông báo
> 3. **Event/Channel** – "Chuông thông báo" kết nối 2 bên

---

## 🎯 Quick Quiz

**Q: Đoạn code Express này dùng Observer pattern ở đâu?**
```typescript
app.on('error', (err) => console.error(err))
process.on('unhandledRejection', (reason) => console.error(reason))
```

<details>
<summary>💡 Đáp án</summary>

**Cả 2 đều là Observer!** 🎉

- `app.on('error', ...)` – Express app là EventEmitter, `.on()` = subscribe
- `process.on('unhandledRejection', ...)` – Node.js process cũng là EventEmitter

Node.js được xây dựng **xung quanh Observer pattern**! `EventEmitter` là class cơ bản:
- `fs.createReadStream()` emit `data`, `end`, `error` events
- `http.Server` emit `request`, `connection` events
- `process` emit `exit`, `uncaughtException` events

Bạn đã dùng Observer mỗi ngày mà không biết! 😄
</details>

---

[⬅️ Strategy](./05-strategy.md) | [Về mục lục](./README.md) | [Tiếp: ✈️ Middleware/Chain →](./07-middleware-chain.md)
