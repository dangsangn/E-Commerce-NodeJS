# 🍜 Template Method Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Công thức phở của bếp trưởng: ninh xương → trụng bánh → xếp thịt → chan nước. Ai nấu cũng theo, chỉ được chọn thịt.
> - 🎯 **Dùng khi:** nhiều class có cùng "bộ khung" các bước, chỉ khác một hai bước.
> - 📁 **Trong project:** `ProductService` và các lớp con trong `src/features/product/service/index.ts` (mới làm được nửa)

---

## 🎪 Câu chuyện vui

Bạn mở chuỗi quán phở 🍜. Mỗi tô phở đều đi qua **cùng một quy trình**:

```
1. Ninh nước dùng       ← giống nhau
2. Trụng bánh phở       ← giống nhau
3. Xếp thịt lên         ← 🐄 bò tái / 🐔 gà xé / 🦐 hải sản
4. Chan nước, rắc hành  ← giống nhau
```

Nếu mỗi đầu bếp tự viết quy trình riêng:
- Đầu bếp phở gà quên bước 1 → khách húp nước lã 💀
- Sếp muốn đổi bước 4 (thêm quẩy) → phải dặn **từng** đầu bếp

Cách đúng: **bếp trưởng giữ công thức** (bước 1, 2, 4), mỗi món **chỉ được điền bước 3**.

**Template Method = Class cha giữ "bộ khung" thuật toán, class con chỉ điền vào các bước được phép.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Nhiều class có quy trình giống 80%, khác 20% | Mỗi class làm việc hoàn toàn khác nhau |
| Thấy copy-paste cùng một "bộ khung" ở nhiều subclass | Chỉ có 1 subclass → chưa cần |
| Muốn **bắt buộc** thứ tự các bước (vd: mở transaction → ... → commit) | Khi cần đổi bước lúc runtime (dùng Strategy) |
| Import/export dữ liệu, gửi notification nhiều kênh | Kế thừa quá 2–3 tầng |

---

## 💻 Code ví dụ

### ❌ Không có Template Method – Mỗi món tự nấu từ đầu

```typescript
class BeefPho {
  cook() {
    this.boilBroth()
    this.blanchNoodles()
    this.addBeef()          // 🐄
    this.pourBroth()
  }
}

class ChickenPho {
  cook() {
    this.blanchNoodles()    // 😱 quên ninh nước dùng!
    this.addChicken()       // 🐔
    this.pourBroth()
  }
}
```

### ✅ Với Template Method – Bếp trưởng giữ công thức

```typescript
abstract class Pho {
  // 📋 TEMPLATE METHOD – bộ khung cố định, con không được đổi thứ tự
  cook() {
    this.boilBroth()
    this.blanchNoodles()
    this.addTopping()        // ← chỗ trống cho con điền
    this.pourBroth()
  }

  // Bước chung
  private boilBroth() { /* 8 tiếng ninh xương */ }
  private blanchNoodles() { /* ... */ }
  private pourBroth() { /* ... */ }

  // 🕳️ Bước "đục lỗ" – con BẮT BUỘC phải điền
  protected abstract addTopping(): void
}

class BeefPho extends Pho {
  protected addTopping() { /* 🐄 bò tái, gầu, nạm */ }
}

class ChickenPho extends Pho {
  protected addTopping() { /* 🐔 gà xé, lá chanh */ }
}

new ChickenPho().cook() // ✅ không thể quên ninh nước dùng
```

> 🔑 **"Đừng gọi tôi, tôi sẽ gọi bạn"** (Hollywood Principle). Class con **không** gọi `cook()` của cha. Cha gọi `addTopping()` của con đúng lúc.

---

## 🔗 Chỗ nào dùng trong project?

### 📁 `src/features/product/service/index.ts` – "Nửa đường" tới Template Method

Project có class cha `ProductService` và hai con `ClothingService`, `ElectronicService`. Hãy nhìn `createProduct()` của **hai con**:

```typescript
class ClothingService extends ProductService {
  async createProduct() {
    const session = await mongoose.startSession()    // ┐
    session.startTransaction()                        // │ giống
    try {                                             // ┘
      await ClothingModel.create([{ ...attrs }], { session })   // ← KHÁC
      const created = await super.createProduct(session)        // ┐
      await session.commitTransaction()                         // │
      return created                                            // │ giống
    } catch (error) {                                           // │
      await session.abortTransaction()                          // │
      throw error                                               // │
    } finally {                                                 // │
      session.endSession()                                      // ┘
    }
  }
}

class ElectronicService extends ProductService {
  async createProduct() {
    // ...y hệt ở trên, chỉ khác ElectronicModel 🫠
  }
}
```

Hơn **20 dòng** lặp lại, chỉ **1 dòng** khác nhau. Đây đúng là dấu hiệu cần Template Method! 🚨

Thêm loại `FurnitureService` thì sao? Copy thêm 20 dòng nữa, và cầu trời đừng quên `abortTransaction()`.

### 💡 Hoàn thiện nốt nửa còn lại

```typescript
export abstract class ProductService {
  // 📋 TEMPLATE METHOD – bộ khung transaction, viết đúng 1 lần
  async createProduct() {
    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      await this.createAttributes(session)          // ← 🕳️ con điền
      const created = await this.createSpuAndSkus(session)  // SPU + SKU + inventory
      await session.commitTransaction()
      return created
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  protected abstract createAttributes(session: ClientSession): Promise<void>
  private async createSpuAndSkus(session: ClientSession) { /* logic hiện tại của super.createProduct */ }
}

class ClothingService extends ProductService {
  protected async createAttributes(session: ClientSession) {
    await ClothingModel.create([{ ...this.product_attributes, _id: this._id }], { session })
  }
}

class ElectronicService extends ProductService {
  protected async createAttributes(session: ClientSession) {
    await ElectronicModel.create([{ ...this.product_attributes, _id: this._id }], { session })
  }
}
// Thêm Furniture = 5 dòng, KHÔNG THỂ quên commit/abort 🎉
```

Bonus: `ProductServiceFactory` ([02-simple-factory.md](./02-simple-factory.md)) **không cần sửa gì**, vẫn gọi `new ProductClass(payload).createProduct()` như cũ.

---

## ⚠️ Cạm bẫy

### 1. 🔓 Con override luôn cả bộ khung

```typescript
class LazyPho extends Pho {
  cook() { this.addTopping() }  // 😈 ghi đè template, bỏ hết các bước
}
```

TypeScript không có `final`, nên hãy đặt tên rõ ràng, viết comment *"do not override"*, và review kỹ.

### 2. 🪜 Kế thừa quá sâu

```
Pho → BeefPho → SpecialBeefPho → SpecialBeefPhoNoOnion → ... 🤯
```

Quá 2 tầng thì cân nhắc **Strategy**: truyền "bước khác nhau" vào như một object, thay vì kế thừa.

### 3. 🍕 Template Method vs Factory Method: hai anh em ruột

Nhớ chuỗi pizza ở [bài 03](./03-factory-method.md) không? **Factory Method chính là Template Method có bước trống là "tạo object"**:

```
🍜 Template Method: bước trống = "xếp thịt gì"   (một HÀNH ĐỘNG)
🍕 Factory Method:  bước trống = "nướng bánh gì" (TẠO RA một object)
```

### 4. 🆚 Template Method vs Strategy

```
Template Method: khác nhau bằng KẾ THỪA,   chọn lúc viết code  → 🍜 công thức cố định
Strategy:        khác nhau bằng TRUYỀN VÀO, chọn lúc runtime    → 🛵 mưa ô tô, tắc xe ôm
```

---

## 📝 Ghi nhớ

> **"Template Method = Công thức phở của bếp trưởng. Ai nấu cũng phải ninh xương trước, chỉ được chọn thịt."** 🍜
>
> Nhớ 3 điều:
> 1. **Cha giữ bộ khung** (thứ tự các bước)
> 2. **Con điền chỗ trống** (`abstract` / hook method)
> 3. **Copy-paste "bộ khung" ở nhiều subclass** = dấu hiệu cần pattern này

---

## 🎯 Quick Quiz

**Q: Trong bản refactor ở trên, nếu `ElectronicService.createAttributes()` throw lỗi, chuyện gì xảy ra với SPU và SKU?**

<details>
<summary>💡 Đáp án</summary>

**Không có gì được ghi cả.** 🎉

`createAttributes` chạy **bên trong** `try` của template. Lỗi nhảy vào `catch`, gọi `abortTransaction()`, và mọi thứ ghi trong session đều bị rollback.

Đây là điểm mạnh nhất của Template Method: **bộ khung an toàn được viết đúng một lần**. Class con không thể "quên" xử lý lỗi, vì nó không được giao việc đó.
</details>

---

[⬅️ Facade](./15-facade.md) | [Về mục lục](./README.md) | [Tiếp: 🔋 Dependency Injection →](./17-dependency-injection.md)
