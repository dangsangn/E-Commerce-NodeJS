# 🖨️ Prototype Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Thầy giáo photocopy đề mẫu rồi sửa vài câu cho từng lớp, thay vì soạn lại 50 câu.
> - 🎯 **Dùng khi:** tạo object mới từ một object mẫu phức tạp, và không được làm hỏng bản gốc.
> - 📁 **Trong project:** tinh thần "copy rồi sửa" bằng spread trong `comment.use-case.ts` và `withSingleDefault`

---

## 🎪 Câu chuyện vui

Bạn là **thầy giáo** soạn đề thi 📝.

### ❌ Không có Prototype
Mỗi lớp soạn đề từ đầu:
- Đề lớp A: Viết 50 câu (2 tiếng ☕)
- Đề lớp B: Viết 50 câu (2 tiếng ☕)
- Đề lớp C: Viết 50 câu (2 tiếng ☕)

### ✅ Có Prototype
Soạn 1 đề mẫu → **photocopy** → sửa vài câu cho mỗi lớp:
- Đề mẫu: Viết 50 câu (2 tiếng)
- Đề lớp A: Photocopy + sửa 5 câu (10 phút) ⚡
- Đề lớp B: Photocopy + sửa 3 câu (5 phút) ⚡

**Prototype = Photocopy object rồi customize, thay vì tạo mới từ đầu.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Clone object phức tạp (nested) | Object đơn giản, tạo mới nhanh |
| Tạo biến thể từ template | Khi object có circular references |
| Tránh constructor phức tạp | Khi deep clone quá tốn (object rất lớn) |
| Config/template system | Khi object có DB connection, streams |

---

## 💻 Code ví dụ

### JavaScript đã có Prototype sẵn!

```typescript
// Shallow clone – Cách đơn giản nhất
const productTemplate = {
  name: '',
  price: 0,
  category: 'electronics',
  status: 'draft',
  attributes: { warranty: '12 months', brand: '' },
}

// Clone bằng spread operator (shallow)
const iphone = { ...productTemplate, name: 'iPhone 15', price: 30000000 }

// ⚠️ Shallow clone: nested object vẫn share reference!
iphone.attributes.brand = 'Apple'
console.log(productTemplate.attributes.brand) // 'Apple' 😱 bị ảnh hưởng!
```

### Deep Clone – Đúng cách

```typescript
// ✅ structuredClone (Node.js 17+, Browser)
const laptop = structuredClone(productTemplate)
laptop.name = 'MacBook Pro'
laptop.attributes.brand = 'Apple'
console.log(productTemplate.attributes.brand) // '' ← không bị ảnh hưởng ✅

// ✅ Class-based Prototype
class ProductPrototype {
  constructor(
    public name: string,
    public price: number,
    public category: string,
    public attributes: Record<string, any>
  ) {}

  // 🖨️ Clone method – "máy photocopy"
  clone(): ProductPrototype {
    return new ProductPrototype(
      this.name,
      this.price,
      this.category,
      structuredClone(this.attributes)  // Deep clone nested
    )
  }
}

// Tạo template
const electronicsTemplate = new ProductPrototype(
  '', 0, 'electronics',
  { warranty: '12 months', voltage: '220V' }
)

// Clone + customize
const tv = electronicsTemplate.clone()
tv.name = 'Samsung TV'
tv.price = 15000000

const fridge = electronicsTemplate.clone()
fridge.name = 'LG Fridge'
fridge.price = 12000000
```

### Ứng dụng: Order/Cart clone

```typescript
// Clone đơn hàng cũ để mua lại
class Order {
  constructor(
    public items: OrderItem[],
    public shippingAddress: Address,
    public paymentMethod: string,
    public notes: string,
  ) {}

  clone(): Order {
    return new Order(
      structuredClone(this.items),
      structuredClone(this.shippingAddress),
      this.paymentMethod,
      '',  // Clear notes cho đơn mới
    )
  }
}

// User bấm "Mua lại" → clone đơn cũ
const reOrder = previousOrder.clone()
reOrder.notes = 'Giao buổi sáng nhé'
```

---

## ⚠️ Cạm bẫy

### 1. 🔗 Shallow vs Deep clone
```typescript
// ❌ Spread chỉ shallow → nested objects vẫn share!
const clone = { ...original }
clone.nested.value = 'changed'  // original.nested.value cũng đổi!

// ✅ Dùng structuredClone() cho deep clone
const clone = structuredClone(original)
```

### 2. 🚫 Không clone được mọi thứ
```typescript
// structuredClone KHÔNG clone được:
// - Functions
// - DOM elements
// - Symbols
// - Prototype chain
// → Dùng custom clone() method cho các case đặc biệt
```

---

## 🔗 Chỗ nào dùng trong project?

Project không có class `clone()` nào, nhưng **tinh thần Prototype** xuất hiện mỗi khi ta "copy rồi sửa":

```typescript
// src/features/comments/application/use-cases/comment.use-case.ts
const newComment: CommentEntity = {
  ...payload,         // 📋 photocopy payload
  isDeleted: false,   // ✏️ sửa đúng 1 chỗ
}
```

```typescript
// src/features/product/service/index.ts – withSingleDefault
return skus.map((s, i) => ({ ...s, sku_default: i === defaultIdx }))
//                          ^^^^^ copy từng SKU, sửa cờ default
```

Cả hai đều an toàn vì chỉ sửa field **cấp 1**. Nếu sửa vào object lồng bên trong (`s.sku_thumb.url = ...`) thì spread **không đủ**, và bạn sẽ lỡ sửa luôn bản gốc (xem Cạm bẫy #1).

> 💡 Ý tưởng mở rộng: nút **"Nhân bản sản phẩm"** cho seller. Clone SPU + biến thể + SKU, xoá `_id`, đặt lại `isPublished: false`. Đây đúng là Prototype!

---

## 📝 Ghi nhớ

> **"Prototype = Photocopy. Clone cái có sẵn rồi sửa, nhanh hơn viết lại từ đầu."** 📋
>
> JavaScript tip: `structuredClone()` cho deep clone, `{...obj}` chỉ shallow.

---

## 🎯 Quick Quiz

**Q: Đoạn code sau in ra gì?**

```typescript
const template = { name: 'Áo thun', sizes: ['S', 'M'] }
const copy = { ...template }
copy.name = 'Áo polo'
copy.sizes.push('L')

console.log(template.name, template.sizes)
```

<details>
<summary>💡 Đáp án</summary>

```
Áo thun [ 'S', 'M', 'L' ]
```

- `name` **không đổi**, vì string là giá trị nguyên thuỷ, spread copy hẳn ra.
- `sizes` **bị đổi**, vì mảng là object, spread chỉ copy **địa chỉ**. Hai bên cùng trỏ vào một mảng 😱.

Fix: `const copy = structuredClone(template)`, hoặc `{ ...template, sizes: [...template.sizes] }`.

Câu thần chú: **"Spread copy cái vỏ, structuredClone copy cả ruột."** 🥥
</details>

---

[⬅️ Abstract Factory](./11-abstract-factory.md) | [Về mục lục](./README.md) | [Tiếp: 📦 Composite →](./13-composite.md)
