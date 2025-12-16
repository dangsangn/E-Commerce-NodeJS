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
    console.log(`Number of connections: ${numConnection}`)
    console.log(`Number of cores: ${numCores}`)
    console.log(`Memory usage: ${memoryUsage / 1024 / 1024} MB`)

    if (numConnection > maxConnections) {
      console.log('Connection overload detected')
    }
  }, TIME_CHECK_OVERLOAD)
}
