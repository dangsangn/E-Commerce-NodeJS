# 🔌 Adapter Pattern

> ⚡ **Đọc 30 giây**
>
> - 🖼️ **Hình dung:** Cục chuyển đổi ổ cắm. Phích Việt cắm ổ Anh không vừa, chèn cục chuyển vào là xài được.
> - 🎯 **Dùng khi:** thư viện bên thứ 3 có interface không khớp với code của bạn, hoặc sợ sau này đổi provider.
> - 📁 **Trong project:** đề xuất cho `email.service.ts` (nodemailer) và upload (Cloudinary)

---

## 🎪 Câu chuyện vui

Bạn du lịch **Anh Quốc** 🇬🇧 mang theo sạc iPhone.

- Phích cắm iPhone: 🔌 Type A (2 chân dẹt)
- Ổ cắm ở Anh: 🇬🇧 Type G (3 chân vuông)

**Không cắm được!** 😱

Giải pháp? Mua **cục chuyển đổi (adapter)** ở sân bay:
- Đầu vào: nhận phích Type A
- Đầu ra: cắm vào ổ Type G

Bạn **không cần đổi sạc iPhone**, cũng **không cần đổi ổ cắm**. Chỉ cần 1 cục adapter ở giữa.

**Adapter = Cục chuyển đổi. Làm 2 thứ không tương thích hoạt động cùng nhau.**

---

## ❓ Khi nào dùng?

| ✅ Nên dùng | ❌ Không nên dùng |
|-------------|-------------------|
| Wrap 3rd-party library/API | Khi có thể sửa source code gốc |
| Tích hợp legacy code | Khi 2 interface giống nhau rồi |
| Chuẩn hoá interface khác nhau | Khi chỉ dùng 1 lần rồi bỏ |
| Đổi provider (payment, storage, email) | Over-engineering cho wrapper đơn giản |

---

## 💻 Code ví dụ

### Bài toán: Đổi cloud storage provider

Bạn đang dùng **AWS S3** upload ảnh. Sếp bảo: *"Đổi sang Cloudinary đi!"*

### ❌ Không có Adapter – Sửa mọi nơi gọi S3

```typescript
// 😱 Code cũ dùng S3 API trực tiếp – rải khắp nơi
// upload.service.ts
await s3.putObject({ Bucket: 'my-bucket', Key: 'photo.jpg', Body: file })

// product.service.ts
const url = s3.getSignedUrl('getObject', { Bucket: 'my-bucket', Key })

// media.service.ts
await s3.deleteObject({ Bucket: 'my-bucket', Key: 'old-photo.jpg' })

// Đổi sang Cloudinary? Sửa 20+ file! 💀
```

### ✅ Với Adapter – Chỉ sửa 1 chỗ

```typescript
// 📋 Interface chung – "Ổ cắm tiêu chuẩn"
interface IStorageAdapter {
  upload(file: Buffer, filename: string): Promise<{ url: string; key: string }>
  getUrl(key: string): Promise<string>
  delete(key: string): Promise<void>
}

// 🔌 Adapter 1: AWS S3
class S3StorageAdapter implements IStorageAdapter {
  private s3: AWS.S3

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: config.aws.accessKey,
      secretAccessKey: config.aws.secretKey,
    })
  }

  async upload(file: Buffer, filename: string) {
    const result = await this.s3.putObject({
      Bucket: config.aws.bucket,
      Key: `uploads/${filename}`,
      Body: file,
    }).promise()

    return {
      url: `https://${config.aws.bucket}.s3.amazonaws.com/uploads/${filename}`,
      key: `uploads/${filename}`,
    }
  }

  async getUrl(key: string) {
    return this.s3.getSignedUrl('getObject', {
      Bucket: config.aws.bucket,
      Key: key,
      Expires: 3600,
    })
  }

  async delete(key: string) {
    await this.s3.deleteObject({
      Bucket: config.aws.bucket,
      Key: key,
    }).promise()
  }
}

// 🔌 Adapter 2: Cloudinary
class CloudinaryStorageAdapter implements IStorageAdapter {
  constructor() {
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
    })
  }

  async upload(file: Buffer, filename: string) {
    const result = await cloudinary.uploader.upload_stream(file, {
      public_id: filename,
      folder: 'uploads',
    })
    return { url: result.secure_url, key: result.public_id }
  }

  async getUrl(key: string) {
    return cloudinary.url(key, { secure: true })
  }

  async delete(key: string) {
    await cloudinary.uploader.destroy(key)
  }
}

// 🔌 Adapter 3: Local filesystem (cho development)
class LocalStorageAdapter implements IStorageAdapter {
  async upload(file: Buffer, filename: string) {
    const path = `./uploads/${filename}`
    await fs.writeFile(path, file)
    return { url: `/static/${filename}`, key: filename }
  }

  async getUrl(key: string) {
    return `/static/${key}`
  }

  async delete(key: string) {
    await fs.unlink(`./uploads/${key}`)
  }
}
```

### 🧠 Sử dụng – Đổi provider trong 1 dòng!

```typescript
// Config-based selection
function createStorageAdapter(): IStorageAdapter {
  switch (config.storage.provider) {
    case 's3':         return new S3StorageAdapter()
    case 'cloudinary': return new CloudinaryStorageAdapter()
    case 'local':      return new LocalStorageAdapter()
    default:           return new LocalStorageAdapter()
  }
}

// Service dùng adapter – không biết provider nào!
class UploadService {
  constructor(private storage: IStorageAdapter) {}

  async uploadProductImage(file: Buffer, productId: string) {
    const filename = `product_${productId}_${Date.now()}.jpg`
    const { url, key } = await this.storage.upload(file, filename)
    //                          ↑ S3? Cloudinary? Local? Không biết, không quan tâm!
    return { url, key }
  }
}

// Đổi provider = đổi 1 dòng config!
// STORAGE_PROVIDER=cloudinary → toàn bộ app dùng Cloudinary
```

### 🧠 Luồng hoạt động

```
UploadService            IStorageAdapter           Cloudinary API
     │                         │                        │
     │  upload(file, name)     │                        │
     │ ───────────────────►    │                        │
     │                         │                        │
     │                   CloudinaryAdapter:             │
     │                   transform params               │
     │                         │  uploader.upload(...)   │
     │                         │ ──────────────────►     │
     │                         │       { secure_url }    │
     │                         │ ◄──────────────────     │
     │                   transform result                │
     │   { url, key }          │                        │
     │ ◄───────────────────    │                        │

  Service nói "upload" → Adapter dịch sang API cụ thể
  Giống cục chuyển đổi ổ cắm! 🔌
```

---

## 🔗 Ứng dụng trong project E-commerce

> 💡 **Nói thật:** project **chưa có** Adapter nào. Hai chỗ dưới đây đang gọi thẳng thư viện (Cloudinary, nodemailer). Đây là **đề xuất refactor**, và là chỗ tốt để tự tay luyện pattern này.

### 📁 `src/features/upload/` – Upload service (đề xuất)

```typescript
// Hiện tại dùng upload trực tiếp
// Có thể wrap bằng Adapter để dễ đổi provider:

// Trước: UploadService gọi thẳng cloudinary.uploader (v2)
// Sau:   storage.upload(file, name)  ← Adapter che giấu provider (Cloudinary, S3, R2...)
```

### 📁 `src/services/email.service.ts` – Email Adapter (đề xuất)

Hiện tại `EmailService` gọi thẳng `nodemailer.createTransport(...)`. Muốn đổi sang SendGrid hay Resend thì phải sửa từng hàm `sendOtpMail`, `sendResetPasswordOtpMail`... Bọc bằng Adapter thì chỉ cần đổi một dòng:

```typescript
// Email service có thể dùng Adapter cho các provider khác nhau
interface IEmailAdapter {
  send(to: string, subject: string, html: string): Promise<void>
}

class NodemailerAdapter implements IEmailAdapter {
  async send(to, subject, html) { /* nodemailer */ }
}

class SendGridAdapter implements IEmailAdapter {
  async send(to, subject, html) { /* sendgrid API */ }
}

class ResendAdapter implements IEmailAdapter {
  async send(to, subject, html) { /* resend API */ }
}
```

---

## ⚠️ Cạm bẫy

### 1. 🎭 Adapter che giấu quá nhiều
```typescript
// ❌ Adapter "nuốt" lỗi – khó debug
class S3Adapter implements IStorageAdapter {
  async upload(file: Buffer, name: string) {
    try {
      return await this.s3.putObject(...).promise()
    } catch (error) {
      return { url: '', key: '' }  // 😱 Lỗi mà trả về rỗng?
    }
  }
}

// ✅ Adapter nên throw lỗi có ý nghĩa
class S3Adapter implements IStorageAdapter {
  async upload(file: Buffer, name: string) {
    try {
      return await this.s3.putObject(...).promise()
    } catch (error) {
      throw new StorageError(`S3 upload failed: ${error.message}`, {
        provider: 's3',
        filename: name,
        originalError: error,
      })
    }
  }
}
```

### 2. 🤏 Interface quá hẹp hoặc quá rộng
```typescript
// ❌ Quá rộng – không phải provider nào cũng có tất cả features
interface IStorageAdapter {
  upload(file: Buffer, name: string): Promise<Result>
  delete(key: string): Promise<void>
  createBucket(name: string): Promise<void>      // Local không có bucket!
  setLifecyclePolicy(...): Promise<void>          // Chỉ S3 có!
  generatePresignedUrl(...): Promise<string>      // Cloudinary không có!
}

// ✅ Interface chỉ chứa operations chung
interface IStorageAdapter {
  upload(file: Buffer, name: string): Promise<Result>
  getUrl(key: string): Promise<string>
  delete(key: string): Promise<void>
}
// Features đặc biệt → optional interface hoặc method riêng
```

### 3. 🔀 Nhầm Adapter với Facade
```
Adapter:  Làm interface CŨ tương thích với interface MỚI (1 đối 1)
Facade:   Đơn giản hoá nhiều subsystem thành 1 interface (nhiều đối 1)

Adapter:  🔌 Cục chuyển đổi ổ cắm (1 phích → 1 ổ)
Facade:   🎛️ Remote TV (1 nút → điều khiển TV + soundbar + đèn)
```

---

## 📝 Ghi nhớ

> **"Adapter = Cục chuyển đổi ổ cắm. 2 thứ không tương thích → thêm adapter ở giữa → chạy ngon."** 🔌
>
> Nhớ 3 thứ:
> 1. **Interface chung** – "ổ cắm tiêu chuẩn" (upload, getUrl, delete)
> 2. **Adapter** – "cục chuyển đổi" (wrap API bên thứ 3)
> 3. **Đổi provider = đổi adapter** – Service không đổi gì!

---

## 🎯 Quick Quiz

**Q: Khi nào dùng Adapter, khi nào dùng Strategy?**

<details>
<summary>💡 Đáp án</summary>

Chúng trông giống nhau nhưng **mục đích khác**:

| | Adapter | Strategy |
|---|---|---|
| **Mục đích** | Làm interface KHÔNG TƯƠNG THÍCH → tương thích | Chọn giữa nhiều ALGORITHMS tương đương |
| **Vấn đề** | Interface khác nhau | Logic khác nhau |
| **Ví dụ** | S3 API ≠ Cloudinary API → cần adapter | Standard shipping ≠ Express shipping → chọn strategy |
| **Khi nào** | Tích hợp thứ 3 | Nhiều cách làm cùng 1 việc |

Thực tế, code có thể trông **giống hệt nhau** (interface + implementations). Khác biệt nằm ở **ý định**:
- Adapter: "Tôi cần wrap API này cho nó phù hợp"
- Strategy: "Tôi cần chọn cách tính phí ship"
</details>

---

[⬅️ Repository](./08-repository.md) | [Về mục lục](./README.md) | [Tiếp: 🛡️ Proxy →](./10-proxy.md)
