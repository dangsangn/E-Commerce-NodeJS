import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { NextFunction, Request, Response } from 'express'
import { BadRequestError } from '../core/error.response'

export const validationMiddleware = (
  type: any,
  value: 'body' | 'query' | 'params' = 'body',
) => {
  return async (req: Request, response: Response, next: NextFunction) => {
    // 1. convert plain object to class instance
    const object = plainToInstance(type, req[value])

    // 2. validate class instance
    const errors = await validate(object)

    if (errors.length > 0) {
      const message = errors
        .map((error: any) => Object.values(error.constraints))
        .join(', ')
      next(new BadRequestError(message))
    } else {
      // 3. If ok, assign to request to controller use
      req[value] = object
      next()
    }
  }
}
