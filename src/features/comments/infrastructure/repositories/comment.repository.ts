import {
  ICommentRepository,
  GetCommentsParams,
} from '../../application/interfaces/comment.repository.interface'
import { CommentEntity } from '../../domain/entities/comment.entity'
import { CommentModel } from '../database/models/comment.model'

export class MongoCommentRepository implements ICommentRepository {
  // Mapper: Mongoose Document -> Domain Entity
  private mapToEntity(doc: any): CommentEntity {
    return {
      id: doc._id.toString(),
      productId: doc.productId.toString(),
      userId: doc.userId.toString(),
      content: doc.content,
      parentId: doc.parentId ? doc.parentId.toString() : null,
      replyToUserId: doc.replyToUserId ? doc.replyToUserId.toString() : null,
      isDeleted: doc.isDeleted,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
  }

  async create(comment: CommentEntity): Promise<CommentEntity> {
    const created = await CommentModel.create(comment)
    return this.mapToEntity(created)
  }

  async findById(id: string): Promise<CommentEntity | null> {
    const doc = await CommentModel.findById(id).lean()
    if (!doc) return null
    return this.mapToEntity(doc)
  }

  async findComments(params: GetCommentsParams): Promise<CommentEntity[]> {
    const { productId, limit = 50, skip = 0, parentId = null } = params

    const docs = await CommentModel.find({
      productId,
      isDeleted: false,
      ...(parentId && { parentId }),
    })
      .sort({ createdAt: 1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .populate('user', 'name email')
      .populate('replyToUser', 'name email')
      .lean()

    return docs.map((doc) => this.mapToEntity(doc))
  }

  async deleteMany(condition: any): Promise<void> {
    // Ánh xạ logic của Application (commentIds) sang cú pháp riêng của Mongoose ($or)
    let mongoCondition: any = { productId: condition.productId }

    if (condition.commentIds && condition.commentIds.length > 0) {
      mongoCondition.$or = [
        { _id: { $in: condition.commentIds } },
        { parentId: { $in: condition.commentIds } },
      ]
    }

    await CommentModel.deleteMany(mongoCondition)
  }

  async deleteOne(id: string): Promise<void> {
    await CommentModel.deleteOne({ _id: id })
  }
}
