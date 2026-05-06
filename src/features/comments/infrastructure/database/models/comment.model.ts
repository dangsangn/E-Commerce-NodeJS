import { Schema, model, Document, Types } from 'mongoose'

const DOCUMENT_NAME = 'Comment'
const COLLECTION_NAME = 'Comments'

export interface ICommentDocument extends Document {
  productId: Types.ObjectId
  userId: Types.ObjectId
  content: string
  parentId: Types.ObjectId | null
  replyToUserId: Types.ObjectId | null
  isDeleted: boolean
}

const commentSchema = new Schema<ICommentDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
    content: { type: String, required: true },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: DOCUMENT_NAME,
      default: null,
    },
    replyToUserId: { type: Schema.Types.ObjectId, ref: 'Shop', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  },
)

commentSchema.index({ productId: 1, parentId: 1 })

export const CommentModel = model<ICommentDocument>(
  DOCUMENT_NAME,
  commentSchema,
)
