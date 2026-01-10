import express from 'express'
import ProductController from '../controller'
import { asyncHandler } from '../../../utils'
import { authentication } from '../../auth/utils/checkAuth'

const router = express.Router()

router.use(authentication)
router.post('/', asyncHandler(ProductController.createProduct))

export default router
