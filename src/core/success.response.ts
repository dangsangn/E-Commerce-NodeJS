import { Response } from 'express'
import { REASON_PHRASES, STATUS_CODES } from '../constants/httpStatusCode'

class SuccessResponse<T> {
  message: string
  statusCode: number
  data?: T
  constructor({
    message = REASON_PHRASES.OK,
    statusCode = STATUS_CODES.OK,
    data,
  }: {
    message?: string
    statusCode?: number
    data: T
  }) {
    this.message = message
    this.statusCode = statusCode
    this.data = data
  }

  send(res: Response) {
    return res.status(this.statusCode).json(this)
  }
}

class OkResponse<T> extends SuccessResponse<T> {
  constructor({ message, data }: { message?: string; data: T }) {
    super({ message, data })
  }

  static send<T>(
    res: Response,
    { message, data }: { message?: string; data: T }
  ) {
    return new OkResponse({ message, data }).send(res)
  }
}

class CreatedResponse<T> extends SuccessResponse<T> {
  constructor({ message, data }: { message?: string; data: T }) {
    super({ message, statusCode: STATUS_CODES.CREATED, data })
  }

  static send<T>(
    res: Response,
    { message, data }: { message?: string; data: T }
  ) {
    return new CreatedResponse({ message, data }).send(res)
  }
}

export { OkResponse, CreatedResponse }
