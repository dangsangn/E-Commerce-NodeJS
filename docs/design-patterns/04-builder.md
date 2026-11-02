# 🥪 Builder Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Gọi bánh mì Subway: chọn bánh → thêm thịt → thêm rau → chọn sốt → `.build()`. Không ai hỏi một câu dài 10 ý.
> - 🎯 **Dùng khi:** object có nhiều tham số, đa số optional, hoặc phải lắp ráp từng bước.
> - 📁 **Trong project:** chưa dùng. Bài có ví dụ cho E-commerce.

---

## 🎪 Câu chuyện vui

Bạn đi **Subway** làm bánh mì 🥪.

Nhân viên **KHÔNG** hỏi bạn 1 câu duy nhất:
> *"Anh muốn bánh mì loại gì, size gì, nướng không, rau gì, sốt gì, thêm phô mai không, thêm thịt gì, cay bao nhiêu?"*

Thay vào đó, họ hỏi **từng bước**:
1. "Chọn **bánh**" → Wheat 🍞
2. "Chọn **size**" → Footlong
3. "Chọn **thịt**" → Gà teriyaki 🍗
4. "Có **nướng** không?" → Có 🔥
5. "Chọn **rau**" → Xà lách, cà chua 🥬
6. "Chọn **sốt**" → Mayo, BBQ 💦

**Builder = Subway. Xây dựng từng bước, cuối cùng `.build()` ra sản phẩm.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Constructor có >4 tham số | Object đơn giản, 1-2 fields |
| Nhiều tham số optional | Khi tất cả fields đều required |
| Cần tạo nhiều "biến thể" của cùng 1 class | Khi object immutable sau khi tạo |
| Muốn code đọc được như văn xuôi | Over-engineering cho POJO/DTO |

---

## 💻 Code ví dụ

### ❌ Constructor hell – 10 tham số, nhớ thứ tự phát điên

```typescript
// 😱 Bạn có nhớ tham số thứ 7 là gì không?
const product = new Product(
  'iPhone 15',      // name
  29990000,         // price
  'Apple',          // brand
  'electronics',    // category
  true,             // isPublished
  100,              // stock
  null,             // discount ← null này là gì?
  ['url1', 'url2'], // images
  4.5,              // rating
  true,             // isFeatured ← hay isPublished nhỉ?
)
// Đọc code 3 tháng sau: 🤯🤯🤯
```

### ✅ Với Builder – Đọc như văn xuôi

```typescript
class ProductBuilder {
  private product: Partial<Product> = {}

  setName(name: string): this {
    this.product.name = name
    return this  // ← Return this cho phép CHAINING
  }

  setPrice(price: number): this {
    this.product.price = price
    return this
  }

  setBrand(brand: string): this {
    this.product.brand = brand
    return this
  }

  setCategory(category: string): this {
    this.product.category = category
    return this
  }

  setStock(stock: number): this {
    this.product.stock = stock
    return this
  }

  setImages(images: string[]): this {
    this.product.images = images
    return this
  }

  publish(): this {
    this.product.isPublished = true
    return this
  }

  feature(): this {
    this.product.isFeatured = true
    return this
  }

  // 🏁 Bước cuối: "build" ra sản phẩm hoàn chỉnh
  build(): Product {
    // Validate trước khi build
    if (!this.product.name) throw new Error('Product name is required')
    if (!this.product.price) throw new Error('Product price is required')

    return new Product(this.product)
  }
}
```

### 🧠 Sử dụng – Đọc như tiếng Anh!

```typescript
// ✅ Rõ ràng, dễ đọc, dễ maintain
const iphone = new ProductBuilder()
  .setName('iPhone 15')
  .setPrice(29990000)
  .setBrand('Apple')
  .setCategory('electronics')
  .setStock(100)
  .setImages(['iphone-front.jpg', 'iphone-back.jpg'])
  .publish()
  .feature()
  .build()

// ✅ Tạo biến thể khác – bỏ bớt bước
const draftProduct = new ProductBuilder()
  .setName('Samsung Galaxy S24')
  .setPrice(22990000)
  .setBrand('Samsung')
  .build()  // Không publish, không feature → draft product
```

### 🧠 Luồng hoạt động

```
new ProductBuilder()           → { }
  .setName('iPhone 15')        → { name: 'iPhone 15' }
  .setPrice(29990000)          → { name: 'iPhone 15', price: 29990000 }
  .setBrand('Apple')           → { name: ..., price: ..., brand: 'Apple' }
  .publish()                   → { ..., isPublished: true }
  .build()                     → validate → new Product(...)
                                              │
                                              ▼
                                    Product instance 📦
```

---

## 🔗 Ứng dụng thực tế trong E-commerce

### Query Builder

```typescript
// Mongoose query trong project dùng pattern tương tự Builder!
const users = await UserModel
  .find({ usr_status: 'active' })   // ← "chọn bánh"
  .select('usr_email usr_name')      // ← "chọn rau"
  .populate('usr_roles')             // ← "thêm sốt"
  .sort({ createdAt: -1 })           // ← "nướng"
  .limit(20)                         // ← "cắt size"
  .lean()                            // ← "đóng hộp"

// Mỗi method return `this` → chaining → Builder Pattern!
```

### Email Builder

```typescript
class EmailBuilder {
  private email: Partial<EmailOptions> = {}

  to(address: string): this {
    this.email.to = address
    return this
  }

  subject(text: string): this {
    this.email.subject = text
    return this
  }

  template(name: string): this {
    this.email.template = name
    return this
  }

  withData(data: Record<string, any>): this {
    this.email.data = data
    return this
  }

  build(): EmailOptions {
    if (!this.email.to) throw new Error('Recipient is required')
    if (!this.email.subject) throw new Error('Subject is required')
    return this.email as EmailOptions
  }
}

// Sử dụng:
const otpEmail = new EmailBuilder()
  .to('user@example.com')
  .subject('Mã xác thực OTP')
  .template('otp-verification')
  .withData({ otp: '123456', expiry: '5 phút' })
  .build()
```

---

## ⚠️ Cạm bẫy

### 1. 🐘 Builder cho object đơn giản = overengineering
```typescript
// ❌ Object chỉ có 2 fields → dùng Builder làm gì?
const point = new PointBuilder()
  .setX(10)
  .setY(20)
  .build()

// ✅ Constructor/Object literal đủ rồi!
const point = new Point(10, 20)
// hoặc
const point = { x: 10, y: 20 }
```

### 2. 🔄 Quên validate trong build()
```typescript
// ❌ build() không validate → tạo object thiếu thông tin
build(): Product {
  return new Product(this.product)  // name = undefined?? 😱
}

// ✅ Luôn validate required fields
build(): Product {
  if (!this.product.name) throw new Error('Name is required!')
  if (!this.product.price || this.product.price <= 0) {
    throw new Error('Price must be positive!')
  }
  return new Product(this.product)
}
```

### 3. 🧬 Builder mutable = bug ẩn
```typescript
// ❌ Reuse builder → state cũ "dính" sang object mới
const builder = new ProductBuilder().setBrand('Apple')

const iphone = builder.setName('iPhone').setPrice(30000000).build()
const macbook = builder.setName('MacBook').setPrice(50000000).build()
// macbook vẫn còn settings từ iphone! 😱

// ✅ Mỗi product = 1 builder mới
const iphone = new ProductBuilder().setBrand('Apple').setName('iPhone').build()
const macbook = new ProductBuilder().setBrand('Apple').setName('MacBook').build()
```

---

## 📝 Ghi nhớ

> **"Builder = Subway. Từng bước từng bước, cuối cùng `.build()` ra bánh mì."** 🥪
>
> Nhớ 3 thứ:
> 1. **Method chaining** – mỗi method `return this`
> 2. **`.build()`** – bước cuối, validate + tạo object
> 3. **Đọc được như văn xuôi** – `.setName().setPrice().publish().build()`

---

## 🎯 Quick Quiz

**Q: Hàm nào trong code dưới đây KHÔNG phải Builder pattern?**

```typescript
// A
const query = db.collection('products')
  .where('price', '>', 1000)
  .orderBy('createdAt')
  .limit(10)

// B
const server = express()
server.use(cors())
server.use(helmet())
server.listen(3000)

// C
const result = [1, 2, 3, 4, 5]
  .filter(n => n > 2)
  .map(n => n * 2)
  .reduce((a, b) => a + b, 0)
```

<details>
<summary>💡 Đáp án</summary>

**B và C không phải Builder!**

- **A** ✅ Builder – Xây dựng query object từng bước, cuối cùng execute
- **B** ❌ Không phải – `express()` đã tạo xong server, `.use()` là thêm middleware (Middleware Pattern)
- **C** ❌ Không phải – Đây là **Pipeline/Fluent Interface** – biến đổi data, không xây dựng object

Builder ≠ Method chaining. Builder **xây dựng object**, chaining chỉ là kỹ thuật gọi tiếp.
</details>

---

[⬅️ Factory Method](./03-factory-method.md) | [Về mục lục](./README.md) | [Tiếp: 🛵 Strategy →](./05-strategy.md)
