# 💎 SOLID Principles – Vũ Trụ Code Sạch, Học Vui & Nhớ Đời!

> **"Viết code chạy được chỉ là mức độ mầm non. Viết code mà 6 tháng sau đọc lại không muốn đập bàn phím mới là đắc đạo!"** 🧘‍♂️

Chào mừng bạn đến với cẩm nang **SOLID Principles** được biên soạn riêng cho backend **Node.js / TypeScript E-commerce**. Không có những định nghĩa hàn lâm khô khan gây buồn ngủ, ở đây chỉ có những câu chuyện "cười ra nước mắt", những hình ảnh đời thường siêu dễ nhớ và các pha "bẻ lái" cứu vãn code chết!

---

## ⚡ Tóm tắt 5 nguyên tắc trong 30 giây

| Ký tự | Tên đầy đủ | Hình ảnh ẩn dụ hài hước | Khẩu quyết sống còn |
| :---: |:---|:---|:---|
| **S** | **Single Responsibility**<br>*(Đơn trách nhiệm)* | 🔪 **Bộ dao làm bếp**<br>(Dao gọt hoa quả đừng đem đi chặt xương bò) | **"Một người - Một việc"**<br>Đừng biến class thành dao Thụy Sĩ 50 lưỡi! |
| **O** | **Open / Closed**<br>*(Mở rộng / Đóng sửa)* | 🦾 **Bộ giáp Iron Man**<br>(Muốn bay nhanh thì lắp thêm phản lực, đừng mổ tim Tony Stark) | **"Mở để thêm - Đóng để sửa"**<br>Thêm tính năng mới không được làm gãy code cũ! |
| **L** | **Liskov Substitution**<br>*(Thay thế Liskov)* | 🦆 **Con vịt cao su**<br>(Trông giống vịt, kêu quạc quạc nhưng chạy pin, thả nước là chập điện) | **"Con trai đừng làm bẽ mặt cha"**<br>Class con phải thay thế được class cha mà không làm sập app! |
| **I** | **Interface Segregation**<br>*(Phân tách Interface)* | 🍽️ **Ăn phở gọi món**<br>(Vào quán ăn tô phở, ai ép mua thêm vé buffet 1 triệu thì đấm cho) | **"Dùng gì gọi nấy"**<br>Đừng ép class implement hàm nó không bao giờ xài! |
| **D** | **Dependency Inversion**<br>*(Đảo ngược phụ thuộc)* | 🔌 **Ổ cắm & Phích cắm**<br>(Cắm quạt vào ổ điện tường, đừng hàn chết dây quạt vào mạng lưới điện quốc gia) | **"Dựa vào trừu tượng, chớ cắm đầu vào cụ thể"**<br>High-level không được quỳ lạy Low-level! |

---

## 📚 Mục lục bộ tài liệu

1. [🔪 01. S - Single Responsibility Principle (Đơn trách nhiệm)](./01-srp-single-responsibility.md)
   - *Bi kịch gã `OrderService` kiêm bảo vệ, kế toán, thủ kho và nhân viên phát tờ rơi.*
2. [🦾 02. O - Open/Closed Principle (Đóng & Mở)](./02-ocp-open-closed.md)
   - *Cơn ác mộng `switch-case` 500 dòng mỗi khi sếp đòi thêm cổng thanh toán MoMo/ZaloPay.*
3. [🦆 03. L - Liskov Substitution Principle (Thay thế Liskov)](./03-lsp-liskov-substitution.md)
   - *Khi chim cánh cụt bị ép nhảy dù từ tầng 10 vì danh xưng "loài chim".*
4. [🍽️ 04. I - Interface Segregation Principle (Phân tách Interface)](./04-isp-interface-segregation.md)
   - *Hợp đồng lao động ép lập trình viên kiêm biểu diễn xiếc và rửa bát.*
5. [🔌 05. D - Dependency Inversion Principle (Đảo ngược phụ thuộc)](./05-dip-dependency-inversion.md)
   - *Hôn nhân độc hại giữa Service và MongoDB: Ngày ly hôn là cả họ nhà code nhập viện.*
6. [🧭 99. SOLID Cheat Sheet & Bác Sĩ Bắt Bệnh Code](./99-solid-cheat-sheet.md)
   - *Tra cứu triệu chứng "mùi code" (Code Smell) → Kê đơn nguyên tắc SOLID & Design Pattern trị tận gốc!*

---

## 🗺️ Bản đồ: SOLID đang "sống" ở đâu trong Project E-commerce?

Nếu bạn mở code thật của dự án này ra, bạn sẽ thấy SOLID không phải lý thuyết suông mà đang âm thầm bảo vệ server khỏi sập mỗi đêm:

```
Ecommerce-NodeJS/
├── src/features/comments/                ← ⭐ Tuyệt phẩm SOLID: Clean Architecture
│   ├── domain/ (Entities & Interfaces)   ← 🔌 DIP & 🍽️ ISP: Chỉ chứa quy chuẩn trừu tượng
│   ├── application/ (Use cases)          ← 🔪 SRP: Mỗi use case làm đúng 1 nhiệm vụ
│   └── infrastructure/ (Mongo Repo)      ← 🦾 OCP & 🔌 DIP: Triển khai cụ thể, dễ tráo đổi
├── src/features/product/service/         ← 🦾 OCP: Product Factory Registry (thêm loại đồ mới không sửa core)
├── src/features/checkout/service/        ← 🔪 SRP: Tách riêng tính toán giá, voucher, trừ kho
├── src/middlewares/                      ← 🔪 SRP: Mỗi middleware bắt 1 loại lỗi, check 1 quyền
└── src/dbs/init.mongodb.ts               ← 🔌 DIP: Đóng gói connection, app không quan tâm driver kết nối thế nào
```

---

## 📜 Bài thơ lục bát "Thần Chú SOLID"

*(Học thuộc bài này đi phỏng vấn bao đậu, đi họp kiến trúc bao ngầu!)*

> 🌸 *Nghe vẻ nghe ve, nghe vè chữ **S**,*  
> *Một class một việc, chớ có ôm đồm.*  
> *Chữ **O** dặn dò, mở ra thêm mới,*  
> *Đóng chặt cửa sau, đừng sửa code mềm.*  
>  
> 🌿 *Chữ **L** êm đềm, cha sao con vậy,*  
> *Đừng làm cánh cụt, tập nhảy lao dốc.*  
> *Chữ **I** phân tách, vừa vặn menu,*  
> *Interface gọn, chẳng ép ai thừa.*  
>  
> ⚡ *Chữ **D** chốt hạ, đảo ngược dây tơ,*  
> *Cắm qua ổ cắm, chớ hàn chết dây!*  
> *Năm chữ trong tay, vững vàng code chuẩn,*  
> *Release thảnh thơi, ngủ thẳng tới trưa!* 🚀

---

👉 Bắt đầu ngay với **[Bài 1: S - Single Responsibility Principle](./01-srp-single-responsibility.md)** nào!
