import express from 'express'
import PubSubService from '../services/pubsub.service'

const router = express.Router()

// 1. Subscribe to a channel (Run this once)
router.get('/subscribe/:channel', async (req, res) => {
  const { channel } = req.params
  await PubSubService.subscribe(channel, (msg) => {
    // This will log in your terminal when a message is published
    console.log('HANDLED MESSAGE:', msg)
  })
  res.send(`Subscribed to ${channel}. Check terminal for messages.`)
})

// 2. Publish to a channel
router.post('/publish/:channel', async (req, res) => {
  const { channel } = req.params
  const { message } = req.body
  await PubSubService.publish(channel, message)
  res.json({ status: 'published', channel, message })
})

export default router
