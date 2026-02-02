import express from 'express'
import ProductController from '../controller'
import { asyncHandler } from '../../../utils'
import { authentication } from '../../auth/utils/checkAuth'

const router = express.Router()

router.get('/', asyncHandler(ProductController.searchProducts))
router.get('/:id', asyncHandler(ProductController.getDetailProduct))

router.use(authentication)

router.post('/', asyncHandler(ProductController.createProduct))
router.get('/draft', asyncHandler(ProductController.getDraftProductByShop))
router.get(
  '/published',
  asyncHandler(ProductController.getPublishedProductByShop)
)
router.patch(
  '/published/:id',
  asyncHandler(ProductController.setPublishedProductByShop)
)
router.patch(
  '/draft/:id',
  asyncHandler(ProductController.setDraftProductByShop)
)

export default router
