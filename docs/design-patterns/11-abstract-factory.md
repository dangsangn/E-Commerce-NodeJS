# 🛋️ Abstract Factory Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Mua nội thất IKEA theo bộ sưu tập: sofa, bàn, đèn cùng một style, không bao giờ lệch tông.
> - 🎯 **Dùng khi:** cần tạo *cả bộ* object đi chung với nhau (theme UI, bộ hạ tầng test/production).
> - 📁 **Trong project:** chưa cần. Bài có đề xuất bộ hạ tầng Local/Cloud.

---

## 🎪 Câu chuyện vui

Bạn mua **nội thất cho phòng khách** 🛋️.

Bạn muốn mọi thứ **cùng phong cách**:
- **Phong cách Hiện đại** → Sofa Hiện đại + Bàn Hiện đại + Đèn Hiện đại
- **Phong cách Cổ điển** → Sofa Cổ điển + Bàn Cổ điển + Đèn Cổ điển
- **Phong cách Bắc Âu** → Sofa Bắc Âu + Bàn Bắc Âu + Đèn Bắc Âu

Bạn **KHÔNG MUỐN** Sofa Hiện đại + Bàn Cổ điển + Đèn Bắc Âu → xấu kinh! 🤮

Vậy bạn chọn **1 cửa hàng** (factory) theo phong cách. Mua gì từ cửa hàng đó cũng ra đồng bộ.

**Abstract Factory = Cửa hàng nội thất theo phong cách. Mua gì cũng cùng style.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Tạo BỘ object liên quan nhau | Khi chỉ tạo 1 loại object (dùng Factory Method) |
| Đảm bảo tính đồng bộ (UI theme, DB driver set) | Khi các object không liên quan nhau |
| Hỗ trợ nhiều "gia đình" sản phẩm | App nhỏ, ít biến thể |
| Cross-platform UI components | Over-engineering cho 1-2 class |

---

## 💻 Code ví dụ

### Bài toán: UI Component theo Theme

```typescript
// 📋 Interfaces cho các "sản phẩm"
interface Button {
  render(): string
}

interface Input {
  render(): string
}

interface Card {
  render(): string
}

// 🏭 Abstract Factory – "Cửa hàng nội thất"
interface UIFactory {
  createButton(): Button
  createInput(): Input
  createCard(): Card
}

// 🎨 Factory 1: Material Design
class MaterialUIFactory implements UIFactory {
  createButton(): Button {
    return {
      render: () => '<button class="md-button md-raised">Click me</button>'
    }
  }
  createInput(): Input {
    return {
      render: () => '<input class="md-input md-outlined" />'
    }
  }
  createCard(): Card {
    return {
      render: () => '<div class="md-card md-elevation-2">...</div>'
    }
  }
}

// 🎨 Factory 2: Ant Design
class AntDesignUIFactory implements UIFactory {
  createButton(): Button {
    return {
      render: () => '<button class="ant-btn ant-btn-primary">Click me</button>'
    }
  }
  createInput(): Input {
    return {
      render: () => '<input class="ant-input" />'
    }
  }
  createCard(): Card {
    return {
      render: () => '<div class="ant-card">...</div>'
    }
  }
}
```

### 🧠 Sử dụng

```typescript
// Chọn factory theo config → tất cả component cùng style!
function createUI(factory: UIFactory) {
  const button = factory.createButton()  // ← Cùng style
  const input = factory.createInput()    // ← Cùng style
  const card = factory.createCard()      // ← Cùng style

  return { button, input, card }
}

// Material Design
const materialUI = createUI(new MaterialUIFactory())
// → Tất cả là Material components ✅

// Ant Design
const antUI = createUI(new AntDesignUIFactory())
// → Tất cả là Ant Design components ✅

// KHÔNG BAO GIỜ lẫn Material Button + Ant Input → đồng bộ!
```

### Ứng dụng thực tế: Database Driver Set

```typescript
interface IDBConnection { connect(): Promise<void> }
interface IDBQuery { execute(sql: string): Promise<any[]> }
interface IDBTransaction { begin(): Promise<void>; commit(): Promise<void> }

interface DatabaseFactory {
  createConnection(): IDBConnection
  createQuery(): IDBQuery
  createTransaction(): IDBTransaction
}

class MongoDBFactory implements DatabaseFactory {
  createConnection() { return new MongoConnection() }
  createQuery() { return new MongoQuery() }         // Dùng aggregation
  createTransaction() { return new MongoTransaction() }
}

class PostgresFactory implements DatabaseFactory {
  createConnection() { return new PgConnection() }
  createQuery() { return new PgQuery() }            // Dùng SQL
  createTransaction() { return new PgTransaction() }
}

// Đổi DB = đổi 1 factory, tất cả components đồng bộ!
const db = config.dbType === 'mongo'
  ? new MongoDBFactory()
  : new PostgresFactory()
```

---

## 🤔 Abstract Factory vs Factory Method

```
Factory Method:                    Abstract Factory:
Tạo 1 product                     Tạo 1 BỘ products

┌──────────────┐                  ┌──────────────────┐
│ CarFactory   │→ Car             │ MaterialFactory  │→ Button + Input + Card
│ TruckFactory │→ Truck           │ AntDesignFactory │→ Button + Input + Card
└──────────────┘                  └──────────────────┘
   1 factory → 1 product            1 factory → N products (cùng "gia đình")
```

---

## ⚠️ Cạm bẫy

### 1. 🧩 Thêm product mới = sửa TẤT CẢ factory
```typescript
// Thêm createModal() vào UIFactory interface
// → PHẢI implement ở MaterialUIFactory, AntDesignUIFactory, ...
// → Vi phạm Open/Closed nếu có nhiều factory!
```

### 2. 📦 Quá ít biến thể → không cần Abstract Factory
```typescript
// Chỉ có 1 theme → Factory Method hoặc Simple Factory đủ rồi!
```

---

## 🔗 Chỗ nào dùng trong project?

> 💡 **Nói thật:** project **chưa** cần Abstract Factory, và như vậy là đúng! Hiện chỉ có **một** "gia đình" hạ tầng: Mongo + Redis + Cloudinary + nodemailer.

Nó sẽ có đất diễn khi project phải chạy **nhiều môi trường với cả bộ hạ tầng khác nhau**:

```typescript
// 🧪 Test/dev local: cả bộ chạy trong RAM, không cần internet
class LocalInfraFactory implements InfraFactory {
  createCache()   { return new InMemoryCache() }
  createStorage() { return new LocalDiskStorage('./uploads') }
  createMailer()  { return new MailpitMailer() }   // docker-compose đã có mailpit
}

// ☁️ Production: cả bộ dịch vụ thật
class CloudInfraFactory implements InfraFactory {
  createCache()   { return new RedisCache() }
  createStorage() { return new CloudinaryStorage() }
  createMailer()  { return new SmtpMailer() }
}
```

Đảm bảo không ai lỡ tay ghép "Redis production + ổ đĩa local" 🤮, đúng tinh thần "mua cả bộ IKEA".

---

## 📝 Ghi nhớ

> **"Abstract Factory = IKEA. Chọn bộ sưu tập MALM → bàn, tủ, giường đều cùng style."** 🛏️
>
> Khác Factory Method ở chỗ: tạo **BỘ** sản phẩm, không phải **1** sản phẩm.

---

## 🎯 Quick Quiz

**Q: Shop có 2 loại vận chuyển: "Nội thành" (xe máy + phí theo km + giao 2h) và "Liên tỉnh" (xe tải + phí theo kg + giao 3 ngày). Nên dùng Factory Method hay Abstract Factory?**

<details>
<summary>💡 Đáp án</summary>

**Abstract Factory.** Mỗi loại vận chuyển là một **bộ 3 thứ đi cùng nhau**: phương tiện, cách tính phí, cam kết thời gian.

```typescript
interface ShippingFactory {
  createVehicle(): Vehicle
  createFeeCalculator(): FeeCalculator
  createSla(): DeliverySla
}
```

Dùng Factory Method thì chỉ tạo được 1 thứ, và rất dễ ghép nhầm "xe máy + phí theo kg + 3 ngày" 🛵📦🐌.

Mẹo nhớ: thấy **"bộ"**, thấy **"đi cùng nhau"** → Abstract Factory.
</details>

---

[⬅️ Proxy](./10-proxy.md) | [Về mục lục](./README.md) | [Tiếp: 🖨️ Prototype →](./12-prototype.md)
