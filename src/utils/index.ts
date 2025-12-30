import { Request, Response, NextFunction } from 'express'
import pick from 'lodash/pick'

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
