# Hướng dẫn triển khai chức năng Comment (Cấu trúc Phẳng 2 Cấp - Parent/Child)

Đây là thiết kế chức năng Comment theo mô hình **Phẳng 2 Cấp** (giống với Facebook, Youtube, Shopee).
Thay vì lồng nhau vô hạn như Reddit (Nested Set), mô hình này ép tất cả các phản hồi (reply) về chung 1 cấp duy nhất nằm dưới bình luận gốc.

**Ưu điểm:**
- Insert/Delete cực kỳ nhanh (O(1)).
- Logic Code đơn giản, Database gọn nhẹ.
- Phù hợp 99% các nền tảng mạng xã hội và E-Commerce hiện nay.

---

## Bước 1: Tạo Schema Model
Tạo file `src/features/comment/models/index.ts`

Trong mô hình này, ta không cần `left` và `right`. Ta chỉ cần một trường `comment_parentId` trỏ về ID của bình luận gốc. (Nếu là bình luận gốc thì trường này là `null`).

```typescript
import { Schema, model } from 'mongoose'

const DOCUMENT_NAME = 'Comment'
const COLLECTION_NAME = 'Comments'

const commentSchema = new Schema({
    comment_productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    comment_userId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true }, // hoặc User tùy hệ thống
    comment_content: { type: String, required: true },
    
    // Nếu parentId = null -> Đây là comment gốc
    // Nếu có parentId -> Đây là reply của comment gốc đó
    comment_parentId: { type: Schema.Types.ObjectId, ref: DOCUMENT_NAME, default: null },
    
    // (Optional) Lưu ID của người bị reply để frontend bôi xanh tag @TênNgườiDùng
    replyToUserId: { type: Schema.Types.ObjectId, ref: 'Shop', default: null },

    isDeleted: { type: Boolean, default: false }
}, {
    timestamps: true,
    collection: COLLECTION_NAME
})

// Đánh Index để query nhanh
commentSchema.index({ comment_productId: 1, comment_parentId: 1 })

export const CommentModel = model(DOCUMENT_NAME, commentSchema)
```

---

## Bước 2: Tạo logic Service
Tạo file `src/features/comment/services/comment.service.ts`. Logic giờ đây cực kỳ đơn giản vì không phải tính toán `left/right`.

### 2.1. Thêm mới Comment (`createComment`)
Thêm thẳng vào DB mà không cần update các record khác!

```typescript
import { CommentModel } from '../models'

export class CommentService {
    static async createComment({ productId, userId, content, parentId = null, replyToUserId = null }) {
        // Khởi tạo comment mới
        const comment = new CommentModel({
            comment_productId: productId,
            comment_userId: userId,
            comment_content: content,
            comment_parentId: parentId,
            replyToUserId: replyToUserId
        })

        // Lưu vào DB
        await comment.save()
        return comment
    }
```

### 2.2. Lấy danh sách Comments (`getComments`)
Với mô hình phẳng 2 cấp, Frontend thường sẽ gọi API 2 bước:
1. Lấy danh sách các **bình luận gốc** (phân trang).
2. Khi user bấm "Xem các câu trả lời", Frontend truyền `parentId` của bình luận gốc đó lên để lấy toàn bộ các **reply**.

```typescript
    /**
     * Nếu truyền parentId = null: Lấy các comment gốc
     * Nếu truyền parentId = <ID>: Lấy toàn bộ các reply của comment gốc đó
     */
    static async getComments({ productId, parentId = null, limit = 50, skip = 0 }) {
        return await CommentModel.find({
            comment_productId: productId,
            comment_parentId: parentId, // Rất đơn giản, chỉ cần query theo parentId
            isDeleted: false
        })
        // Sắp xếp cũ lên trước (theo thời gian)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        // Populate (join) để lấy tên User nếu cần
        // .populate('comment_userId', 'name avatar')
        // .populate('replyToUserId', 'name') 
    }
```

### 2.3. Xóa Comment (`deleteComment`)
Xóa ở mô hình này cũng rất đơn giản:
- Nếu xóa comment con (reply): Chỉ xóa duy nhất nó.
- Nếu xóa comment gốc: Xóa nó VÀ xóa luôn toàn bộ các comment con có `parentId` trỏ tới nó.

```typescript
    static async deleteComment({ commentId, productId }) {
        const comment = await CommentModel.findById(commentId)
        if (!comment) throw new Error('Comment not found')

        // 1. Kiểm tra xem đây là comment gốc hay comment con
        if (comment.comment_parentId === null) {
            // Đây là comment gốc -> Xóa nó VÀ tất cả các reply của nó
            await CommentModel.deleteMany({
                comment_productId: productId,
                $or: [
                    { _id: commentId }, // Xóa chính nó
                    { comment_parentId: commentId } // Xóa con của nó
                ]
            })
        } else {
            // Đây là comment con -> Chỉ xóa chính nó
            await CommentModel.deleteOne({ _id: commentId })
        }

        return true
    }
}
```

---

## Bước 3: Tạo Controller
Tạo file `src/features/comment/controller/comment.controller.ts`

```typescript
import { Request, Response } from 'express'
import { CommentService } from '../services/comment.service'
import { SuccessResponse } from '../../../core/success.response'

export class CommentController {
    createComment = async (req: Request, res: Response) => {
        new SuccessResponse({
            message: 'Create new comment successfully',
            metadata: await CommentService.createComment(req.body)
        }).send(res)
    }

    getComments = async (req: Request, res: Response) => {
        // req.query có thể chứa: productId, parentId, limit, skip
        new SuccessResponse({
            message: 'Get list comments successfully',
            metadata: await CommentService.getComments(req.query as any)
        }).send(res)
    }

    deleteComment = async (req: Request, res: Response) => {
        new SuccessResponse({
            message: 'Delete comment successfully',
            metadata: await CommentService.deleteComment(req.body)
        }).send(res)
    }
}
```

---

## Bước 4: Khai báo Routes
Tạo file `src/features/comment/routes/index.ts`

```typescript
import express from 'express'
import { CommentController } from '../controller/comment.controller'
import { asyncHandler } from '../../../helpers/asyncHandler' // Helper bắt lỗi try-catch
import { authentication } from '../../auth/utils/checkAuth' // Middleware check login

const router = express.Router()
const commentController = new CommentController()

// Route lấy danh sách comment (public)
// Ví dụ GET: /comments?productId=123&parentId=null (lấy gốc)
// Ví dụ GET: /comments?productId=123&parentId=abc (lấy reply của abc)
router.get('', asyncHandler(commentController.getComments))

// Middleware yêu cầu đăng nhập
router.use(authentication)

router.post('', asyncHandler(commentController.createComment))
router.delete('', asyncHandler(commentController.deleteComment))

export default router
```

## Giải thích luồng hoạt động (Ví dụ Youtube):
1. **Khách hàng A** comment: "Sản phẩm tốt!"
   - Tạo mới `parentId: null`.
2. **Shop** trả lời khách hàng A: "Cảm ơn bạn!"
   - Tạo mới `parentId: ID_của_A`.
3. **Khách hàng B** tag tên Shop để hỏi: "@Shop bao giờ có hàng tiếp?" (B bấm nút Trả lời vào comment của Shop).
   - FE truyền lên API: `parentId: ID_của_A`, và `replyToUserId: ID_của_Shop`.
   - Lưu vào DB: Vẫn nằm dưới gốc A. 
   - Khi render giao diện, Frontend sẽ hiện chung một cục các câu trả lời bên dưới A, và dùng trường `replyToUserId` để bôi xanh tag tên Shop, y hệt như Youtube!
