import express from 'express'
import ShopController from '../controllers'
import { asyncHandler } from '../../../utils'

const router = express.Router()

router.get('/', asyncHandler(ShopController.getAllShops))
router.post('/email', asyncHandler(ShopController.getShopByEmail))

export default router
