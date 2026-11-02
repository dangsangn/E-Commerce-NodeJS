# 🥤 Simple Factory Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Máy bán nước tự động. Bấm số 1 → rơi ra lon Coca. Bạn không cần biết bên trong máy chạy ra sao.
> - 🎯 **Dùng khi:** phải chọn class để `new` dựa trên một tham số (type, size, kênh...).
> - 📁 **Trong project:** `ProductServiceFactory` trong `src/features/product/service/index.ts`

---

## 🎪 Câu chuyện vui

Bạn đứng trước **máy bán nước tự động** 🥤 ở sân bay.

Bấm **số 1** → *cạch*, rơi ra lon Coca.
Bấm **số 2** → *cạch*, rơi ra chai nước suối.
Bấm **số 9** (không có) → máy kêu *bíp bíp* ❌.

Bạn **không cần biết** bên trong có bao nhiêu khay, lò xo nào xoay, lon nằm ở đâu. Bạn chỉ đưa vào **một mã số** → nhận **đúng món**.

**Simple Factory = Máy bán nước. Đưa vào "mã món", nó trả ra đúng object đó.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Tạo object dựa trên type/config | Khi logic tạo phức tạp, cần mở rộng nhiều |
| Che giấu chi tiết khởi tạo | Khi có >5 loại → switch/case dài ngoằng |
| Centralize việc tạo object | Khi mỗi loại cần customize riêng biệt |
| Quick prototype | Khi vi phạm Open/Closed Principle là vấn đề |

---

## 💻 Code ví dụ

### ❌ Không có Factory – Client tự tạo, tự biết hết

```typescript
// 😱 Client phải biết chi tiết từng loại xe
function shipOrder(cargoVolume: number) {
  let transport;

  if (cargoVolume <= 10) {
    transport = { name: 'Xe máy', price: 500, maxWeight: 10 }
  } else if (cargoVolume <= 50) {
    transport = { name: 'Xe tải nhỏ', price: 2000, maxWeight: 50 }
  } else {
    transport = { name: 'Xe container', price: 10000, maxWeight: 500 }
  }

  // Đoạn if-else này copy-paste ở 10 chỗ khác nhau...
  // Thêm loại xe mới? Sửa 10 chỗ! 💀
}
```

### ✅ Với Simple Factory – Gom logic tạo vào 1 nơi

```typescript
export class ServiceLogistic {
  name: string
  price: number

  constructor(name: string = 'Truck 10', price: number = 1000) {
    this.name = name
    this.price = price
  }

  // 🥤 Factory method (static): "cái máy bán nước"
  static getTransport = (cargoVolume: number) => {
    switch (cargoVolume) {
      case 10:
        return new ServiceLogistic()              // Xe nhỏ
      case 20:
        return new ServiceLogistic('Truck 20', 2000)  // Xe vừa
      case 50:
        return new ServiceLogistic('Truck 50', 5000)  // Xe lớn
      default:
        return new ServiceLogistic('Truck 10', 1000)  // Mặc định
    }
  }
}

// Client code – sạch sẽ, không cần biết chi tiết!
const truck = ServiceLogistic.getTransport(20)
console.log(truck.name)  // 'Truck 20'
```

### 🧠 Luồng hoạt động

```
Client: "Tôi cần xe chở 20 tấn"
         │
         ▼
┌─────────────────────────┐
│  ServiceLogistic        │
│  .getTransport(20)      │  ← Factory quyết định tạo loại nào
│                         │
│  switch(20):            │
│    case 20 → Truck 20   │
└────────────┬────────────┘
             │
             ▼
   { name: 'Truck 20', price: 2000 }  ← Client nhận product
```

---

## 🔗 Chỗ nào dùng trong project?

📁 **`src/design_patterns/simple.factory.pattern.ts`**

Project đã có sẵn ví dụ Simple Factory cho logistics:

```typescript
// Gọi factory → nhận object, không cần new trực tiếp
console.log('Level 1: ', ServiceLogistic.getTransport(10).name)
```

### 🌟 Factory "xịn" đang chạy production: `ProductServiceFactory`

📁 **`src/features/product/service/index.ts`**

File trên chỉ là bản học. Factory thật của project nằm ở luồng **tạo sản phẩm**, và nó còn né được luôn cạm bẫy #1 bên dưới nhờ một **registry**:

```typescript
export class ProductServiceFactory {
  static productRegister: Record<string, any> = {} // key: product_type, value: Class

  // 📝 "Lắp thêm một khe nước mới vào máy"
  static registerProductType = (type: string, Class: any) => {
    this.productRegister[type] = Class
  }

  // 🥤 "Bấm nút": nhìn product_type → tìm class → new
  static createProduct = (payload: any) => {
    const ProductClass = this.productRegister[payload.product_type]
    if (!ProductClass) throw new BadRequestError('Invalid product type')
    return new ProductClass(payload).createProduct()
  }
}

// Cuối file: mỗi loại tự "lắp khe" vào máy
ProductServiceFactory.registerProductType(productType.CLOTHING, ClothingService)
ProductServiceFactory.registerProductType(productType.ELECTRONICS, ElectronicService)
```

```
payload.product_type = 'CLOTHING'
          │
          ▼
  productRegister = { CLOTHING: ClothingService, ELECTRONICS: ElectronicService }
          │
          ▼
  new ClothingService(payload).createProduct()  👕
```

Thêm loại `Furniture`? **Không đụng vào `createProduct`**, chỉ cần thêm 1 dòng `registerProductType(...)` 🎉. Không có switch nào phình to cả.

> 🤓 **Đố vui:** `productType` trong model có 4 giá trị (`ELECTRONICS`, `CLOTHING`, `SHOES`, `OTHER`), nhưng mới đăng ký 2. Gửi `product_type: 'SHOES'` thì sao? → `BadRequestError('Invalid product type')`. Máy có in nút, nhưng khe bên trong còn trống trơn 😅.

> 🔍 Nhìn kỹ `ClothingService` và `ElectronicService`, bạn sẽ thấy chúng copy-paste cùng một khối transaction. Đó là đất diễn của [🍜 Template Method](./16-template-method.md)!

### 💡 Ứng dụng thực tế khác trong E-commerce

```typescript
// Tạo response dựa trên status code
class ApiResponse {
  static success(data: any) {
    return new SuccessResponse(data)      // 200
  }
  static created(data: any) {
    return new CreatedResponse(data)      // 201
  }
  static badRequest(message: string) {
    return new BadRequestError(message)   // 400
  }
}

// Trong controller:
return ApiResponse.success(product)  // Không cần biết class nào
```

---

## ⚠️ Cạm bẫy

### 1. 🔓 Vi phạm Open/Closed Principle
```typescript
// Thêm loại xe mới? Phải sửa switch/case trong Factory!
static getTransport(cargoVolume: number) {
  switch (cargoVolume) {
    case 10: return new SmallTruck()
    case 20: return new MediumTruck()
    case 50: return new LargeTruck()
    case 100: return new ContainerTruck()  // ← Phải mở file ra sửa!
    case 200: return new TrainTransport()  // ← Lại sửa!
    // Switch ngày càng dài... 📜
  }
}
```

**Fix:** Nếu có >5 loại và thường xuyên thêm mới → dùng **Factory Method** hoặc **Registry Pattern** (đúng như `ProductServiceFactory` ở trên).

### 2. 📦 Factory quá "béo"
```typescript
// ❌ Factory biết quá nhiều chi tiết
static createTransport(type: string) {
  if (type === 'truck') {
    const engine = new DieselEngine()       // Factory phải biết engine
    const tires = new HeavyDutyTires(6)     // và tires
    const gps = new GpsTracker('premium')   // và GPS
    return new Truck(engine, tires, gps)    // và cách lắp ráp!
  }
  // ...
}

// ✅ Factory chỉ nên chọn loại, không lắp ráp chi tiết
// → Dùng Builder Pattern cho việc lắp ráp phức tạp
```

---

## 🤔 Simple Factory vs Factory Method

| | Simple Factory | Factory Method |
|---|---|---|
| **Ai tạo?** | 1 class duy nhất (static method) | Mỗi subclass tự tạo |
| **Thêm loại mới?** | Sửa switch/case | Thêm subclass mới |
| **Độ phức tạp** | Thấp | Trung bình |
| **Khi nào?** | Ít loại, ít thay đổi | Nhiều loại, hay thay đổi |

---

## 📝 Ghi nhớ

> **"Simple Factory = Máy bán nước. Bấm số nào, rơi ra lon đó."** 🥤
>
> Nhớ:
> 1. **1 method static**: cái máy duy nhất
> 2. **switch/case** hoặc registry: bảng "số nút → loại nước"
> 3. **return new Something()**: lon rơi ra khe lấy hàng *cạch* 🥫

---

## 🎯 Quick Quiz

**Q: Code này có vấn đề gì?**
```typescript
class NotificationFactory {
  static create(type: string) {
    if (type === 'email') return new EmailNotification()
    if (type === 'sms') return new SmsNotification()
    if (type === 'push') return new PushNotification()
    if (type === 'slack') return new SlackNotification()
    if (type === 'telegram') return new TelegramNotification()
    if (type === 'discord') return new DiscordNotification()
    if (type === 'webhook') return new WebhookNotification()
    throw new Error('Unknown type')
  }
}
```

<details>
<summary>💡 Đáp án</summary>

**Quá nhiều loại!** 7 loại notification và sẽ còn thêm.

Nên dùng **Registry Pattern** (biến thể của Factory):

```typescript
class NotificationFactory {
  private static registry = new Map<string, new () => Notification>()

  static register(type: string, cls: new () => Notification) {
    this.registry.set(type, cls)
  }

  static create(type: string): Notification {
    const Cls = this.registry.get(type)
    if (!Cls) throw new Error(`Unknown type: ${type}`)
    return new Cls()
  }
}

// Mỗi loại tự đăng ký – thêm loại mới không cần sửa Factory!
NotificationFactory.register('email', EmailNotification)
NotificationFactory.register('slack', SlackNotification)
```
</details>

---

[⬅️ Singleton](./01-singleton.md) | [Về mục lục](./README.md) | [Tiếp: 🍕 Factory Method →](./03-factory-method.md)
