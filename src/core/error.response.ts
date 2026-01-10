import { REASON_PHRASES, STATUS_CODES } from '../constants/httpStatusCode'

class ErrorResponse extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

class ConflictRequestError extends ErrorResponse {
  constructor(
    message: string = REASON_PHRASES.CONFLICT,
    status: number = STATUS_CODES.CONFLICT
  ) {
    super(message, status)
  }
}

class BadRequestError extends ErrorResponse {
  constructor(
    message: string = REASON_PHRASES.BAD_REQUEST,
    status: number = STATUS_CODES.BAD_REQUEST
  ) {
    super(message, status)
  }
}

class NotFoundError extends ErrorResponse {
  constructor(
    message: string = REASON_PHRASES.NOT_FOUND,
    status: number = STATUS_CODES.NOT_FOUND
  ) {
    super(message, status)
  }
}

class UnauthorizedError extends ErrorResponse {
  constructor(
    message: string = REASON_PHRASES.UNAUTHORIZED,
    status: number = STATUS_CODES.UNAUTHORIZED
  ) {
    super(message, status)
  }
}

class ForbiddenError extends ErrorResponse {
  constructor(
    message: string = REASON_PHRASES.FORBIDDEN,
    status: number = STATUS_CODES.FORBIDDEN
  ) {
    super(message, status)
  }
}

class InternalServerError extends ErrorResponse {
  constructor(
    message: string = REASON_PHRASES.INTERNAL_SERVER_ERROR,
    status: number = STATUS_CODES.INTERNAL_SERVER_ERROR
  ) {
    super(message, status)
  }
}

export {
  ConflictRequestError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  InternalServerError,
}
