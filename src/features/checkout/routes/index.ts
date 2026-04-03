import express from 'express'
import { authentication } from '../../auth/utils/checkAuth'
import { asyncHandler } from '../../../utils'
import CheckoutController from '../controller'

const router = express.Router()

router.use(authentication)

router.post('/review', asyncHandler(CheckoutController.checkoutReview))

export default router
