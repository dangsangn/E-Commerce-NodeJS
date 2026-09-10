import { uploadImage } from '@/middlewares/multer.middleware'
import express from 'express'
import { asyncHandler } from '../../../utils'
import { authentication } from '../../auth/utils/checkAuth'
import { protect } from '../../auth/utils/rbac'
import ProductController from '../controller'

const router = express.Router()
const can = protect('product')

router.get('/', asyncHandler(ProductController.searchProducts))
router.get('/:id', asyncHandler(ProductController.getDetailProduct))
// Buyer picked a different variant — refresh one cell, not the whole detail.
router.get('/:id/sku/:skuId', asyncHandler(ProductController.getSkuDetail))

router.use(authentication)

router.post('/', can.create, asyncHandler(ProductController.createProduct))
router.get(
  '/list/draft',
  can.read,
  asyncHandler(ProductController.getDraftProductByShop),
)
router.get(
  '/list/published',
  can.read,
  asyncHandler(ProductController.getPublishedProductByShop),
)
router.patch('/:id', can.update, asyncHandler(ProductController.updateProduct))
// Variant axes: rename them and hang a photo on each option. Cannot change the
// shape of the matrix — that would repoint existing SKUs.
router.patch(
  '/:id/variations',
  can.update,
  asyncHandler(ProductController.updateVariations),
)
// Price lives on the SKU and stock on the inventory row, so both are edited here
// rather than through PATCH /:id.
router.patch(
  '/:id/sku',
  can.update,
  asyncHandler(ProductController.updateSkus),
)
router.patch(
  '/published/:id',
  can.update,
  asyncHandler(ProductController.setPublishedProductByShop),
)
router.patch(
  '/draft/:id',
  can.update,
  asyncHandler(ProductController.setDraftProductByShop),
)
router.post(
  '/upload/link',
  can.create,
  asyncHandler(ProductController.uploadProductImageByLink),
)
router.post(
  '/upload/prepare',
  can.create,
  uploadImage.array('images'),
  asyncHandler(ProductController.prepareProductImages),
)
router.put(
  '/upload/images/:productId',
  can.create,
  uploadImage.array('images'),
  asyncHandler(ProductController.updateProductImages),
)

export default router
