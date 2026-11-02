# 🧭 SOLID Cheat Sheet & Bác Sĩ Bắt Bệnh Code

> **"Không có code xấu bẩm sinh, chỉ có code chưa được uống thuốc SOLID mà thôi!"** 💊🩺

Tài liệu này là cuốn sổ tay tóm tắt giúp bạn tra cứu nhanh khi review code, khi nghi ngờ "code có mùi", hoặc khi chuẩn bị bước vào các buổi phỏng vấn kiến trúc phần mềm!

---

## 🩺 Bảng tra cứu: Triệu chứng → Bệnh lý → Kê đơn SOLID

Khi bạn mở một file code và ngửi thấy mùi "bất ổn", hãy tra bảng dưới đây:

| Triệu chứng thấy trên màn hình (Mùi code) | Căn bệnh tiềm ẩn | Nguyên tắc bị chà đạp | Thuốc điều trị (Design Pattern) |
| :---| :---| :---: | :---|
| File dài hơn **500 dòng**, làm từ tính tiền, trừ kho đến gửi mail | God Object / Bốc vác toàn năng | **S** (Single Responsibility) | **[Facade Pattern](../design-patterns/15-facade.md)**, **[Repository](../design-patterns/08-repository.md)** |
| Một chuỗi **`switch-case`** hoặc **`if-else`** dài ngoằng theo `type` | Nỗi sợ hồi quy mỗi khi thêm tính năng | **O** (Open/Closed) | **[Strategy Pattern](../design-patterns/05-strategy.md)**, **[Factory Method](../design-patterns/03-factory-method.md)** |
| Class con ghi đè hàm cha bằng: `throw new Error("Not supported")` | Con hư làm bẽ mặt cha, phá vỡ tính đa hình | **L** (Liskov Substitution) | **Composition over Inheritance**, Tách Interface nhỏ |
| Phải viết `if (obj instanceof Con)` trước khi gọi hàm | Nghi ngờ lớp con làm phản | **L** (Liskov Substitution) | Refactor abstraction, chuẩn hóa hợp đồng |
| Interface to đùng có 20 methods, class implement phải để hàm rỗng `{}` | Ép buộc ký hợp đồng nô lệ | **I** (Interface Segregation) | **Role-based Interfaces**, **[Adapter Pattern](../design-patterns/09-adapter.md)** |
| Trong Service nghiệp vụ trực tiếp gõ `new MongoModel()` hoặc `new AWS.SES()` | Hàn chết nghiệp vụ vào công cụ hạ tầng | **D** (Dependency Inversion) | **[Dependency Injection](../design-patterns/17-dependency-injection.md)**, Inversion of Control |
| Không thể viết Unit Test nếu không cắm dây mạng bật Database thật | Code bị bắt làm con tin của cơ sở dữ liệu | **D** (Dependency Inversion) | Mock / Stub qua Interface |

---

## 🤝 Mối quan hệ mật thiết: SOLID kết hợp Design Patterns thế nào?

Nếu **SOLID** là các **Nguyên tắc đạo đức / Luật giao thông** thì **Design Patterns** chính là các **Chiếc xe mẫu** được thiết kế đúng luật:

```
        ┌────────────────────────────────────────────────────────┐
        │                 SOLID (Triết lý cốt lõi)               │
        └───────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
        ┌────────────────────────────────────────────────────────┐
        │            DESIGN PATTERNS (Giải pháp thực thi)        │
        └────────────────────────────────────────────────────────┘

  • Chữ S (Single Responsibility) ──► 🏨 Facade, 📚 Repository, ✈️ Middleware
  • Chữ O (Open / Closed)         ──► 🛵 Strategy, 🥤 Factory, 🧋 Decorator
  • Chữ L (Liskov Substitution)   ──► 🍜 Template Method, 📦 Composite
  • Chữ I (Interface Segregation) ──► 🔌 Adapter, Phân tách Role-Interface
  • Chữ D (Dependency Inversion)  ──► 🔋 Dependency Injection, Service Locator
```

👉 *Hãy đọc song song bộ tài liệu **[🎨 Design Patterns](../design-patterns/README.md)** trong repo để làm chủ trọn vẹn cả Lý thuyết lẫn Tuyệt kỹ thực chiến!*

---

## ⚡ 5 Câu khẩu quyết "Bỏ túi" (One-liner Cheat Sheet)

1. **S - Single Responsibility:** *"Một class chỉ nên có đúng một lý do để thay đổi (phục vụ đúng một nhóm người dùng)."*
2. **O - Open/Closed:** *"Hãy tạo ra hệ thống mở để cắm thêm plugin, đóng chặt cửa không cho sửa code cũ."*
3. **L - Liskov Substitution:** *"Nếu gọi điện cho Giám đốc mà Thư ký nghe máy, Thư ký phải xử lý được công việc y như Giám đốc mà không làm sập công ty!"*
4. **I - Interface Segregation:** *"Menu gọi món ăn gì trả tiền nấy, cấm ép khách mua combo buffet 100 món."*
5. **D - Dependency Inversion:** *"Đừng hàn chết dây điện vào tường, hãy cắm qua ổ cắm tiêu chuẩn."*

---

## 🎓 5 Câu hỏi Phỏng vấn SOLID "Kinh điển" & Cách trả lời đỉnh cao

### Câu 1: Em hãy phân biệt sự khác nhau giữa DIP, DI và IoC Container?
> **Trả lời ghi điểm:**  
> - **DIP (Dependency Inversion Principle):** Là **nguyên tắc thiết kế** ở mức trừu tượng, khuyên rằng module cấp cao không nên phụ thuộc vào module cấp thấp, cả hai cùng phụ thuộc vào Interface.
> - **DI (Dependency Injection):** Là **kỹ thuật cụ thể** để hiện thực hóa DIP bằng cách truyền các dependency vào class từ bên ngoài (thường qua Constructor) thay vì tự `new` bên trong.
> - **IoC Container:** Là **công cụ/framework** (như InversifyJS, NestJS) giúp tự động hóa việc khởi tạo, quản lý vòng đời và tiêm (inject) các dependency đó thay vì ta phải `new` bằng tay.

---

### Câu 2: Trong JavaScript / TypeScript, làm thế nào để áp dụng OCP mà không cần kế thừa phức tạp?
> **Trả lời ghi điểm:**  
> Trong hệ sinh thái TypeScript/Node.js, ta không nhất thiết phải dùng kế thừa `class` cồng kềnh. Cách phổ biến và hiện đại nhất là dùng **Strategy Pattern kết hợp Object Lookup / Map Registry** hoặc **Higher-Order Functions / Middlewares**.  
> Ví dụ: Thay vì `switch(type)`, ta dùng một `Map<string, StrategyFn>` cho phép đăng ký hàm xử lý mới từ bên ngoài bất kỳ lúc nào mà không sửa code cũ.

---

### Câu 3: Cho ví dụ về một trường hợp tưởng chừng đúng ngoài đời nhưng lại vi phạm Liskov trong lập trình?
> **Trả lời ghi điểm:**  
> Ví dụ kinh điển là **Hình chữ nhật (Rectangle) và Hình vuông (Square)**. Ngoài đời, hình vuông là hình chữ nhật đặc biệt có 2 cạnh bằng nhau. Nhưng nếu cho `Square extends Rectangle`, hàm `setWidth()` của Square sẽ buộc phải thay đổi cả chiều cao để giữ tính vuông. Điều này phá vỡ giả định của người gọi Rectangle rằng: *"Đổi chiều rộng thì chiều cao không được phép đổi"*, dẫn đến tính toán diện tích bị sai lệch.

---

### Câu 4: Một class có quá nhiều method có chắc chắn vi phạm SRP không?
> **Trả lời ghi điểm:**  
> Không hẳn. Số lượng method không phải là thước đo duy nhất của SRP. Nếu một class có 10 methods nhưng tất cả 10 methods đó đều **phục vụ cùng một mục đích nghiệp vụ duy nhất** và **chỉ thay đổi khi một bên duy nhất yêu cầu** (ví dụ: `MathUtils` hoặc `TokenManager`), thì nó vẫn thỏa mãn SRP.  
> Vi phạm SRP chỉ xảy ra khi class chứa các method phục vụ cho **nhiều phòng ban / nhiều tác nhân khác nhau** (ví dụ: vừa tính tiền cho Kế toán, vừa gửi mail cho Marketing, vừa query DB cho Hạ tầng).

---

### Câu 5: Có nên áp dụng triệt để SOLID cho mọi dòng code từ ngày đầu tiên làm dự án không?
> **Trả lời ghi điểm (Thể hiện sự trưởng thành của Senior):**  
> **Tuyệt đối không!** Áp dụng SOLID quá đà ngay từ đầu khi chưa hiểu rõ bài toán sẽ dẫn đến bẫy **Over-engineering** và vi phạm nguyên tắc **YAGNI (You Aren't Gonna Need It)**: Sinh ra quá nhiều interface, class rỗng, file vụn vặt gây khó đọc và tốn thời gian.  
> Lộ trình đúng đắn là:  
> 1. Giai đoạn MVP: Viết code đơn giản, chạy đúng nghiệp vụ trước.  
> 2. Khi hệ thống bắt đầu có yêu cầu mở rộng, hoặc nhận thấy dấu hiệu "code có mùi" (lặp code, if-else phình to), ta mới tiến hành **Refactor có chủ đích** dựa trên các nguyên tắc SOLID tương ứng!

---

🎉 **CHÚC MỪNG BẠN ĐÃ TỐT NGHIỆP KHÓA HỌC SOLID PHIÊN BẢN HÀI HƯỚC & THỰC CHIẾN!** 🚀  
*Hãy áp dụng ngay vào pull request tiếp theo để biến code của bạn thành tác phẩm nghệ thuật nhé!*
