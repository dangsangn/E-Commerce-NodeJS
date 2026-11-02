# 📦 Composite Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Thùng hàng chứa món lẻ và cả thùng nhỏ hơn. Hỏi giá thùng nào, thùng đó tự cộng mọi thứ bên trong.
> - 🎯 **Dùng khi:** dữ liệu dạng cây (combo, danh mục, menu), muốn gọi lá và cành như nhau.
> - 📁 **Trong project:** chưa dùng. Comments đang lưu phẳng bằng `parentId`.

---

## 🎪 Câu chuyện vui

Bạn xem **giỏ hàng** trên Shopee 🛒:

```
🛒 Giỏ hàng (tổng: 1,500,000đ)
├── 📦 Bundle "Combo Laptop" (800,000đ)
│   ├── 🖱️ Chuột Logitech (200,000đ)
│   ├── ⌨️ Bàn phím (350,000đ)
│   └── 🎒 Túi laptop (250,000đ)
├── 📱 iPhone Case (150,000đ)
└── 📦 Bundle "Văn phòng" (550,000đ)
    ├── 📝 Sổ tay (50,000đ)
    └── 📦 Bộ bút (500,000đ)
        ├── 🖊️ Bút bi (200,000đ)
        └── 🖍️ Bút highlight (300,000đ)
```

Dù là **sản phẩm đơn** (iPhone Case) hay **bundle** (Combo Laptop chứa nhiều sản phẩm), bạn đều gọi `.getPrice()` giống nhau. Bundle tự tính tổng giá sản phẩm bên trong.

**Composite = Thùng trong thùng. Món lẻ (leaf) và thùng (composite) có cùng interface `.getPrice()`.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Cấu trúc cây (menu, category, folder) | Dữ liệu phẳng, không có nesting |
| Nested comments/replies | Khi leaf và branch khác nhau hoàn toàn |
| Product bundles / combos | Cấu trúc đơn giản 1-2 cấp |
| Organization chart | Khi recursion gây khó debug |

---

## 💻 Code ví dụ

### E-commerce: Product & Bundle

```typescript
// 📋 Interface chung cho cả Product lẻ và Bundle
interface CartItem {
  getName(): string
  getPrice(): number
  getQuantity(): number
}

// 🍃 Leaf – Sản phẩm đơn lẻ
class Product implements CartItem {
  constructor(
    private name: string,
    private price: number,
    private quantity: number = 1
  ) {}

  getName() { return this.name }
  getPrice() { return this.price * this.quantity }
  getQuantity() { return this.quantity }
}

// 🌳 Composite – Bundle chứa nhiều items (có thể chứa bundle khác!)
class Bundle implements CartItem {
  private items: CartItem[] = []

  constructor(
    private name: string,
    private discount: number = 0  // Giảm giá khi mua bundle
  ) {}

  add(item: CartItem): this {
    this.items.push(item)
    return this
  }

  getName() { return this.name }

  getPrice(): number {
    const total = this.items.reduce((sum, item) => sum + item.getPrice(), 0)
    return total * (1 - this.discount / 100)
  }

  getQuantity() { return 1 }
}

// 🧠 Sử dụng
const cart = new Bundle('Giỏ hàng')

const laptopCombo = new Bundle('Combo Laptop', 10)  // Giảm 10%
  .add(new Product('Chuột Logitech', 200000))
  .add(new Product('Bàn phím cơ', 350000))
  .add(new Product('Túi laptop', 250000))

cart.add(laptopCombo)                                // Bundle trong bundle!
cart.add(new Product('iPhone Case', 150000))

console.log(cart.getPrice())
// laptopCombo: (200000 + 350000 + 250000) × 0.9 = 720,000
// iPhone Case: 150,000
// Tổng: 870,000
```

### Nested Comments (ý tưởng mở rộng cho project)

```typescript
// Comment system – comment chứa replies, reply chứa replies...
interface IComment {
  getContent(): string
  getReplies(): IComment[]
  getTotalCount(): number  // Đếm tất cả comments con
}

class Comment implements IComment {
  private replies: IComment[] = []

  constructor(private content: string, private author: string) {}

  addReply(reply: IComment) { this.replies.push(reply) }

  getContent() { return this.content }
  getReplies() { return this.replies }

  getTotalCount(): number {
    return 1 + this.replies.reduce((sum, r) => sum + r.getTotalCount(), 0)
  }
}

// Cây comment
const comment = new Comment('Sản phẩm tốt lắm!', 'Sang')
const reply1 = new Comment('Đồng ý!', 'An')
const reply2 = new Comment('Mua ở đâu vậy?', 'Bình')
const subReply = new Comment('Mua trên Shopee nè', 'Sang')

reply2.addReply(subReply)
comment.addReply(reply1)
comment.addReply(reply2)

console.log(comment.getTotalCount()) // 4 (1 + 1 + 1 + 1)
```

---

## 🔗 Ứng dụng trong project

> 💡 **Nói thật:** project **chưa** dùng Composite. Dưới đây là những chỗ *có hình dạng cây*, sẵn sàng áp dụng khi cần.

- **`src/features/comments/`**: comment lưu **phẳng** trong Mongo, mỗi reply có `parentId` trỏ về comment gốc (2 cấp). Use-case xử lý cây bằng tay, ví dụ *"xóa gốc → xóa luôn replies"*. Nếu sau này cần reply nhiều cấp và đếm tổng số reply, lúc đó class `Comment` ở trên sẽ phát huy tác dụng.
- **Category tree**: danh mục sản phẩm nhiều cấp (Thời trang → Nam → Áo thun)
- **Product bundle / combo**: chính là ví dụ giỏ hàng ở đầu bài

---

## ⚠️ Cạm bẫy

### 1. 🌀 Infinite recursion
```typescript
// ❌ Bundle chứa chính nó → stack overflow!
const bundle = new Bundle('Infinite')
bundle.add(bundle)  // 💥 getPrice() gọi mãi không dừng!

// ✅ Check circular reference khi add
add(item: CartItem): this {
  if (item === this) throw new Error('Cannot add self!')
  this.items.push(item)
  return this
}
```

### 2. 🎭 Leaf có method vô nghĩa
```typescript
// Product.add() ?? Product không chứa items!
// → Throw error hoặc bỏ qua, không nên implement vô nghĩa
```

---

## 📝 Ghi nhớ

> **"Composite = Thùng trong thùng. Hỏi giá thùng to, nó tự hỏi từng món và từng thùng nhỏ bên trong."** 📦

---

## 🎯 Quick Quiz

**Q: Bundle "Combo Laptop" giảm 10%, bên trong có thêm Bundle "Phụ kiện" giảm 5% chứa chuột 200k và lót chuột 100k. Combo còn có bàn phím 300k. Giá combo là bao nhiêu?**

<details>
<summary>💡 Đáp án</summary>

Tính **từ lá lên gốc**, giống `getPrice()` đệ quy:

```
Phụ kiện:     (200k + 100k) × 0.95 = 285k
Combo Laptop: (285k + 300k) × 0.90 = 526.5k
```

**526,500đ.** Điểm hay là code gọi `combo.getPrice()` **không cần biết** bên trong có bao nhiêu tầng bundle. Mỗi node tự lo phần của mình 🌳.
</details>

---

[⬅️ Prototype](./12-prototype.md) | [Về mục lục](./README.md) | [Tiếp: 🧋 Decorator →](./14-decorator.md)
