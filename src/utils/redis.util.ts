import { createClient } from 'redis'

const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6380',
}

const pubClient = createClient(redisConfig)
const subClient = pubClient.duplicate()

pubClient.on('error', (error) => console.log('Redis Publisher Error', error))
subClient.on('error', (error) => console.log('Redis Subscriber Error', error))

const initRedis = async () => {
  await Promise.all([pubClient.connect(), subClient.connect()])
  console.log('Redis connect successfully')
}

const closeRedis = async () => {
  await Promise.all([pubClient.quit(), subClient.quit()])
}

export { pubClient, subClient, initRedis, closeRedis }
