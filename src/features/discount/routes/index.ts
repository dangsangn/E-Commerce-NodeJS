import { Router } from 'express'
import { DiscountController } from '../controller/discount.controller'
import { authentication } from '../../auth/utils/checkAuth'
import { validationMiddleware } from '../../../middlewares/validation.middleware'
import { CreateDiscountDTO } from '../dtos'
import { asyncHandler } from '../../../utils'

const router = Router()

const discountController = new DiscountController()

// public routes
router.get('/code/:code', asyncHandler(discountController.getDiscountByCode))
router.get('/shop/:shopId', asyncHandler(discountController.getDiscountsByShop))

router.use(authentication)

router.post(
  '/',
  validationMiddleware(CreateDiscountDTO, 'body'),
  asyncHandler(discountController.createDiscount),
)

export default router
