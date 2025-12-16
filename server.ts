import app from './src/app'
import instanceMongoDB from './src/dbs/init.mongodb'

const PORT = process.env.PORT || 3000

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
