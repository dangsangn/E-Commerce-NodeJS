import logger from '@/loggers'
import mongoose from 'mongoose'
import os from 'os'

const TIME_CHECK_OVERLOAD = 5000 // 5 seconds

export const getCountConnect = () => {
  return mongoose.connections.length
}

export const checkOverload = () => {
  setInterval(() => {
    const numConnection = getCountConnect()
    const numCores = os.cpus().length
    const memoryUsage = process.memoryUsage().rss

    // Example maximum number of connections based on the number of cores
    const maxConnections = numCores * 5
    logger.debug('Connection health', {
      numConnection: numConnection,
      cores: numCores,
      memory: `${memoryUsage / 1024 / 1024} MB`,
    })

    if (numConnection > maxConnections) {
      logger.warn('Connection overload detected', {
        numConnection,
        maxConnections,
      })
    }
  }, TIME_CHECK_OVERLOAD)
}
