import express from 'express'
import { authentication } from '../../auth/utils/checkAuth'
import { asyncHandler } from '../../../utils'
import OrderController from '../controller'

const router = express.Router()

router.use(authentication)

router.post('/', asyncHandler(OrderController.createOrder))
router.get('/', asyncHandler(OrderController.getOrdersByUser))
router.patch('/:id/cancel', asyncHandler(OrderController.cancelOrder))
router.get('/:id', asyncHandler(OrderController.getOrderDetail))

export default router
