import express from 'express'
import { authentication } from '../../auth/utils/checkAuth'
import { asyncHandler } from '../../../utils'
import UserController from '../controllers'
const router = express.Router()
router.use(authentication)

router.post('/me/upgrade-to-shop', asyncHandler(UserController.upgradeToShop))

export default router
