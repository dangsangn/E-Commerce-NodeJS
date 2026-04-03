import express from 'express'
import { asyncHandler } from '../../../utils'
import { authentication } from '../../auth/utils/checkAuth'
import CartController from '../controller'
const router = express.Router()

router.use(authentication)
router.get('/', asyncHandler(CartController.getCart))
router.post('/', asyncHandler(CartController.addToCart))
router.patch('/quantity', asyncHandler(CartController.updateCartQuantity))
router.delete('/', asyncHandler(CartController.removeFromCart))
router.delete('/clear', asyncHandler(CartController.clearCart))

export default router
