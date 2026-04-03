import { Router } from 'express'
import shopRouter from '../features/shop/routes'
import authRouter from '../features/auth/routes'
import productRouter from '../features/product/routes'
import cartRouter from '../features/cart/routes'
import discountRouter from '../features/discount/routes'
import checkoutRouter from '../features/checkout/routes'
import orderRouter from '../features/order/routes'
import inventoryRouter from '../features/inventory/routes'
import { apiKey, permission } from '../features/auth/utils/checkAuth'

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

export default router
