import logger, { runWithContext, setUserId } from '@/loggers'
import { randomUUID } from 'crypto'
import { NextFunction, Request, Response } from 'express'

export const loggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // 1. get requestId from header or generate a new one
  const requestId = req.headers['x-request-id'] || randomUUID()

  // 2. Return the code to the client for easier debugging/verification.
  res.setHeader('x-request-id', requestId)

  const start = process.hrtime.bigint()

  // 3. Open context for the entire request lifecycle
  runWithContext({ requestId: requestId as string }, () => {
    logger.http('request started', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    })
  })

  // 4. When the response is finished, log the request details
  res.on('finish', () => {
    // If the request is authenticated, assign the userId (req.user do middleware auth set).
    setUserId(req.user?.id)
    const duration = Number(process.hrtime.bigint() - start) / 1_000_000 // convert to milliseconds
    logger.http('request finished', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
    })
  })

  next()
}
