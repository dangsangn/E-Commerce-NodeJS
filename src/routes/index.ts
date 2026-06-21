import { Router } from 'express'
import shopRouter from '../features/shop/routes'
import authRouter from '../features/auth/routes'
import productRouter from '../features/product/routes'
import cartRouter from '../features/cart/routes'
import discountRouter from '../features/discount/routes'
import checkoutRouter from '../features/checkout/routes'
import orderRouter from '../features/order/routes'
import inventoryRouter from '../features/inventory/routes'
import commentRouter from '../features/comments/presentation/routes'
import { apiKey, permission } from '../features/auth/utils/checkAuth'
import testRouter from './test.route'
import userRouter from '../features/user/routes'

const router = Router()

// check api key
router.use(apiKey)

// check permission
router.use(permission(['0000']))

router.use('/shop', shopRouter)
router.use('/auth', authRouter)
router.use('/product', productRouter)
router.use('/cart', cartRouter)
router.use('/inventory', inventoryRouter)
router.use('/discount', discountRouter)
router.use('/checkout', checkoutRouter)
router.use('/order', orderRouter)
router.use('/test', testRouter)
router.use('/comment', commentRouter)
router.use('/user', userRouter)

export default router
