import logger from '@/loggers'
import { createClient } from 'redis'

const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6380',
}

const pubClient = createClient(redisConfig)
const subClient = pubClient.duplicate()

pubClient.on('error', (error) =>
  logger.error('Redis Publisher Error', { err: error }),
)
subClient.on('error', (error) =>
  logger.error('Redis Subscriber Error', { err: error }),
)

const initRedis = async () => {
  await Promise.all([pubClient.connect(), subClient.connect()])
  logger.info('Redis connect successfully')
}

const closeRedis = async () => {
  await Promise.all([pubClient.quit(), subClient.quit()])
}

export { pubClient, subClient, initRedis, closeRedis }
