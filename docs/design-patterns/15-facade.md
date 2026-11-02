# 🏨 Facade Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Gọi lễ tân khách sạn: "taxi 6h, bàn tối, giặt đồ". Một cuộc gọi, lễ tân lo hết phía sau.
> - 🎯 **Dùng khi:** một use-case phải gọi nhiều service, và nhiều nơi cần cùng chuỗi đó.
> - 📁 **Trong project:** `CheckoutService.checkoutReview` trong `src/features/checkout/service/index.ts`

---

## 🎪 Câu chuyện vui

Bạn đi du lịch Đà Nẵng 🏖️. Có hai cách sống:

### ❌ Không có lễ tân
- Tự tra số hãng taxi, gọi, đọc địa chỉ 📞
- Tự tìm nhà hàng, đặt bàn, nhớ giờ 🍽️
- Tự tìm tiệm giặt, mang đồ đi, nhớ ngày lấy 👕
- Đổi hãng taxi → **bạn** phải học lại cách gọi

### ✅ Có lễ tân
- Nhấc máy: *"Chị ơi, taxi 6h, bàn tối 2 người, giặt túi đồ này."* ☎️
- Xong. Lễ tân lo hết phía sau.
- Khách sạn đổi hãng taxi → bạn **không hề biết**, cũng không cần biết.

**Facade = Một "quầy lễ tân" đơn giản che phía trước nhiều hệ thống phức tạp.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Một use-case phải gọi 3+ service/repository | Chỉ bọc đúng 1 service → thêm lớp vô ích |
| Nhiều chỗ cần cùng một chuỗi thao tác | Khi caller thật sự cần điều khiển từng bước |
| Muốn controller mỏng, chỉ "nhận – gọi – trả" | Facade phình thành "God class" làm mọi thứ |
| Che giấu thư viện bên thứ 3 rườm rà | |

---

## 💻 Code ví dụ

### ❌ Không có Facade – Controller biết quá nhiều

```typescript
// 😱 Controller phải tự điều phối 3 hệ thống
const checkoutReview = async (req, res) => {
  let total = 0
  for (const shop of req.body.shop_order_ids) {
    for (const item of shop.item_products) {
      const product = await ProductRepository.getProductPublishedById(item.productId)
      if (!product) throw new BadRequestError('...')
      if (item.price !== product.product_price) throw new BadRequestError('...')
      total += item.price * item.quantity
    }
    for (const disc of shop.shop_discounts) {
      const result = await new DiscountService().applyDiscount(/* ... */)
      total -= result.discountAmount
    }
  }
  res.json({ total })
}

// Rồi OrderService cũng cần đúng logic này → copy-paste 💀
// Sửa cách tính discount → phải sửa 2 chỗ, quên 1 chỗ = tính sai tiền 💸
```

### ✅ Với Facade – Một cửa duy nhất

```typescript
// 🏨 Lễ tân
class CheckoutService {
  static checkoutReview = async ({ userId, shop_order_ids }) => {
    // Phía sau: ProductRepository + DiscountService + logic tính tiền
    // Phía trước: một hàm, một kết quả
    return { shop_order_ids_new, checkout_order: { totalPrice, totalDiscount, totalCheckout } }
  }
}

// Controller: "nhận – gọi – trả", hết.
const checkoutReview = async (req, res) => {
  const data = await CheckoutService.checkoutReview({
    ...req.body,
    userId: req.user?.userId,
  })
  return OkResponse.send(res, { data })
}
```

```
                ┌──────────────────────────┐
Controller ───▶ │  🏨 CheckoutService      │
OrderService ─▶ │     .checkoutReview()    │
                └──────┬─────────┬─────────┘
                       │         │
            ┌──────────▼───┐ ┌───▼─────────────┐
            │ 📦 Product   │ │ 🎟️ Discount     │
            │  Repository  │ │    Service      │
            └──────────────┘ └─────────────────┘
```

---

## 🔗 Chỗ nào dùng trong project?

### 📁 `src/features/checkout/service/index.ts` – `CheckoutService.checkoutReview`

Đây là Facade "xịn" nhất project. Một hàm che giấu cả quy trình:

```
1. Duyệt từng shop trong giỏ
2. Lấy giá từ DB (KHÔNG tin giá client gửi lên 🕵️)
3. Kiểm tra sản phẩm thuộc đúng shop
4. Áp mã giảm giá qua DiscountService
5. Cộng dồn: totalPrice, totalDiscount, totalCheckout
```

Và có **hai "khách"** cùng gọi lễ tân này:

```typescript
// 1. src/features/checkout/controller/index.ts – user bấm "Xem lại đơn"
const data = await CheckoutService.checkoutReview({ ... })

// 2. src/features/order/service/index.ts – user bấm "Đặt hàng"
// "Call checkoutReview again — validate + get latest price"
const checkoutResult = await CheckoutService.checkoutReview({ ... })
```

Logic tính tiền **chỉ sống ở một nơi**. Đổi cách tính discount? Sửa 1 chỗ, cả xem trước lẫn đặt hàng đều đúng ✅.

---

## ⚠️ Cạm bẫy

### 1. 🐘 Facade phình thành God Class

```typescript
// ❌ Lễ tân kiêm luôn đầu bếp, tài xế, thợ giặt
class CheckoutService {
  static checkoutReview() {}
  static placeOrder() {}
  static sendInvoiceEmail() {}
  static calculateShipping() {}
  static refund() {}
  static exportReport() {}   // ...ơ, sao report lại ở đây? 🤨
}
```

Facade **điều phối**, không **làm hết**. Logic thật nên nằm ở service con (Discount, Inventory, Shipping...).

### 2. 🕳️ "Đi cửa sau" bỏ qua Facade

```typescript
// ❌ Một dev vội vàng tính tiền thẳng ở controller khác
const price = product.product_price * qty  // bỏ qua kiểm tra discount, shop...
```

Có Facade rồi thì **mọi** luồng tính tiền phải qua nó. Một cửa sau là đủ để có bug tính sai tiền.

### 3. 🎭 Facade phải "sạch" như lời hứa

Comment trong `checkoutReview` ghi rõ: hàm này *"Does NOT save to DB. Does NOT deduct stock. Does NOT have side effects."*

Đó là **hợp đồng** của lễ tân. Nếu một ngày service con nó gọi lén ghi DB (ví dụ tăng lượt dùng mã giảm giá), thì chỉ "xem lại đơn" thôi cũng đã ghi DB. Code hiện tại né chuyện này bằng tham số `isView = true` khi gọi `applyDiscount`. Hãy giữ hợp đồng đó khi sửa code!

### 4. 🤔 Nhầm với Adapter

```
Adapter: 1 → 1, đổi HÌNH DẠNG interface cho khớp       → 🔌 phích chuyển
Facade:  N → 1, ĐƠN GIẢN HOÁ nhiều hệ thống thành 1    → 🏨 lễ tân
```

---

## 📝 Ghi nhớ

> **"Facade = Lễ tân khách sạn. Một cuộc gọi, mười việc được lo."** 🏨
>
> Nhớ 3 điều:
> 1. **Một cửa** đơn giản phía trước, nhiều hệ thống phía sau
> 2. **Điều phối**, không ôm hết logic
> 3. Càng nhiều nơi gọi chung → càng đáng làm Facade

---

## 🎯 Quick Quiz

**Q: Tại sao `OrderService` gọi lại `checkoutReview` lần nữa, dù user vừa xem giá xong?**

<details>
<summary>💡 Đáp án</summary>

Vì giữa lúc **xem lại đơn** và lúc **bấm đặt hàng** có thể đã trôi qua 10 phút:
- Shop đổi giá 💰
- Mã giảm giá hết hạn hoặc hết lượt 🎟️
- Sản phẩm bị ẩn 🙈

Gọi lại Facade = lấy **giá mới nhất từ server**, không tin kết quả cũ client gửi lên.

Và nhờ có Facade, "gọi lại" chỉ tốn **một dòng code**, chứ không phải copy cả khối logic tính tiền. Đó chính là giá trị của pattern này 🎯.
</details>

---

[⬅️ Decorator](./14-decorator.md) | [Về mục lục](./README.md) | [Tiếp: 🍜 Template Method →](./16-template-method.md)
