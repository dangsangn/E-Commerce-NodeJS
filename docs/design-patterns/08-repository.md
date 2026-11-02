# 📚 Repository Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Thủ thư. Bạn nói "tìm sách TypeScript", thủ thư biết lục kệ nào, bạn khỏi vào kho.
> - 🎯 **Dùng khi:** muốn tách truy vấn DB khỏi business logic, để dễ đổi DB và dễ test.
> - 📁 **Trong project:** `src/features/comments/infrastructure/repositories/`, `src/features/*/repository/`

---

## 🎪 Câu chuyện vui

Bạn đến **thư viện** 📚.

### ❌ Không có thủ thư (Repository)
Bạn tự vào kho, lục 10,000 cuốn sách:
```
"SELECT * FROM ke_sach WHERE the_loai = 'TypeScript' 
 AND tang = 3 AND day = 'B' ORDER BY nam_xuat_ban DESC"
```
Bạn phải biết: kệ nào, tầng nào, dãy nào, cách sắp xếp...

### ✅ Có thủ thư (Repository)
Bạn nói: *"Cho tôi sách TypeScript mới nhất"*
Thủ thư: *"Đây anh/chị"* 📖

Bạn **không cần biết** sách xếp ở đâu, database gì, query thế nào.

**Repository = Thủ thư. Lớp trung gian giữa business logic và database.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Tách business logic khỏi DB | CRUD đơn giản (Mongoose trực tiếp OK) |
| Muốn đổi DB mà không sửa service | Prototype / MVP nhỏ |
| Cần mock/test dễ dàng | App chỉ có 1-2 model đơn giản |
| Query phức tạp cần tái sử dụng | Khi ORM đã đủ tốt (Prisma) |

---

## 💻 Code ví dụ

### ❌ Không có Repository – Service biết quá nhiều về DB

```typescript
// 😱 Service BIẾT Mongoose query, biết tên collection, biết schema
class OrderService {
  async getOrdersByUser(userId: string) {
    // Service đang "tự vào kho lục sách" 📚
    return await OrderModel
      .find({ order_userId: userId, order_status: 'active' })
      .populate('order_products.product')
      .sort({ createdAt: -1 })
      .select('-__v')
      .lean()
    // Đổi sang PostgreSQL? Sửa HẾT các service! 💀
  }

  async createOrder(data: any) {
    const order = await OrderModel.create({
      order_userId: data.userId,
      order_products: data.products,
      order_total: data.total,
    })
    // Trừ tồn kho – cũng query Mongoose trực tiếp
    await InventoryModel.updateMany(...)
    return order
  }
}
```

### ✅ Với Repository – Service chỉ biết business logic

```typescript
// 📋 Interface – "Hợp đồng" với thủ thư
interface IOrderRepository {
  findByUserId(userId: string): Promise<Order[]>
  findById(orderId: string): Promise<Order | null>
  create(data: CreateOrderDTO): Promise<Order>
  updateStatus(orderId: string, status: string): Promise<Order>
}

// 📚 Repository – "Thủ thư" biết cách tìm sách
class OrderRepository implements IOrderRepository {
  async findByUserId(userId: string): Promise<Order[]> {
    return await OrderModel
      .find({ order_userId: userId, order_status: 'active' })
      .populate('order_products.product')
      .sort({ createdAt: -1 })
      .lean()
  }

  async findById(orderId: string): Promise<Order | null> {
    return await OrderModel
      .findById(orderId)
      .populate('order_products.product')
      .lean()
  }

  async create(data: CreateOrderDTO): Promise<Order> {
    return await OrderModel.create({
      order_userId: data.userId,
      order_products: data.products,
      order_total: data.total,
    })
  }

  async updateStatus(orderId: string, status: string): Promise<Order> {
    return await OrderModel.findByIdAndUpdate(
      orderId,
      { order_status: status },
      { new: true }
    )
  }
}

// 💼 Service – Chỉ biết business logic, không biết DB
class OrderService {
  constructor(private orderRepo: IOrderRepository) {}
  //                    ↑ Nhận repository qua constructor (DI)

  async getOrdersByUser(userId: string) {
    // Service chỉ gọi method có nghĩa → dễ đọc!
    return await this.orderRepo.findByUserId(userId)
  }

  async createOrder(data: CreateOrderDTO) {
    // Business logic ở đây
    if (data.total <= 0) throw new Error('Invalid total')
    return await this.orderRepo.create(data)
  }
}
```

### 🧠 Luồng hoạt động

```
Controller                Service                   Repository
    │                        │                          │
    │  getOrders(userId)     │                          │
    │ ──────────────────►    │                          │
    │                        │  findByUserId(userId)    │
    │                        │ ────────────────────►    │
    │                        │                          │  Mongoose
    │                        │                          │  .find()
    │                        │                          │  .populate()
    │                        │       Order[]            │  .lean()
    │                        │ ◄────────────────────    │
    │       Order[]          │                          │
    │ ◄──────────────────    │                          │

  Controller KHÔNG BIẾT database
  Service KHÔNG BIẾT Mongoose/SQL
  Repository BIẾT cách query → dễ đổi DB!
```

---

## 🔗 Chỗ nào dùng trong project?

### 📁 `src/features/comments/` – Clean Architecture với Repository

Project đã áp dụng Repository pattern cho Comments feature:

```
src/features/comments/
├── application/              ← Business logic
│   ├── interfaces/           ← Repository interfaces
│   └── use-cases/            ← Use cases (service)
├── infrastructure/
│   └── repositories/         ← 📚 Repository implementations
│       └── comment.repository.ts
└── presentation/
    └── controllers/
        └── comment.controller.ts
```

### 📁 `src/features/order/repository/`

```
src/features/order/
├── repository/index.ts       ← 🗄️ Order Repository
├── controller/index.ts
├── model/index.ts
├── service/index.ts
└── routes/index.ts
```

---

## 💡 Lợi ích thực tế

### 1. 🧪 Test dễ dàng – Mock repository

```typescript
// Trong test: tạo mock repository, không cần DB thật!
class MockOrderRepository implements IOrderRepository {
  private orders: Order[] = []

  async findByUserId(userId: string) {
    return this.orders.filter(o => o.userId === userId)
  }

  async create(data: CreateOrderDTO) {
    const order = { id: 'mock-id', ...data }
    this.orders.push(order)
    return order
  }
  // ...
}

// Test service mà không cần MongoDB!
const mockRepo = new MockOrderRepository()
const service = new OrderService(mockRepo)

const order = await service.createOrder({
  userId: 'user-1',
  products: [...],
  total: 500000
})
expect(order.userId).toBe('user-1')
```

### 2. 🔄 Đổi database không sửa service

```typescript
// Đang dùng MongoDB:
class MongoOrderRepository implements IOrderRepository {
  async findByUserId(userId: string) {
    return await OrderModel.find({ order_userId: userId })  // Mongoose
  }
}

// Đổi sang PostgreSQL? Chỉ tạo repository mới!
class PostgresOrderRepository implements IOrderRepository {
  async findByUserId(userId: string) {
    return await prisma.order.findMany({ where: { userId } })  // Prisma
  }
}

// Service KHÔNG ĐỔI GÌ! Chỉ đổi repository được inject:
const repo = new PostgresOrderRepository()  // Đổi ở đây
const service = new OrderService(repo)      // Service y nguyên ✅
```

---

## ⚠️ Cạm bẫy

### 1. 🏗️ Over-abstraction cho CRUD đơn giản
```typescript
// ❌ Repository chỉ wrap Mongoose 1:1 → vô nghĩa
class UserRepository {
  async findById(id: string) {
    return UserModel.findById(id)  // Chỉ gọi Mongoose... thế thôi?
  }
  async create(data: any) {
    return UserModel.create(data)  // Wrapper vô nghĩa
  }
}

// ✅ Chỉ dùng Repository khi:
// - Query phức tạp cần tái sử dụng
// - Cần mock cho testing
// - Có khả năng đổi DB
// Nếu chỉ CRUD đơn giản → dùng Model trực tiếp OK!
```

### 2. 📦 Repository "béo" – biết business logic
```typescript
// ❌ Repository đang làm việc của Service!
class OrderRepository {
  async createOrderWithDiscount(data: any) {
    // Tính discount ← Business logic, không nên ở đây!
    const discount = data.total * 0.1
    const finalTotal = data.total - discount

    return OrderModel.create({
      ...data,
      total: finalTotal,
    })
  }
}

// ✅ Repository chỉ biết CRUD, Service xử lý logic
class OrderService {
  async createOrder(data: any) {
    const discount = this.calculateDiscount(data.total)  // ← Service
    const finalTotal = data.total - discount              // ← Service
    return this.orderRepo.create({ ...data, total: finalTotal })  // ← Repo
  }
}
```

### 3. 🔗 Leak ORM/DB details qua interface
```typescript
// ❌ Interface phụ thuộc Mongoose!
interface IOrderRepository {
  find(filter: mongoose.FilterQuery<Order>): Promise<Order[]>  // 😱 Mongoose type!
}

// ✅ Interface database-agnostic
interface IOrderRepository {
  findByUserId(userId: string): Promise<Order[]>  // ← Chỉ có business terms
  findByStatus(status: OrderStatus): Promise<Order[]>
}
```

---

## 📝 Ghi nhớ

> **"Repository = Thủ thư. Service nói 'tìm sách TypeScript', thủ thư biết lục kệ nào."** 📚
>
> Nhớ 3 lớp:
> 1. **Interface** – "Menu dịch vụ" (findById, findByUser, create)
> 2. **Implementation** – "Thủ thư thật" (biết Mongoose/Prisma/SQL)
> 3. **Service** – "Khách hàng" (chỉ gọi method, không biết DB)

---

## 🎯 Quick Quiz

**Q: Tìm lỗi trong repository này:**
```typescript
class ProductRepository {
  async findCheapProducts() {
    const products = await ProductModel.find({ price: { $lt: 100000 } })
    // Gửi email cho admin khi tìm thấy sản phẩm giá rẻ
    if (products.length > 100) {
      await EmailService.notify('admin@shop.com', 'Too many cheap products!')
    }
    return products
  }
}
```

<details>
<summary>💡 Đáp án</summary>

**Repository đang gửi email!** 📧 Đó là business logic, thuộc về Service.

```typescript
// ✅ Repository chỉ query
class ProductRepository {
  async findByMaxPrice(maxPrice: number) {
    return ProductModel.find({ price: { $lt: maxPrice } })
  }
}

// ✅ Service xử lý business logic
class ProductService {
  async checkCheapProducts() {
    const products = await this.repo.findByMaxPrice(100000)
    if (products.length > 100) {
      await EmailService.notify('admin@shop.com', 'Too many cheap products!')
    }
    return products
  }
}
```

**Nguyên tắc:** Repository = CRUD thuần. Side effects (email, notification, logging) thuộc về Service/Use Case.
</details>

---

[⬅️ Middleware/Chain](./07-middleware-chain.md) | [Về mục lục](./README.md) | [Tiếp: 🔌 Adapter →](./09-adapter.md)
