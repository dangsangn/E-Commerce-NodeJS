import express from 'express'
import { CommentController } from '../controllers/comment.controller'
import { CommentUseCase } from '../../application/use-cases/comment.use-case'
import { MongoCommentRepository } from '../../infrastructure/repositories/comment.repository'
import { authentication } from '../../../auth/utils/checkAuth'
import { asyncHandler } from '../../../../utils'

const router = express.Router()

// --- DEPENDENCY INJECTION ---
// 1. create DB implementation (Infra)
const commentRepository = new MongoCommentRepository()
// 2. inject Repo Interface into UseCase (Application)
const commentUseCase = new CommentUseCase(commentRepository)
// 3. inject UseCase into Controller (Presentation)
const commentController = new CommentController(commentUseCase)
// ----------------------------

// Routes public
router.get('', asyncHandler(commentController.getComments))

// Routes cần auth
router.use(authentication)
router.post('', asyncHandler(commentController.createComment))
router.delete('', asyncHandler(commentController.deleteComment))

export default router
