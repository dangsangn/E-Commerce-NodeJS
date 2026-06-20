import { ResourceModel } from '../models/resource.model'
import { RoleModel } from '../models/role.model'
import AccessControlService from './access-control.service'

type CreateRoleProps = {
  rol_name: string
  rol_slug?: string
  rol_description?: string
  rol_grants: Array<{
    resource: string
    actions: Array<string>
    attributes: string
  }>
}

export default class RoleService {
  static createRole = async (payload: CreateRoleProps) => {
    await RoleService.assertResourceExist(payload.rol_grants) // validate resource name
    const role = await RoleModel.create(payload)
    AccessControlService.invalidate()
    return role
  }

  static updateRole = async (id: string, payload: any) => {
    if (payload.rol_grants)
      await RoleService.assertResourceExist(payload.rol_grants)
    const role = await RoleModel.findByIdAndUpdate(id, payload, { new: true })
    AccessControlService.invalidate()
    return role
  }

  static getRoles = () => RoleModel.find({}).lean()

  // registry validate resource name in grant is valid
  private static assertResourceExist = async (
    grants: { resource: string }[],
  ) => {
    const names = [...new Set(grants.map((g) => g.resource))]
    const found = await ResourceModel.find({ src_name: { $in: names } })
      .select('src_name')
      .lean()
    const ok = new Set(found.map((r) => r.src_name))
    const missing = names.filter((n) => !ok.has(n))

    if (missing.length)
      throw new Error(`Unknown resource(s): ${missing.join(', ')}`)
  }
}
