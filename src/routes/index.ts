import { Router } from 'express'
import shopRouter from '../features/shop/routes'
import authRouter from '../features/auth/routes'
import { apiKey, permission } from '../features/auth/utils/checkAuth'

const router = Router()

// check api key
router.use(apiKey)

// check permission
router.use(permission(['0000']))

router.use('/shop', shopRouter)
router.use('/auth', authRouter)

export default router
