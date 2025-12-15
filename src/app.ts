import express from 'express'
import compression from 'compression'
import helmet from 'helmet'
import morgan from 'morgan'

const app = express()

// middleware setup
app.use(compression())
app.use(helmet())
app.use(morgan('dev'))

// routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' })
})

export default app
