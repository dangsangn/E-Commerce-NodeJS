import compression from 'compression'
import express, { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import instanceMongoDB from './dbs/init.mongodb'
import { loggingMiddleware } from './middlewares/logging.middleware'
import router from './routes'
import logger from './loggers'

const app = express()
const isDev = (process.env.NODE_ENV || 'development') !== 'production'

// middleware setup
app.use(compression())
app.use(helmet())
app.use(loggingMiddleware)

// parse request body
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// init Database
instanceMongoDB

// checkOverload()
app.get('', (req: Request, res: Response) => {
  return res.status(200).json({ message: 'OK' })
})

// routes
app.use('/api/v1', router)

// handle error
app.use((req: Request, res: Response, next: NextFunction) => {
  const error = new Error('Not Found')
  ;(error as any).status = 404
  next(error)
})

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500

  const logMeta = {
    method: req.method,
    url: req.originalUrl,
    path: req.originalUrl,
    statusCode,
  }

  if (statusCode >= 500) {
    logger.error('Unhandled request error', logMeta)
  } else {
    logger.warn('Request error', logMeta)
  }

  return res.status(statusCode).json({
    code: statusCode,
    message:
      statusCode >= 500 ? 'Internal Server Error' : err.message || 'Error',
    status: 'error',
    ...(isDev ? { stack: err.stack } : {}),
  })
})

export default app
