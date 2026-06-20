import { AccessControl } from 'accesscontrol'
import { RoleModel } from '../models/role.model'

type Grant = {
  role: string
  resource: string
  action: string
  attributes: string
}

export default class AccessControlService {
  private static _ac: AccessControl | null = null // L1 in-memory
  private static _building: Promise<AccessControl> | null = null // single-slight lock

  static getAccessControl = async (): Promise<AccessControl> => {
    if (AccessControlService._ac) return AccessControlService._ac
    if (AccessControlService._building) return AccessControlService._building

    AccessControlService._building = (async () => {
      try {
        const grantList = await AccessControlService.buildFromDB()
        AccessControlService._ac = new AccessControl(grantList)
        return AccessControlService._ac
      } finally {
        AccessControlService._building = null
      }
    })()
    return AccessControlService._building
  }

  // call after write role, delete L1 (process Writing and reading simultaneously)
  static invalidate = () => {
    AccessControlService._ac = null
  }

  private static buildFromDB = async (): Promise<Grant[]> => {
    const roles = await RoleModel.find({}).lean()
    const list: Grant[] = []
    for (const role of roles) {
      for (const g of role.rol_grants || []) {
        for (const action of g.actions) {
          list.push({
            role: role.rol_name,
            resource: g.resource as string,
            action,
            attributes: g.attributes || '*',
          })
        }
      }
    }
    return list
  }
}
