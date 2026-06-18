# Redis Pub/Sub — Lý thuyết, luồng chạy & cách test

> Tài liệu giải thích Redis Pub/Sub từ lý thuyết đến cách nó chạy trong repo này (`PubSubService`, cache invalidation của RBAC), kèm các bước test cụ thể.
>
> Ngày tạo: 2026-06-18 · Liên quan: [user-rbac-implementation-guide.md](user-rbac-implementation-guide.md)

---

## 1. Lý thuyết: Pub/Sub là gì?

**Pub/Sub (Publish/Subscribe)** là một *messaging pattern* để **giao tiếp bất đồng bộ, lỏng lẻo (decoupled)** giữa các thành phần:

- **Publisher** — bên *gửi* message. Nó **không biết** ai đang nghe, có bao nhiêu người nghe.
- **Subscriber** — bên *nhận* message. Nó **không biết** ai gửi.
- **Channel** (kênh) — "địa chỉ" trung gian. Publisher gửi *vào channel*, subscriber *đăng ký channel*. Message được **fan-out** (phát tán) tới **tất cả** subscriber của channel đó.

```
                    ┌──────────────┐
   Publisher ──────►│   Channel    │──────► Subscriber A
   (PUBLISH)        │ "rbac:invalidate"      Subscriber B
                    └──────────────┘──────► Subscriber C
                          (Redis)
```

**Điểm cốt lõi**: publisher và subscriber **không gọi nhau trực tiếp**. Đây là "loose coupling" — thêm/bớt subscriber không cần sửa publisher. Đó là lý do pub/sub hợp cho việc "thông báo cho mọi instance".

### So sánh nhanh với hàng đợi (queue)

| | **Pub/Sub** (Redis) | **Message Queue** (RabbitMQ/Kafka — repo đã có) |
|---|---|---|
| Số người nhận 1 message | **Tất cả** subscriber (fan-out) | Thường **1** consumer lấy (work queue) |
| Lưu trữ | **Không** — gửi xong là quên | **Có** — message nằm đợi tới khi được xử lý |
| Subscriber offline lúc gửi | **Mất message** | Vẫn nhận khi online lại |
| Ack / retry | Không | Có |
| Dùng khi | Thông báo realtime, invalidate cache, fan-out sự kiện | Xử lý tác vụ nền, đảm bảo không mất việc (đặt hàng, gửi mail) |

> Quy tắc chọn: cần **đảm bảo xử lý đúng-một-lần, không mất** → dùng queue (Rabbit/Kafka). Cần **báo nhanh cho tất cả, mất 1 message không sao** → dùng pub/sub.

---

## 2. Đặc tính Redis Pub/Sub bạn BẮT BUỘC phải nhớ

1. **At-most-once delivery (gửi nhiều nhất 1 lần)**: Redis **không lưu** message. Nếu lúc `PUBLISH` mà subscriber chưa kết nối / chưa `SUBSCRIBE` → message **bay luôn**, không ai nhận.
   → Hệ quả thiết kế: với cache invalidate, ta để thêm **TTL** làm lưới an toàn (lỡ miss event thì tối đa TTL sau cũng tự rebuild). Xem `AccessControlService` trong RBAC guide.

2. **Subscribe phải xảy ra TRƯỚC publish.** Thứ tự thời gian quan trọng.

3. **Một connection đang "subscribe mode" thì không chạy được lệnh thường** (GET/SET/PUBLISH...). Đây là giới hạn của giao thức RESP2.
   → Đó chính là lý do file `src/utils/redis.util.ts` tạo **hai** client:
   ```ts
   const pubClient = createClient(redisConfig)
   const subClient = pubClient.duplicate() // bản sao cùng config, dùng riêng để subscribe
   ```
   `pubClient` để PUBLISH + các lệnh GET/SET/DEL (cache). `subClient` chỉ để SUBSCRIBE.

4. **Pattern subscribe**: ngoài `SUBSCRIBE channel` còn có `PSUBSCRIBE pattern` (vd `rbac:*`) để nghe nhiều channel theo wildcard.

5. **Mỗi process/instance phải tự subscribe.** Pub/sub fan-out tới các *connection* đang nghe; mỗi instance Node là một connection riêng → mỗi instance phải gọi `subscribe` của riêng nó lúc khởi động.

---

## 3. Luồng chạy trong repo này

### 3.1 Hạ tầng đã có

- `src/utils/redis.util.ts` — tạo `pubClient`, `subClient`, hàm `initRedis()` (gọi `.connect()` cả hai).
- `src/services/pubsub.service.ts` — `PubSubService` bọc `publish()` / `subscribe()` (tự `JSON.stringify` nếu message là object).
- `src/routes/test.route.ts` — 2 endpoint demo: `GET /test/subscribe/:channel`, `POST /test/publish/:channel`.
- `server.ts` — gọi `initRedis()` trong `startServer()`.

> ⚠️ **Quan trọng**: `initRedis()` được gọi ở `server.ts`, **không** ở `app.ts`. Mọi việc `publish/subscribe` chỉ chạy được **sau** khi `initRedis()` hoàn tất (client `.isOpen === true`). Nếu bạn publish trước đó → lỗi hoặc message rơi.

### 3.2 PubSubService (wrapper)

```ts
// src/services/pubsub.service.ts
class PubSubService {
  async publish(channel: string, message: any) {
    const payload = typeof message === 'string' ? message : JSON.stringify(message)
    await pubClient.publish(channel, payload)        // dùng pubClient
  }
  async subscribe(channel: string, callback: (message: string) => void) {
    await subClient.subscribe(channel, (message) => callback(message)) // dùng subClient
  }
}
```

### 3.3 Luồng demo qua test route

```
[Terminal server]                         [Client / curl]
GET /test/subscribe/news ───────────────► subClient.SUBSCRIBE "news"
   (server giờ đang lắng nghe channel "news")

                                          POST /test/publish/news {message:"hi"}
                                          └► pubClient.PUBLISH "news" "hi"
[Sub] Receive message hi from chanel news ◄┘  (callback chạy, log ra terminal)
```

### 3.4 Luồng thực tế: invalidate cache RBAC giữa 2 instance

Đây là lý do chính ta dùng pub/sub. Giả sử chạy 2 instance (A cổng 3000, B cổng 3001), cả hai đã `subClient.subscribe('rbac:invalidate')` lúc khởi động:

```
Admin gọi PUT /rbac/roles/:id (rơi vào Instance A)
        │
        ▼
[A] RoleModel.findByIdAndUpdate(...)         ① ghi MongoDB (nguồn sự thật)
        │
        ▼
[A] AccessControlService.invalidate()
     ├─ _ac = null                            ② xoá cache L1 của chính A
     ├─ pubClient.del('rbac:grants')          ③ xoá cache L2 (Redis, dùng chung)
     └─ pubClient.publish('rbac:invalidate')  ④ phát tín hiệu
                                                │  fan-out
            ┌───────────────────────────────────┴───────────────┐
            ▼                                                     ▼
[A] subClient nhận → _ac = null (đã null)        [B] subClient nhận → _ac = null   ⑤ B drop L1
            │                                                     │
            ▼                                                     ▼
 Request kế tiếp ở A: L1 miss → L2 miss → build lại từ Mongo, set lại L1+L2
 Request kế tiếp ở B: y hệt → cả hai instance nhất quán
```

**Không có bước ④–⑤ (pub/sub)** thì B vẫn giữ `_ac` cũ trong RAM → user bị phân quyền theo grant lỗi thời cho tới khi B restart hoặc TTL hết. Đó là "bug stale cache giữa các instance".

### 3.5 Đăng ký listener đúng chỗ

Vì `initRedis()` nằm ở `server.ts`, hãy đăng ký listener RBAC **ngay sau đó** (không phải trong `app.ts`):

```ts
// server.ts
import AccessControlService from './src/features/rbac/services/access-control.service'

const startServer = async () => {
  try {
    await initRedis()                                  // connect trước
    await AccessControlService.initInvalidationListener() // rồi mới subscribe
  } catch (error) {
    console.error('Failed to start server:', error)
  }
}
```

### 3.6 Khi nào CHƯA cần pub/sub? (rất quan trọng)

Pub/sub chỉ giải quyết bài toán **đồng bộ giữa nhiều process**. Nếu bạn **chỉ chạy 1 process** thì **không cần** nó.

**Hiểu lầm phổ biến**: "nhiều user liên tục gọi API ở 1 port → cần pub/sub". **Sai.** Nhiều request vào *cùng 1 process* đều dùng chung biến cache trong RAM của process đó; process vừa-ghi-vừa-đọc nên tự biết cache bẩn (`_ac = null` trực tiếp). Không có "process khác" để mà báo.

| Tình huống deploy | Số process | Cần pub/sub? |
|---|---|---|
| `node server.ts` / `nodemon` 1 tiến trình (vd chỉ port 5000) | 1 | ❌ Không — chỉ cần L1 in-memory + single-flight |
| **PM2 cluster** `pm2 start -i 4` | 4 | ✅ Có — 4 vùng RAM riêng |
| Nhiều container/pod sau load balancer | N | ✅ Có |
| Docker compose master/slave nhiều app instance | N | ✅ Có |

> **Số process ≠ số port.** "1 port 5000" vẫn có thể là nhiều process (PM2 cluster) → vẫn cần pub/sub. Chỉ **đúng 1 process** mới bỏ được.

Với 1 process, cái cần lo ở traffic cao không phải pub/sub mà là **cache stampede** (nhiều request cùng rebuild khi cache trống) → giải bằng **single-flight** (xem `AccessControlService` bản mặc định trong [RBAC guide](user-rbac-implementation-guide.md), Step 1.5c). Khi scale lên ≥2 process thì mới bật L2 Redis + pub/sub — chỉ thêm code, không phải viết lại.

---

## 4. Các bước TEST (từ dễ → sát thực tế)

### Cách 1 — Thuần Redis bằng `redis-cli` (hiểu bản chất nhất)

Mở **2 terminal** trỏ vào Redis của bạn (mặc định repo dùng `redis://localhost:6380`):

```bash
# Terminal 1 — subscriber
redis-cli -p 6380
> SUBSCRIBE demo
# đang chờ...

# Terminal 2 — publisher
redis-cli -p 6380
> PUBLISH demo "hello"
(integer) 1     # số 1 = có 1 subscriber nhận được

# Quay lại Terminal 1 sẽ thấy:
# 1) "message"
# 2) "demo"
# 3) "hello"
```

> Thử nghiệm "mất message": PUBLISH **trước** khi SUBSCRIBE → terminal 1 không nhận gì. Đó là at-most-once.
> Thử `PSUBSCRIBE rbac:*` rồi `PUBLISH rbac:invalidate 1` để thấy pattern subscribe.

### Cách 2 — Qua app, dùng route test có sẵn

Chạy server: `npm run dev`. Đảm bảo log có `Redis connect successfully`.

```bash
# 1) subscribe (gọi 1 lần) — header x-api-key vì router global yêu cầu
curl "http://localhost:3000/api/v1/test/subscribe/news" -H "x-api-key: <API_KEY>"

# 2) publish
curl -X POST "http://localhost:3000/api/v1/test/publish/news" \
  -H "x-api-key: <API_KEY>" -H "Content-Type: application/json" \
  -d '{"message":"xin chao"}'
```
Quan sát terminal server: `[Sub] Receive message xin chao from chanel news` và `HANDLED MESSAGE: xin chao`.

> `<API_KEY>` lấy từ collection `ApiKeys` (chạy `npm run migrate:apikeys` nếu chưa có). Toàn bộ `/api/v1/*` đi qua middleware `apiKey` + `permission(['0000'])`.

### Cách 3 — Test multi-instance (sát thực tế nhất, dùng cho RBAC)

Mục tiêu: chứng minh sửa role ở instance A làm instance B drop cache.

```bash
# Terminal A
PORT=3000 npm run dev
# Terminal B (cùng Redis, cùng Mongo)
PORT=3001 npm run dev
```
1. Gọi một API có `grantAccess` ở **cả A và B** một lần (để mỗi instance build & cache `_ac`).
2. Gọi `PUT /rbac/roles/:id` vào **A** để đổi grant (qua `RoleService.updateRole` → `invalidate`).
3. Quan sát: terminal **B** in ra log của listener (đã set `_ac=null`). Gọi lại API ở B → quyền đã cập nhật **mà không cần restart B**.

> Nếu chưa có endpoint `/rbac/roles`, tạm test bằng cách publish thẳng: `redis-cli -p 6380 PUBLISH rbac:invalidate 1` rồi xem B có drop cache không.

### Cách 4 — Script standalone (tách khỏi HTTP)

`src/test/pubsub.manual.ts`:
```ts
import { initRedis, pubClient, subClient } from '../utils/redis.util'

const main = async () => {
  await initRedis()
  await subClient.subscribe('demo', (msg) => console.log('GOT:', msg))
  await pubClient.publish('demo', 'first')   // subscribe trước rồi mới publish
  setTimeout(() => process.exit(0), 500)
}
main()
```
Chạy: `npx ts-node src/test/pubsub.manual.ts` → in `GOT: first`.

---

## 5. Bẫy thường gặp

1. **Publish nhưng không nhận** → subscribe xảy ra *sau* publish, hoặc subscribe nhầm channel, hoặc `initRedis()` chưa chạy (`isOpen === false`).
2. **`PUBLISH` trả về `0`** → đang **không có** subscriber nào nghe channel đó (số trả về = số subscriber nhận).
3. **Dùng chung 1 client để vừa subscribe vừa SET/GET** → lỗi RESP2. Luôn tách `pubClient`/`subClient` (repo đã làm sẵn).
4. **Subscribe trùng nhiều lần** → callback chạy nhiều lần cho 1 message. Dùng cờ idempotent (`_subscribed`) như trong `AccessControlService.initInvalidationListener`.
5. **Kỳ vọng message bền** → Redis pub/sub không lưu. Cần bền/đảm bảo → dùng **Redis Streams** hoặc **RabbitMQ/Kafka** (repo đã có sẵn cho tác vụ nền).
6. **Quên publish khi sửa dữ liệu thẳng DB** → cache stale. Mọi thay đổi role phải đi qua service có `invalidate()`.

---

## 6. Khi nào dùng gì? (nâng cao)

| Nhu cầu | Công cụ |
|---|---|
| Báo nhanh "hãy refresh", invalidate cache, presence/online | **Redis Pub/Sub** |
| Realtime nhưng cần xem lại lịch sử / consumer group / replay | **Redis Streams** (`XADD`/`XREAD`) |
| Tác vụ nền cần đảm bảo không mất, retry, DLX (đặt hàng, gửi mail) | **RabbitMQ** (repo: `amqplib`) |
| Event log throughput cao, nhiều consumer độc lập, replay | **Kafka** (repo: `kafkajs`) |

Pub/Sub là công cụ "nhẹ và nhanh" cho **tín hiệu**, không phải cho **dữ liệu quan trọng cần đảm bảo**.

---

## 7. Case thực tế trong bài toán ecommerce này — dùng & triển khai

Quy tắc lọc nhanh trước khi đọc: **chỉ dùng pub/sub khi (a) chạy ≥2 process VÀ (b) cần báo "tín hiệu" tức thì mà mất 1 message không gây sai dữ liệu.** Nếu cần *đảm bảo xử lý* (trừ kho, trừ tiền) → dùng RabbitMQ/Kafka (repo đã có), **không** dùng pub/sub.

Dưới đây là các case **đáng dùng** trong repo này, kèm cách triển khai.

### Case 1 — Realtime cập nhật trạng thái đơn hàng cho buyer (case kinh điển nhất)

**Bối cảnh**: buyer mở app theo dõi đơn. Khi shop/admin đổi `order_status` (`pending → shipping → delivered`), buyer phải thấy ngay qua WebSocket. Nhưng buyer đang giữ kết nối WebSocket ở **instance A**, còn request đổi trạng thái rơi vào **instance B**. B không có socket của buyer → không emit thẳng được.

**Vì sao pub/sub**: B `publish` sự kiện, **mọi instance** nhận; instance nào đang giữ socket của user đó thì emit. Đây chính là cách **socket.io Redis adapter** hoạt động — và là lý do `redis.util.ts` tạo `pubClient` + `subClient = pubClient.duplicate()` (đúng chữ ký adapter cần).

**Triển khai** (`src/features/order/service` sau khi update status):
```ts
// channel theo user để fan-out gọn
await PubSubService.publish(`order:status:${order.order_userId}`, {
  orderId: order._id, status: order.order_status,
})
```
Phía giữ WebSocket (gateway socket), mỗi instance subscribe 1 lần:
```ts
await PubSubService.subscribe('order:status:*', /* PSUBSCRIBE */ (raw) => {
  const { orderId, status } = JSON.parse(raw)
  io.to(`user:${userId}`).emit('order_status_changed', { orderId, status }) // chỉ instance giữ socket mới có room này
})
```
> Lưu ý ranh giới: việc **trừ kho/tạo đơn** phải đi qua RabbitMQ (đảm bảo không mất). Pub/sub ở đây chỉ để **thông báo**, mất 1 message thì client poll lại là cùng — không hỏng dữ liệu.

### Case 2 — Invalidate cache phân tán (RBAC, product, discount)

**Bối cảnh**: bạn cache `grant-list` (RBAC), hoặc cache **product detail** / **discount đang active** trong RAM mỗi instance để giảm tải Mongo. Khi admin sửa role / sửa giá / tắt discount ở instance A, các instance khác vẫn giữ cache cũ.

**Triển khai** (đã có mẫu trong RBAC guide; tổng quát hoá cho product/discount):
```ts
// sau khi update product / discount / role
await pubClient.del(`cache:product:${id}`)            // xoá L2 nếu có
await PubSubService.publish('cache:invalidate', { type: 'product', id }) // báo mọi instance

// mỗi instance lúc khởi động:
await PubSubService.subscribe('cache:invalidate', (raw) => {
  const { type, id } = JSON.parse(raw)
  localCache.del(`${type}:${id}`) // drop L1 của instance này
})
```
Dùng kèm **TTL** làm lưới an toàn. Đây là cùng một khuôn với RBAC, chỉ khác `type`.

### Case 3 — Broadcast flash-sale / đổi giá realtime

**Bối cảnh**: admin bật flash-sale hoặc đổi giá; muốn mọi client đang xem trang sản phẩm thấy giá mới ngay, đồng thời mọi instance xoá cache giá cũ.

**Triển khai**: gộp Case 2 (invalidate cache) + Case 1 (emit socket):
```ts
await PubSubService.publish('product:price', { productId, newPrice }) // 1 message, 2 tác dụng
// mỗi instance: drop cache product + io.to(`product:${productId}`).emit('price_changed', {...})
```
Mất message ở đây cũng vô hại: lần load trang sau client lấy giá mới từ API.

### Case 4 — "Presence" / thông báo tới shop

**Bối cảnh**: có đơn mới → đẩy notification tới đúng shop owner đang online (socket ở instance nào đó). Giống Case 1 nhưng người nhận là **shop**: `publish('shop:notify:<shopId>', {...})`.

### Khi nào KHÔNG dùng pub/sub trong ecommerce (để khỏi nhầm)

| Việc | Dùng gì | Vì sao không phải pub/sub |
|---|---|---|
| Tạo đơn, trừ kho, trừ tiền | **RabbitMQ** (`amqplib`) | Mất message = sai dữ liệu/tiền; cần ack + retry |
| Gửi email/SMS xác nhận đơn | **RabbitMQ** | Cần đảm bảo gửi, retry nếu lỗi |
| Ghi log hành vi, analytics throughput cao | **Kafka** (`kafkajs`) | Cần lưu trữ, replay, nhiều consumer |
| Cache role/product giữa các instance | **Pub/Sub** | Chỉ là tín hiệu invalidate, mất thì rebuild |
| Realtime trạng thái đơn / giá / noti | **Pub/Sub** (+ WebSocket) | Tín hiệu hiển thị, mất thì client poll lại |

**Tóm tắt cho repo này**: nếu hiện tại chạy **1 instance**, bạn **chưa cần** pub/sub cho bất kỳ case nào ở trên — cache cứ để L1 in-memory. Pub/sub trở nên cần thiết đúng vào lúc bạn **scale ngang ≥2 process** (PM2 cluster / nhiều container / master-slave) và bắt đầu làm **realtime qua WebSocket**. Hai cột mốc đó là tín hiệu "giờ bật pub/sub".
