import express from 'express'
import AuthController from '../controllers'
import { asyncHandler } from '../../../utils'
import { authentication } from '../utils/checkAuth'

const router = express.Router()

router.post('/signup', asyncHandler(AuthController.signup))
router.post('/login', asyncHandler(AuthController.login))
router.post('/verify-otp', asyncHandler(AuthController.verifyOtp))
router.post('/resend-otp', asyncHandler(AuthController.resendOtp))

router.use(authentication)
router.post('/logout', asyncHandler(AuthController.logout))
router.post('/refresh-token', asyncHandler(AuthController.refreshToken))

export default router
