import express from 'express'
import { asyncHandler } from '../../../utils'
import InventoryController from '../controller'

const router = express.Router()

router.get(
  '/product/:productId',
  asyncHandler(InventoryController.getByProductId),
)

export default router
