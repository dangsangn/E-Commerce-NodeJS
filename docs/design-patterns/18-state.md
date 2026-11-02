# 🚂 State Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Chuyến tàu chạy qua từng ga: pending → confirmed → shipping → delivered. Ga nào luật nấy, không nhảy cóc.
> - 🎯 **Dùng khi:** object có vòng đời rõ ràng, và chuyển sai trạng thái là mất tiền.
> - 📁 **Trong project:** `ORDER_STATUS` trong `src/features/order/` (mới có luật pending → cancelled)

---

## 🎪 Câu chuyện vui

Đơn hàng Shopee của bạn là một **chuyến tàu** 🚂 chạy qua các ga:

```
 🕐 pending ──▶ ✅ confirmed ──▶ 🚚 shipping ──▶ 📦 delivered
     │              │
     ▼              ▼
 ❌ cancelled   ❌ cancelled
```

Mỗi ga có **luật riêng**:
- Ở ga 🕐 *pending*: hủy thoải mái
- Ở ga 🚚 *shipping*: hủy? Hàng đang trên xe rồi bạn ơi 🙅
- Ở ga 📦 *delivered*: hết đường, chỉ còn đổi trả

Cùng một nút **"Hủy đơn"**, nhưng kết quả **phụ thuộc đơn đang ở ga nào**.

**State = Hành vi của object thay đổi theo trạng thái hiện tại, và trạng thái chỉ được chuyển theo những đường cho phép.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Object có vòng đời rõ ràng (đơn hàng, thanh toán, vé, ticket hỗ trợ) | Chỉ có 2 trạng thái bật/tắt → `boolean` là đủ |
| Thấy `if (status === ...)` rải khắp các service | Trạng thái không ràng buộc nhau, nhảy tự do |
| Chuyển sai trạng thái = mất tiền/mất hàng | |
| Cần trả lời nhanh "từ X đi được tới đâu?" | |

---

## 💻 Code ví dụ

### ❌ Không có State – `if` mọc như nấm sau mưa

```typescript
async cancel(order) {
  if (order.status !== 'pending') throw new Error('Cannot cancel')
  // ...
}

async confirm(order) {
  if (order.status !== 'pending') throw new Error('Cannot confirm')
  // ...
}

async ship(order) {
  if (order.status !== 'confirmed') throw new Error('Cannot ship')
  // ...
}

async markDelivered(order) {
  if (order.status === 'cancelled' || order.status === 'pending' /* ...quên 'failed' */) {
    throw new Error('...')
  }
  // 😱 Ai biết toàn bộ luật? Không ai. Luật nằm rải rác 4 file.
}
```

### ✅ Cách 1 – Bảng chuyển trạng thái (nhẹ, đủ dùng 90% trường hợp)

```typescript
// 🗺️ TOÀN BỘ luật chơi nằm trong MỘT object, nhìn là hiểu
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:   ['confirmed', 'cancelled', 'failed'],
  confirmed: ['shipping', 'cancelled'],
  shipping:  ['delivered', 'failed'],
  delivered: [],   // 🏁 ga cuối
  cancelled: [],   // 🏁 ga cuối
  failed:    [],   // 🏁 ga cuối
}

function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!ORDER_TRANSITIONS[from].includes(to)) {
    throw new BadRequestError(`Cannot move order from "${from}" to "${to}"`)
  }
}

// Dùng:
assertTransition(order.order_status, 'cancelled')  // pending → cancelled ✅
assertTransition('shipping', 'cancelled')          // 💥 BadRequestError
```

### ✅ Cách 2 – State class đầy đủ (khi mỗi trạng thái có *hành vi* riêng)

```typescript
interface OrderState {
  cancel(order: Order): Promise<void>
  ship(order: Order): Promise<void>
}

class PendingState implements OrderState {
  async cancel(order) {
    await releaseInventory(order)     // trả hàng về kho
    order.setState(new CancelledState())
  }
  async ship() { throw new BadRequestError('Confirm the order first') }
}

class ShippingState implements OrderState {
  async cancel() { throw new BadRequestError('Already on the truck 🚚') }
  async ship() { throw new BadRequestError('Already shipping') }
}

// Service không còn if/else, chỉ "hỏi" trạng thái hiện tại
await order.state.cancel(order)
```

```
Cách 1 (bảng):  "Được đi đâu?"           → luật chuyển ga
Cách 2 (class): "Ở ga này thì LÀM gì?"   → hành vi riêng mỗi ga
```

> 💡 Bắt đầu bằng **Cách 1**. Chỉ lên **Cách 2** khi mỗi trạng thái bắt đầu có logic riêng dài vài chục dòng.

---

## 🔗 Chỗ nào dùng trong project?

### 📁 `src/features/order/model/index.ts` – Danh sách các "ga"

```typescript
export const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPING: 'shipping',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
})
```

### 📁 `src/features/order/service/index.ts` – Luật chuyển ga đầu tiên

```typescript
// Only cancel when status is pending
if (order.order_status !== ORDER_STATUS.PENDING) {
  throw new BadRequestError(
    `Cannot cancel order with status: ${order.order_status}. Only pending orders can be cancelled.`,
  )
}
```

Hiện tại project mới có **một đường chuyển** được kiểm tra: `pending → cancelled`. Một `if` như vậy là **hoàn toàn ổn** 👍.

Nhưng khi thêm *"shop xác nhận đơn"*, *"giao cho shipper"*, *"khách đã nhận"*, mỗi tính năng sẽ thêm một `if` ở một chỗ khác. Lúc đó nên gom vào **bảng `ORDER_TRANSITIONS`** đặt ngay cạnh `ORDER_STATUS`, để luật chơi luôn nằm một chỗ.

> 🛡️ **Mẹo chống race condition:** khi update, đặt điều kiện trạng thái *cũ* ngay trong query:
> ```typescript
> OrderModel.findOneAndUpdate(
>   { _id: orderId, order_status: 'pending' },   // ← chỉ update nếu VẪN đang pending
>   { $set: { order_status: 'cancelled' } },
> )
> ```
> Nếu shop vừa xác nhận đơn trong cùng mili-giây, query trả về `null` thay vì hủy nhầm một đơn đã confirmed.
>
> ⚠️ Code hiện tại **chưa** làm vậy. `cancelOrder` đọc status trước, rồi `OrderRepository.updateOrderStatus` gọi `findByIdAndUpdate(orderId, ...)` mà không kèm điều kiện status. Giữa lúc "đọc" và lúc "ghi" có một khe hở nhỏ. Bây giờ chưa sao, vì chưa có luồng nào khác đổi status. Nhưng khi thêm "shop xác nhận đơn" thì nên vá ngay.

---

## ⚠️ Cạm bẫy

### 1. ✍️ Update status trực tiếp, bỏ qua luật

```typescript
// ❌ Một dòng "tiện tay" phá cả state machine
await OrderModel.updateOne({ _id }, { order_status: 'delivered' })
```

Mọi thay đổi status **phải đi qua** một hàm duy nhất có `assertTransition`.

### 2. 🧹 Quên dọn dẹp khi chuyển trạng thái

Hủy đơn không chỉ là đổi chữ `pending` thành `cancelled`. Code hiện tại làm đúng: **trả hàng về kho** (`releaseInventory`) và **đổi status** trong **cùng một transaction**. Thiếu một trong hai là kho lệch số 📉.

### 3. 🤔 State vs Strategy

```
Strategy: CLIENT chọn cách làm từ bên ngoài          → 🛵 "hôm nay mưa, đi ô tô"
State:    OBJECT tự đổi hành vi khi trạng thái đổi   → 🚂 "tàu qua ga shipping rồi thì không hủy được"
```

Code hai pattern giống nhau (interface + nhiều class). Khác ở chỗ **ai** quyết định đổi.

---

## 📝 Ghi nhớ

> **"State = Chuyến tàu qua từng ga. Ga nào luật nấy, không nhảy cóc tới ga cuối."** 🚂
>
> Nhớ 3 điều:
> 1. **Liệt kê** các trạng thái (`ORDER_STATUS`)
> 2. **Vẽ bảng** đường được phép đi (`ORDER_TRANSITIONS`)
> 3. **Một cửa** để đổi status, check luật **trong query** để chống race

---

## 🎯 Quick Quiz

**Q: Với bảng `ORDER_TRANSITIONS` ở trên, khách có hủy được đơn đang `confirmed` không? Muốn chỉ cho hủy khi `pending` thì sửa gì?**

<details>
<summary>💡 Đáp án</summary>

**Có**, vì `confirmed: ['shipping', 'cancelled']`.

Muốn giống code hiện tại (chỉ hủy khi `pending`), chỉ cần **xoá một chữ**:

```typescript
confirmed: ['shipping'],
```

Không phải tìm từng `if` trong từng service. **Đổi luật kinh doanh = sửa một dòng dữ liệu.** Đó chính là lợi ích lớn nhất của State pattern 🎯.
</details>

---

[⬅️ Dependency Injection](./17-dependency-injection.md) | [Về mục lục](./README.md) | [Tiếp: 🧭 Cheat Sheet →](./99-cheat-sheet.md)
