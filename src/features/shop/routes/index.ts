import express from 'express'

const router = express.Router()

router.get('/shop', (req, res) => {
  res.json({ message: 'Hello World' })
})

export default router
