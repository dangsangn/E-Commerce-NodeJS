import express from 'express'
import AuthController from '../controllers'

const router = express.Router()

router.post('/auth/signup', AuthController.signup)

export default router
