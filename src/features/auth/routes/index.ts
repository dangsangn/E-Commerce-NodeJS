import express from 'express'
import AuthController from '../controllers'
import { asyncHandler } from '../../../utils'

const router = express.Router()

router.post('/signup', asyncHandler(AuthController.signup))

export default router
