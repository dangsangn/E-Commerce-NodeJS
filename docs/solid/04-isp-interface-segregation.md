# 🍽️ I - Interface Segregation Principle (Phân Tách Interface)

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Bạn ghé quán phở chỉ muốn ăn **một tô phở bò 40k**. Nhưng chủ quán tuyên bố: *"Ở đây không bán lẻ! Anh muốn ăn phở thì phải mua combo ép buộc gồm: 1 tô phở + 1 đĩa ốc hương + 1 ly trà sữa trân châu + 1 con tôm hùm, tổng cộng 1 triệu 200k!"* 😱 Bạn có tức tối bỏ đi không? Trong code cũng vậy: Đừng ép một class phải "ăn" những method mà nó không bao giờ cần!
> - 🎯 **Định nghĩa chuẩn của Uncle Bob:** *"Clients should not be forced to depend upon interfaces that they do not use."* (Các client không nên bị ép buộc phải phụ thuộc vào những interface mà chúng không sử dụng).
> - 📁 **Trong project:** `src/features/comments/domain/`, các Repository interfaces và Service contracts.

---

## 🎪 Câu chuyện vui: Hợp đồng lao động "Bán thân cho tư bản"

Bạn ứng tuyển vào vị trí **Backend Node.js Developer** tại một công ty công nghệ nọ 💼.

Ngày đầu tiên nhận việc, phòng Nhân sự đưa cho bạn một bản hợp đồng lao động chuẩn của công ty mang tên:

```typescript
// File: IEmployee.ts (Interface khổng lồ ôm trọn cả tòa nhà)
export interface IEmployee {
  writeNodeJsCode(): Promise<void>;
  designFigmaUI(): Promise<void>;
  sweepOfficeFloor(): Promise<void>;    // Quét dọn sàn văn phòng
  guardParkingLot(): Promise<void>;     // Dắt xe và trông xe ca đêm
  performFireDance(): Promise<void>;    // Múa lửa văn nghệ tiệc Tất Niên 🔥
}
```

Vì muốn nhận lương, bạn cắn răng tạo class `BackendDeveloper implements IEmployee`:

```typescript
export class BackendDeveloper implements IEmployee {
  async writeNodeJsCode() {
    console.log('Viết API Express.js thần tốc...');
  }

  async designFigmaUI() {
    // Ơ kìa, tôi là backend mà, biết vẽ vời gì đâu?
    throw new Error('Tôi không biết dùng Figma!');
  }

  async sweepOfficeFloor() {
    // Để hàm rỗng cho qua ải TypeScript compiler vậy...
  }

  async guardParkingLot() {
    throw new Error('Tôi không biết dắt xe SH!');
  }

  async performFireDance() {
    throw new Error('Múa lửa phỏng mồm chết!');
  }
}
```

Ngày hôm sau, công ty tuyển thêm một bác **Bảo Vệ Ca Đêm (`SecurityGuard`)**. Bác bảo vệ cũng bị ép `implements IEmployee`. Thế là bác phải ngồi cặm cụi viết hàm `writeNodeJsCode()` bằng cách... ném lỗi hoặc để trống! 😵

**Tại sao bi kịch này xảy ra?**  
Bởi vì người thiết kế đã tạo ra một **"Fat Interface" (Interface béo phì)** gom tất cả các kỹ năng trên đời vào một chỗ, ép mọi nhân viên bất kể vai trò đều phải gánh vác!

---

## ❓ Dấu hiệu bạn đang tạo ra "Interface béo phì"

| 🚩 Mùi code (Code Smell) | 🩺 Căn bệnh tiềm ẩn |
| :---| :---|
| Interface có tới **15 - 30 methods** | Bạn đang tạo ra một bản hợp đồng nô lệ ép người ta làm mọi thứ. |
| Class con có nhiều hàm để rỗng `{}` | Class chỉ implement cho "vui lòng" TypeScript chứ không có nhu cầu dùng. |
| Class con ném ra: `throw new Error("Method not supported")` | Trùng với triệu chứng vi phạm LSP: Ép buộc kế thừa interface không phù hợp. |
| Sửa 1 hàm ở Interface khiến **10 class khác không liên quan** phải sửa theo | Sự ràng buộc độc hại (Tight coupling): Ai cũng bị vạ lây dù không xài hàm đó. |

---

## 💻 Code thực chiến: Node.js & TypeScript E-commerce

### ❌ Anti-pattern: Bản hợp đồng "Nô lệ" `IProductService`

Trong hệ thống E-commerce, ban đầu người ta nghĩ: *"Cứ là sản phẩm thì gộp chung hết vào một Interface cho tiện!"*:

```typescript
// 😱 Interface béo phì làm khổ mọi lập trình viên
export interface IProductOperations {
  // Sản phẩm thông thường (Vật lý: Quần áo, Sách, Giày dép)
  calculateShippingFee(address: string): number;
  trackShipment(trackingCode: string): string;
  reserveWarehouseStock(quantity: number): Promise<void>;

  // Sản phẩm số (Digital: Khóa học Online, Ebook, Nhạc mp3, Key bản quyền)
  generateDownloadLink(): string;
  streamVideoLecture(): void;
  verifyLicenseKey(key: string): boolean;
}
```

Hãy xem chuyện gì xảy ra khi bạn tạo class cho **Sách điện tử Ebook (Digital Product)**:

```typescript
export class EbookProduct implements IProductOperations {
  generateDownloadLink() {
    return 'https://shop.com/download/ebook-solid.pdf';
  }
  streamVideoLecture() { /* Không có video */ }
  verifyLicenseKey(key: string) { return true; }

  // 💥 NHỮNG THỨ ÁC MỘNG BẮT BUỘC PHẢI IMPLEMENT:
  calculateShippingFee(address: string): number {
    throw new Error('Ebook tải qua mạng, làm gì có tiền ship mà tính!');
  }
  trackShipment(trackingCode: string): string {
    throw new Error('Ebook không có shipper giao hàng!');
  }
  reserveWarehouseStock(quantity: number): Promise<void> {
    throw new Error('Ebook là file mềm trên Cloud, không có kho gạch đá!');
  }
}
```

> **Hậu quả khôn lường:**  
> Bất kỳ hàm nào vô tình gọi `ebook.calculateShippingFee()` sẽ khiến app giật nảy mình và văng Exception to đùng!

---

### ✅ Refactored: Chia nhỏ thực đơn (Role-based Interfaces)

Hãy chia nhỏ thành các Interface chuyên biệt theo đúng **năng lực thực tế** của từng loại sản phẩm:

```typescript
// 1. Năng lực cơ bản nhất: Sản phẩm nào cũng có
export interface IBaseProduct {
  readonly id: string;
  readonly name: string;
  readonly price: number;
}

// 2. Năng lực dành riêng cho hàng vật lý (Có giao hàng & kho bãi)
export interface IShippable {
  calculateShippingFee(address: string): number;
  trackShipment(trackingCode: string): string;
}

export interface IStockable {
  reserveWarehouseStock(quantity: number): Promise<void>;
}

// 3. Năng lực dành riêng cho hàng kỹ thuật số (Download & Bản quyền)
export interface IDownloadable {
  generateDownloadLink(): string;
}

export interface ILicensable {
  verifyLicenseKey(key: string): boolean;
}
```

Bây giờ, mỗi class chỉ cần **chọn đúng những gì mình thật sự có**:

```typescript
// ✅ 1. Chiếc Áo Thun (Hàng vật lý): Cần kho và cần ship
export class TShirtProduct implements IBaseProduct, IShippable, IStockable {
  constructor(public id: string, public name: string, public price: number) {}

  calculateShippingFee(address: string) { return 30000; }
  trackShipment(code: string) { return `Đang giao tới ${code}`; }
  async reserveWarehouseStock(qty: number) { console.log('Đã giữ hàng trong kho'); }
}

// ✅ 2. Cuốn Ebook PDF (Hàng số): Chỉ cần link tải, KHÔNG BỊ ÉP SHIP!
export class EbookProduct implements IBaseProduct, IDownloadable {
  constructor(public id: string, public name: string, public price: number) {}

  generateDownloadLink() {
    return 'https://cdn.shop.com/books/solid-made-easy.pdf';
  }
}
```

> 🎯 **Lợi ích:**
> - Module giao hàng (Shipping Module) chỉ cần nhận `IShippable`. Truyền `EbookProduct` vào TypeScript sẽ báo lỗi ngay từ lúc gõ phím, không bao giờ để lọt bug lên Production!
> - Module tải file chỉ cần nhận `IDownloadable`.
> - Code thanh thoát, sạch đẹp, không một dòng thừa thãi!

---

## 🔍 Trong project E-commerce này nằm ở đâu?

Hãy nhìn vào cách thiết kế **Repository và Service** trong project này:

Thay vì tạo một `IRepository` khổng lồ làm mọi việc từ đọc, ghi, xóa mềm, xóa cứng, xuất Excel, cache Redis... Team dự án tách biệt:
- **`IReader<T>`**: Chỉ chứa `findById`, `findAll`. Dành cho các service báo cáo chỉ có nhu cầu đọc (Read-only).
- **`IWriter<T>`**: Chứa `create`, `update`, `delete`.
- Trong `src/features/comments/domain/repositories/comment.repository.interface.ts`:
  Interface chỉ định nghĩa đúng 4 hàm phục vụ bình luận lồng nhau (`createComment`, `getCommentsByParentId`, `deleteComment`). Tuyệt đối không nhét hàm `uploadAvatarCommentUser()` hay `sendEmailNotification()` vào đây!

---

## ⚠️ Cạm bẫy cần tránh: "Băm nhỏ đến mức điên cuồng"

> 🚨 **Căn bệnh "Mỗi hàm một Interface":**  
> ISP không xui bạn tạo ra:
> - `IHasName { getName(); }`
> - `IHasPrice { getPrice(); }`
> - `IHasId { getId(); }`  
> 
> Đừng biến codebase thành một mê cung 500 interface mỗi cái 1 dòng code!  
> **Nguyên tắc:** Gom các phương thức **phục vụ cùng một mục đích và luôn đi cùng nhau** vào chung một Interface.

---

## 💡 Câu ghi nhớ nhập tâm

> 🍽️ *"Vào quán ăn tô phở thì chỉ trả tiền tô phở. Đừng ép class ký vào bản hợp đồng làm nô lệ cho những thứ nó không xài!"*

---

## 🎯 Quick Quiz: Trắc nghiệm phản xạ!

**Câu hỏi:** Giả sử bạn có một interface `ILogger`:
```typescript
interface ILogger {
  log(message: string): void;
  error(message: string): void;
  sendAlertToTelegram(message: string): Promise<void>;
  uploadLogToS3Bucket(filePath: string): Promise<void>;
}
```
Lớp `ConsoleLogger` (chỉ in log ra terminal khi chạy local) implement `ILogger` này thì có vi phạm ISP không?

- **A.** Không vi phạm, có thêm Telegram với S3 càng xịn.
- **B.** Vi phạm nghiêm trọng! Vì `ConsoleLogger` chạy local không có tài khoản Telegram bot và AWS S3, buộc phải viết hàm rỗng hoặc ném lỗi.

<details>
<summary>👉 Bấm vào đây để xem đáp án</summary>

**Đáp án chính xác: B!** 🎯  
`ConsoleLogger` chỉ cần ghi log ra console. Việc gửi Telegram và upload S3 là các trách nhiệm phụ nâng cao. Nên tách thành `IAlertNotifier` và `ILogArchiver`!
</details>

---

Chào đón "Trùm cuối" của SOLID: **[Bài 5: D - Dependency Inversion Principle](./05-dip-dependency-inversion.md)** 🔌!
