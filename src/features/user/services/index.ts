import { BadRequestError } from '../../../core/error.response'
import { ROLE_NAME, RoleModel } from '../../rbac/models/role.model'
import { ShopModel } from '../../shop/models'
import { UserModel } from '../models'

export class UserService {
  static findByEmailWithPassword = async (email: string) => {
    return UserModel.findOne({ usr_email: email })
      .select('+usr_password')
      .populate({ path: 'usr_roles', select: 'rol_name' })
      .lean()
  }

  static findById = async (id: string) =>
    UserModel.findById(id)
      .populate({ path: 'usr_roles', select: 'rol_name' })
      .lean()

  static createUser = async (payload: any) => UserModel.create(payload)

  static upgradeToShop = async (userId: string, shopName?: string) => {
    const shopRole = await RoleModel.findOne({
      rol_name: ROLE_NAME.SHOP,
    }).lean()
    if (!shopRole) throw new BadRequestError('SHop role not configured')

    // $addToSet: not add duplicate if is really shop (idempotent)
    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        $addToSet: { usr_roles: shopRole._id },
      },
      { new: true },
    ).populate({
      path: 'usr_roles',
      select: 'rol_name',
    })
    if (!user) throw new BadRequestError('User not found')

    const existedSHop = await ShopModel.findOne({ shop_owner: userId })
    if (!existedSHop) {
      await ShopModel.create({
        shop_owner: userId,
        shop_name: shopName || user.usr_name,
      })
    }

    const roles = (user.usr_roles as any[]).map((r) => r.rol_name)
    return { user, roles }
  }
}
