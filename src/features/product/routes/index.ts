import express from 'express'
import ProductController from '../controller'
import { asyncHandler } from '../../../utils'
import { authentication } from '../../auth/utils/checkAuth'
import { grantAccess, protect } from '../../auth/utils/rbac'
import { uploadImage } from '@/middlewares/multer.middleware'

const router = express.Router()
const can = protect('product')

router.get('/', asyncHandler(ProductController.searchProducts))
router.get('/:id', asyncHandler(ProductController.getDetailProduct))

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
