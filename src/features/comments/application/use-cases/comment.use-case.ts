import {
  ICommentRepository,
  GetCommentsParams,
} from '../interfaces/comment.repository.interface'
import { CommentEntity } from '../../domain/entities/comment.entity'

export class CommentUseCase {
  // Dependency Injection
  constructor(private readonly commentRepository: ICommentRepository) {}

  async createComment(
    payload: Omit<CommentEntity, 'isDeleted' | 'id'>,
  ): Promise<CommentEntity> {
    const newComment: CommentEntity = {
      ...payload,
      isDeleted: false, // Business Rule: Comment mới luôn có trạng thái isDeleted = false
    }
    return await this.commentRepository.create(newComment)
  }

  async getComments(params: GetCommentsParams): Promise<CommentEntity[]> {
    return await this.commentRepository.findComments(params)
  }

  async deleteComment(commentId: string, productId: string): Promise<boolean> {
    const comment = await this.commentRepository.findById(commentId)
    if (!comment) throw new Error('Comment not found')

    // Business Rule: Xóa gốc -> xóa luôn con. Xóa con -> chỉ xóa con.
    if (comment.parentId === null) {
      await this.commentRepository.deleteMany({
        productId,
        commentIds: [commentId], // Tự định nghĩa query params để Interface không phụ thuộc logic Mongo $or
      })
    } else {
      await this.commentRepository.deleteOne(commentId)
    }

    return true
  }
}
