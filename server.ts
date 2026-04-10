import app from './src/app'
import config from './src/configs'
import instanceMongoDB from './src/dbs/init.mongodb'
import { initRedis } from './src/utils/redis.util'

const PORT = config.port

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server is shutting down')
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
  }
}

startServer()
