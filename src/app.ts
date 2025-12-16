import express from 'express'
import compression from 'compression'
import helmet from 'helmet'
import morgan from 'morgan'
import instanceMongoDB from './dbs/init.mongodb'
import { checkOverload } from './helpers/check.connect'

const app = express()

// middleware setup
app.use(compression())
app.use(helmet())
app.use(morgan('dev'))

// init Database
instanceMongoDB
// checkOverload()

// routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' })
})

export default app
