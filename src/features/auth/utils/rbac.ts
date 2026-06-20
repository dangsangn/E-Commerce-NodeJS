import { NextFunction, Request, Response } from 'express'
import { asyncHandler } from '../../../utils'
import { ForbiddenError } from '../../../core/error.response'
import AccessControlService from '../../rbac/services/access-control.service'

type ActionScope = 'create' | 'update' | 'read' | 'delete'

export const grantAccess = (action: ActionScope, resource: string) => {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const roles = req.user.roles || []
      if (!roles.length) throw new ForbiddenError('No role assigned')

      const ac = await AccessControlService.getAccessControl()

      const can = roles.some((role: any) => {
        const q = ac.can(role)
        const anyGranted = (q as any)[`${action}Any`]?.(resource)?.granted
        const ownGranted = (q as any)[`${action}Own`]?.(resource)?.granted
        return Boolean(anyGranted || ownGranted)
      })
      if (!can)
        throw new ForbiddenError(
          `You don't have permission to ${action} ${resource}`,
        )
      next()
    },
  )
}
