import express from 'express'
import AuthController from '../controllers'
import { asyncHandler } from '../../../utils'
import { authentication } from '../utils/checkAuth'
import { rateLimitByIp } from '@/middlewares/rate-limit.middleware'

const router = express.Router()

router.post('/signup', asyncHandler(AuthController.signup))
router.post('/login', asyncHandler(AuthController.login))
router.post('/verify-otp', asyncHandler(AuthController.verifyOtp))
router.post('/resend-otp', asyncHandler(AuthController.resendOtp))

// Forgot-password flow. These MUST stay above `router.use(authentication)`:
// someone who forgot their password is by definition someone who cannot log
// in, so requiring a session here would 403 exactly the people who need them.
// /forgot-password is the only one that sends mail, so it carries the per-IP
// limit; the other two are cheap and already guarded by the OTP attempt
// counter and the single-use ticket.
router.post(
  '/forgot-password',
  rateLimitByIp({ keyPrefix: 'forgot', max: 10, windowSec: 3600 }),
  asyncHandler(AuthController.forgotPassword),
)
router.post('/verify-reset-otp', asyncHandler(AuthController.verifyResetOtp))
router.post('/reset-password', asyncHandler(AuthController.resetPassword))

router.use(authentication)
router.post('/logout', asyncHandler(AuthController.logout))
router.post('/refresh-token', asyncHandler(AuthController.refreshToken))

export default router
