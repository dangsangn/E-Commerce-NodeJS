import { NextFunction, Request, Response } from 'express'
import { findById } from '../../apiKey/services'

const HEADER = {
  API_KEY: 'x-api-key',
  AUTHORIZATION: 'authorization',
}

export const apiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const key = req.headers[HEADER.API_KEY]?.toString() as string
    if (!key) {
      return res.status(403).json({
        message: 'Forbidden',
      })
    }
    const objectKey = await findById(key)
    if (!objectKey) {
      return res.status(403).json({
        message: 'Forbidden',
      })
    }
    ;(req as any).objKey = objectKey
    return next()
  } catch (error) {
    return res.status(403).json({
      message: 'Forbidden',
    })
  }
}

export const permission = (permission: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).objKey) {
      return res.status(403).json({
        message: 'No permission',
      })
    }

    const validPermission = permission.some((item) =>
      (req as any).objKey.permissions.includes(item)
    )
    if (!validPermission) {
      return res.status(403).json({
        message: 'No permission',
      })
    }
    return next()
  }
}
