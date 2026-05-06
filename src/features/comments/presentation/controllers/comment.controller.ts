import { Request, Response } from 'express'
import { CommentUseCase } from '../../application/use-cases/comment.use-case'
import { OkResponse } from '../../../../core/success.response'

export class CommentController {
  // Inject UseCase thay vì require trực tiếp
  constructor(private readonly commentUseCase: CommentUseCase) {}

  createComment = async (req: Request, res: Response): Promise<void> => {
    new OkResponse({
      message: 'Create new comment successfully',
      data: await this.commentUseCase.createComment(req.body),
    }).send(res)
  }

  getComments = async (req: Request, res: Response): Promise<void> => {
    new OkResponse({
      message: 'Get list comments successfully',
      data: await this.commentUseCase.getComments(req.query as any),
    }).send(res)
  }

  deleteComment = async (req: Request, res: Response): Promise<void> => {
    const { commentId, productId } = req.body
    new OkResponse({
      message: 'Delete comment successfully',
      data: await this.commentUseCase.deleteComment(commentId, productId),
    }).send(res)
  }
}
