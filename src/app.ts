import express from 'express'
import compression from 'compression'
import helmet from 'helmet'
import morgan from 'morgan'
import instanceMongoDB from './dbs/init.mongodb'
import { checkOverload } from './helpers/check.connect'
import shopRouter from './features/shop/routes'
import authRouter from './features/auth/routes'

const app = express()

// middleware setup
app.use(compression())
app.use(helmet())
app.use(morgan('dev'))

// parse request body
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// init Database
instanceMongoDB
// checkOverload()

// routes
app.use('/v1/api', shopRouter)
app.use('/v1/api', authRouter)

export default app
