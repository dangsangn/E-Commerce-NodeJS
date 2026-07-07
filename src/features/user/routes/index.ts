import express from 'express'
import { authentication } from '../../auth/utils/checkAuth'
import { asyncHandler } from '../../../utils'
import UserController from '../controllers'
import { uploadImage } from '@/middlewares/multer.middleware'
const router = express.Router()
router.use(authentication)

router.post('/me/upgrade-to-shop', asyncHandler(UserController.upgradeToShop))
router.patch(
  '/me/avatar',
  uploadImage.single('avatar'),
  asyncHandler(UserController.updateAvatar),
)

export default router
