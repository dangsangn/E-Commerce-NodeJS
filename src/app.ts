import express, { NextFunction, Request, Response } from 'express'
import compression from 'compression'
import helmet from 'helmet'
import morgan from 'morgan'
import instanceMongoDB from './dbs/init.mongodb'
import { checkOverload } from './helpers/check.connect'
import shopRouter from './features/shop/routes'
import authRouter from './features/auth/routes'
import router from './routes'

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
app.use('/v1/api', router)

// handle error
app.use((req: Request, res: Response, next: NextFunction) => {
  const error = new Error('Not Found')
  ;(error as any).status = 404
  next(error)
})
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500

  return res.status(statusCode).json({
    code: statusCode,
    message: err.message || 'Internal Server Error',
    status: 'error',
  })
})

export default app
