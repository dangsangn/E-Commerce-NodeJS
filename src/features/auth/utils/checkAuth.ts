import { NextFunction, Request, Response } from 'express'
import { findById } from '../../apiKey/services'
import { ForbiddenError, UnauthorizedError } from '../../../core/error.response'
import { asyncHandler } from '../../../utils'
import KeyTokenService from '../../keyToken/services'
import { TokenPayload, verifyToken } from '.'

export const HEADER = {
  API_KEY: 'x-api-key',
  AUTHORIZATION: 'authorization',
  CLIENT_ID: 'x-client-id',
}

export const apiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const key = req.headers[HEADER.API_KEY]?.toString() as string
    if (!key) {
      throw new ForbiddenError('Forbidden')
    }
    const objectKey = await findById(key)
    if (!objectKey) {
      throw new ForbiddenError('Forbidden')
    }
    ;(req as any).objKey = objectKey
    return next()
  } catch (error) {
    throw new ForbiddenError('Forbidden')
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

export const authentication = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.headers[HEADER.CLIENT_ID]?.toString()
    if (!userId) throw new ForbiddenError('Forbidden')

    const keyToken = await KeyTokenService.findByUserId(userId)
    if (!keyToken) throw new ForbiddenError('Forbidden')

    const accessToken = req.headers[HEADER.AUTHORIZATION]?.toString()
    if (!accessToken) throw new UnauthorizedError('Unauthorized')

    const decoded = verifyToken(accessToken, keyToken.secretKey) as TokenPayload
    if (decoded.userId !== userId) throw new UnauthorizedError('Unauthorized')
    req.keyToken = keyToken
    return next()
  }
)
