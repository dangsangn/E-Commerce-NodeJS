# ☕ Singleton Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Quán cà phê chỉ có **một** máy espresso 200 triệu. Nhân viên nào cũng xài chung, không ai tự mua thêm máy.
> - 🎯 **Dùng khi:** tài nguyên đắt, cả app dùng chung: DB connection, logger, config, cache trong RAM.
> - 📁 **Trong project:** `src/dbs/init.mongodb.ts`, `src/features/rbac/services/access-control.service.ts`

---

## 🎪 Câu chuyện vui

Tưởng tượng bạn mở **một quán cà phê** ☕.

Quán có **1 máy pha espresso** giá 200 triệu. Mỗi nhân viên cần pha cà phê thì đều dùng **cùng một máy** đó. Không ai đi mua thêm máy mới mỗi lần có khách đặt.

Nếu mỗi nhân viên tự mua máy riêng → **200 triệu × 10 nhân viên = 2 tỷ** 💸 (và quán thì hết chỗ để máy).

**Singleton = Máy pha espresso duy nhất. Ai cần thì đến xài chung.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Database connection pool | Đối tượng có state khác nhau mỗi request |
| Logger instance | User session (mỗi user khác nhau!) |
| Config/Environment loader | Đối tượng nhẹ, tạo mới không tốn gì |
| Cache manager | Khi cần test isolation (mock khó) |

---

## 💻 Code ví dụ

### ❌ Không có Singleton – Mỗi lần import = 1 connection mới

```typescript
// 😱 Mỗi file import = 1 connection mới → server die
class Database {
  constructor() {
    this.connect()  // Gọi connect() mỗi lần new!
  }

  connect() {
    mongoose.connect(uri)  // Mở connection thứ 100... 💀
  }
}

// file A: const db = new Database()  → connection #1
// file B: const db = new Database()  → connection #2
// file C: const db = new Database()  → connection #3
// ... MongoDB: "Ơ, sao 100 connections vậy trời?" 😵
```

### ✅ Với Singleton – Luôn chỉ có 1 instance

```typescript
class Database {
  constructor() {
    this.connect()
  }

  connect() {
    mongoose.connect(connectString)
      .then(() => logger.info('Connected to MongoDB'))
      .catch((err) => logger.error('Error connecting to MongoDB', { err }))
  }

  // 🔑 Biến static lưu instance duy nhất
  private static _instance: Database

  // 🔑 "Cổng vào" duy nhất – luôn trả về cùng 1 instance
  static getInstance(): Database {
    if (!Database._instance) {
      Database._instance = new Database()
    }
    return Database._instance
  }

  close() {
    mongoose.connection.close()
  }
}

// Dù import ở 100 file → luôn cùng 1 instance, 1 connection
const instanceMongoDB = Database.getInstance()
export default instanceMongoDB
```

### 🧠 Giải thích từng bước

```
Lần gọi 1: Database.getInstance()
  → _instance === undefined? ✅ → Tạo mới, lưu vào _instance
  → Trả về _instance (instance #1)

Lần gọi 2: Database.getInstance()
  → _instance === undefined? ❌ → Đã có rồi!
  → Trả về _instance (vẫn instance #1) ← CÙNG MỘT THẰNG!

Lần gọi 100: Database.getInstance()
  → Vẫn instance #1 ← VẪN CÁI MÁY ĐÓ ☕
```

---

## 🔗 Chỗ nào dùng trong project?

📁 **`src/dbs/init.mongodb.ts`**

```typescript
// Đây là Singleton thực tế trong project!
const instanceMongoDB = Database.getInstance()
export default instanceMongoDB
```

Mỗi file trong project `import instanceMongoDB` → đều nhận **cùng một connection**, không tạo connection mới.

Ví dụ trong `app.ts`:
```typescript
import instanceMongoDB from './dbs/init.mongodb'
// ...
instanceMongoDB  // Chỉ cần gọi → connection đã sẵn sàng
```

---

## ⚠️ Cạm bẫy

### 1. 🧪 Test khó mock
```typescript
// Singleton giữ state giữa các test → test bị "nhiễm" lẫn nhau
// Fix: Thêm method reset cho test environment
static resetInstance() {
  if (process.env.NODE_ENV === 'test') {
    Database._instance = undefined as any
  }
}
```

### 2. 🧵 Race condition, nhưng là kiểu của Node.js

Node.js chạy JavaScript trên **một luồng**, nên bản `getInstance()` đồng bộ ở trên **an toàn**: không có hai "thread" nào cùng chen vào `if` được.

Rắc rối chỉ xuất hiện khi việc khởi tạo là **async**, vì mỗi `await` là một lần "nhường lượt" cho request khác:

```typescript
// ❌ Bẫy 1: chờ xong mới gán → 2 request cùng thấy "chưa có"
static async getInstance() {
  if (!this._instance) {
    const data = await loadFromDB()     // ⏸️ request B chen vào đây, cũng thấy chưa có
    this._instance = new Thing(data)    // → load DB 2 lần, tạo 2 instance 😱
  }
  return this._instance
}

// ❌ Bẫy 2: gán trước rồi mới chờ → request B nhận instance CHƯA SẴN SÀNG
static async getInstance() {
  if (!this._instance) {
    this._instance = new Database()
    await this._instance.connect()      // ⏸️ B chen vào, thấy _instance có rồi → dùng luôn 💥
  }
  return this._instance
}
```

✅ **Fix: lưu cái *Promise* đang chạy, ai đến sau thì chờ chung promise đó.** Project đã làm đúng kiểu này trong `src/features/rbac/services/access-control.service.ts`:

```typescript
private static _ac: AccessControl | null = null              // kết quả đã xong
private static _building: Promise<AccessControl> | null = null // "đang nấu, chờ chút"

static getAccessControl = async () => {
  if (AccessControlService._ac) return AccessControlService._ac              // có rồi → trả
  if (AccessControlService._building) return AccessControlService._building  // đang tạo → chờ chung

  AccessControlService._building = (async () => {
    try {
      const grantList = await AccessControlService.buildFromDB()
      AccessControlService._ac = new AccessControl(grantList)
      return AccessControlService._ac
    } finally {
      AccessControlService._building = null   // lỗi thì lần sau thử lại
    }
  })()
  return AccessControlService._building
}

// Bonus: sửa role xong thì "cho máy cũ nghỉ hưu", lần gọi sau tự lắp máy mới ☕
static invalidate = () => { AccessControlService._ac = null }
```

100 request đến cùng lúc → **1 lần** đọc DB, 99 request còn lại đứng chờ chung một mẻ cà phê ☕.

### 3. 🤢 Lạm dụng Singleton = Global state ẩn
```typescript
// ❌ ĐỪNG biến mọi thứ thành Singleton
class UserService {  // ← Service KHÔNG nên là Singleton
  private currentUser: User  // State khác nhau mỗi request!
  static getInstance() { ... }
}

// ✅ Singleton chỉ cho resource THẬT SỰ shared và stateless
// Database connection, Logger, Config → OK
// UserService, CartService → KHÔNG OK
```

---

## 📝 Ghi nhớ

> **"Singleton = Máy espresso của quán. Mua đúng một lần, cả quán xài chung."** ☕
>
> Nhớ 3 thành phần:
> 1. `private static _instance`: "cái máy" đang đặt trên quầy
> 2. `static getInstance()`: "ra quầy lấy máy" (chưa có thì mua, có rồi thì xài)
> 3. Constructor thường là `private`: cấm nhân viên tự mua máy riêng 🙅

---

## 🎯 Quick Quiz

**Q: Đoạn code sau có phải Singleton không?**
```typescript
const config = {
  port: 3000,
  dbUrl: 'mongodb://localhost'
}
export default config
```

<details>
<summary>💡 Đáp án</summary>

**Đúng rồi!** 🎉 Đây là **Module Singleton** – cách đơn giản nhất trong Node.js.

Module system của Node.js cache module sau lần `require`/`import` đầu tiên. Mỗi file import `config` đều nhận **cùng một object**.

Đây là "Singleton tự nhiên" – không cần class, không cần `getInstance()`. Chỉ dùng class Singleton khi cần kiểm soát thêm (lazy init, async connect, v.v.)
</details>

---

[⬅️ Về mục lục](./README.md) | [Tiếp: 🥤 Simple Factory →](./02-simple-factory.md)
