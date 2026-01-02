import express from 'express'
import AuthController from '../controllers'
import { asyncHandler } from '../../../utils'
import { authentication } from '../utils/checkAuth'

const router = express.Router()

router.post('/signup', asyncHandler(AuthController.signup))
router.post('/login', asyncHandler(AuthController.login))

router.use(authentication)
router.post('/logout', asyncHandler(AuthController.logout))

export default router
