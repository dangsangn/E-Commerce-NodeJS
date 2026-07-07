import multer from 'multer'
import { BadRequestError } from '../../../core/error.response'
import { ROLE_NAME, RoleModel } from '../../rbac/models/role.model'
import { ShopModel } from '../../shop/models'
import { UserModel } from '../models'
import { validateImageBuffer } from '@/features/upload/validator/image.validator'
import { UploadService } from '@/features/upload/services'

export class UserService {
  static findByEmailWithPassword = async (email: string) => {
    return UserModel.findOne({ usr_email: email })
      .select('+usr_password')
      .populate({ path: 'usr_roles', select: 'rol_name' })
      .lean()
  }

  static findById = async (id: string) =>
    UserModel.findById(id).populate({ path: 'usr_roles', select: 'rol_name' })

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
  static updateAvatar = async ({
    file,
    userId,
  }: {
    file: Express.Multer.File
    userId: string
  }) => {
    const fileBuffer = file.buffer
    validateImageBuffer(fileBuffer)

    const user = await this.findById(userId)
    if (!user) throw new BadRequestError('User not found')
    const oldPublicId = user.usr_avatar_public_id

    const result = await UploadService.uploadBuffer(fileBuffer, {
      folder: `users/${userId}/avatar`,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      ],
    })
    user.usr_avatar = result.url
    user.usr_avatar_public_id = result.publicId
    await user.save()

    if (oldPublicId) await UploadService.destroy(oldPublicId)

    return { avatar: result.url }
  }
}
