import {
  ICommentRepository,
  GetCommentsParams,
} from '../../application/interfaces/comment.repository.interface'
import { CommentEntity } from '../../domain/entities/comment.entity'
import { CommentModel } from '../database/models/comment.model'

export class MongoCommentRepository implements ICommentRepository {
  // Lấy id dạng string dù ref đã populate (object có _id) hay chưa (ObjectId).
  private refId(ref: any): string | null {
    if (!ref) return null
    if (typeof ref === 'object' && ref._id) return ref._id.toString()
    return ref.toString()
  }

  // Nếu ref đã được populate thì trả về { name, email }, ngược lại undefined.
  // User schema dùng field usr_name / usr_email nên phải map lại tên field.
  private refUser(ref: any): { name: string; email: string } | undefined {
    if (ref && typeof ref === 'object' && ref._id) {
      return { name: ref.usr_name ?? '', email: ref.usr_email ?? '' }
    }
    return undefined
  }

  // Mapper: Mongoose Document -> Domain Entity
  private mapToEntity(doc: any): CommentEntity {
    return {
      id: doc._id.toString(),
      productId: this.refId(doc.productId)!,
      userId: this.refId(doc.userId)!,
      content: doc.content,
      parentId: this.refId(doc.parentId),
      replyToUserId: this.refId(doc.replyToUserId),
      user: this.refUser(doc.userId),
      replyToUser: this.refUser(doc.replyToUserId),
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
      // Populate bằng SCHEMA PATH (userId / replyToUserId), not model name.
      // Select đúng field của User schema: usr_name / usr_email.
      .populate('userId', 'usr_name usr_email')
      .populate('replyToUserId', 'usr_name usr_email')
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
