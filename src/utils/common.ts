import { Request, Response, NextFunction } from 'express'
import pick from 'lodash/pick'
import { PaginationParams, PaginationResponse } from '../types'

export const getInfoData = ({
  fields = [] as string[],
  object = {},
}: {
  fields: string[]
  object: any
}) => {
  return pick(object, fields)
}

export const asyncHandler = (
  func: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    func(req, res, next).catch(next)
  }
}

export const parsePagination = (pagination: PaginationParams) => {
  let {
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortType = 'desc',
  } = pagination
  page = Math.max(page, 1)
  limit = Math.max(Math.min(limit, 100), 1)
  const skip = (page - 1) * limit
  const sortOrder = sortType === 'asc' ? 1 : -1
  const sort = { [sortBy]: sortOrder }
  return { skip, limit, page, sort }
}

export const createPaginationResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginationResponse<T> => {
  const totalPages = Math.ceil(total / limit)
  const hasNextPage = page < totalPages
  const hasPreviousPage = page > 1
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPreviousPage,
    },
  }
}


export const removeNullUndefinedObject = (obj: any) => {
  return Object.keys(obj).reduce((acc, key) => {
    if (obj[key] !== undefined && obj[key] !== null) {
      acc[key] = removeNullUndefinedObject(obj[key])
    }
    return acc
  }, {} as Record<string, any>)
}

export const flattenObject = (
  obj: any,
  prefix = ''
): Record<string, any> => {
  return Object.keys(obj).reduce((acc, key) => {
    const value = obj[key]
    const path = prefix ? `${prefix}.${key}` : key

    if (value === undefined || value === null) {
      return acc
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(acc, flattenObject(value, path))
    } else {
      acc[path] = value
    }

    return acc
  }, {} as Record<string, any>)
}