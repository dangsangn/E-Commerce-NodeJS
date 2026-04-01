import { Router } from 'express'
import { DiscountController } from '../controller/discount.controller'
import { authentication } from '../../auth/utils/checkAuth'
import { validationMiddleware } from '../../../middlewares/validation.middleware'
import { CreateDiscountDTO } from '../dtos'

const router = Router()

const discountController = new DiscountController()

// public routes
router.get('/code/:code', discountController.getDiscountByCode)
router.get('/shop/:shopId', discountController.getDiscountsByShop)

router.use(authentication)

router.post(
  '/',
  validationMiddleware(CreateDiscountDTO, 'body'),
  discountController.createDiscount,
)

export default router
