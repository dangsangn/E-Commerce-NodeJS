import app from './app'
import config from './configs'
import instanceMongoDB from './dbs/init.mongodb'
import logger from './loggers'
import { initRedis } from './utils/redis.util'

const PORT = config.port

const server = app.listen(PORT, () => {
  logger.info(`Server started`, {
    port: PORT,
    env: process.env.NODE_ENV,
  })
})

process.on('SIGINT', () => {
  logger.info('Server shutting down (SIGINT)')
  server.close(() => {
    logger.info('HTTP server closed')
  })
  instanceMongoDB.close()
  process.exit(0)
})

const startServer = async () => {
  try {
    await initRedis()
    // ... rest of your startup logic
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
