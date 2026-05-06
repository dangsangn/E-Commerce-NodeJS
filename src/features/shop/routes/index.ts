import express from 'express'
import ShopController from '../controllers'
import { asyncHandler } from '../../../utils'

const router = express.Router()

router.get('/', asyncHandler(ShopController.getAllShops))

export default router
