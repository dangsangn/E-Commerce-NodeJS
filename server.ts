import app from './src/app'
import config from './src/configs'
import instanceMongoDB from './src/dbs/init.mongodb'
import logger from './src/loggers'
import { initRedis } from './src/utils/redis.util'

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
