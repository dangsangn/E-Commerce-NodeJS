import { CommentEntity } from '../../domain/entities/comment.entity'

export interface GetCommentsParams {
  productId: string
  parentId?: string | null
  limit?: number
  skip?: number
}

export interface ICommentRepository {
  create(comment: CommentEntity): Promise<CommentEntity>
  findById(id: string): Promise<CommentEntity | null>
  findComments(params: GetCommentsParams): Promise<CommentEntity[]>
  deleteMany(condition: any): Promise<void>
  deleteOne(id: string): Promise<void>
}
