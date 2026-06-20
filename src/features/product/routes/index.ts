import express from 'express'
import ProductController from '../controller'
import { asyncHandler } from '../../../utils'
import { authentication } from '../../auth/utils/checkAuth'
import { grantAccess } from '../../auth/utils/rbac'

const router = express.Router()

router.get('/', asyncHandler(ProductController.searchProducts))
router.get('/:id', asyncHandler(ProductController.getDetailProduct))

router.use(authentication)

router.post(
  '/',
  grantAccess('create', 'product'),
  asyncHandler(ProductController.createProduct),
)
router.get('/list/draft', asyncHandler(ProductController.getDraftProductByShop))
router.get(
  '/list/published',
  asyncHandler(ProductController.getPublishedProductByShop),
)
router.patch('/:id', asyncHandler(ProductController.updateProduct))
router.patch(
  '/published/:id',
  asyncHandler(ProductController.setPublishedProductByShop),
)
router.patch(
  '/draft/:id',
  asyncHandler(ProductController.setDraftProductByShop),
)
router.post(
  '/upload/link/:shopId',
  asyncHandler(ProductController.uploadProductImageByLink),
)

export default router
