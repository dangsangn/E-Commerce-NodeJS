import { ShopModel } from '../features/shop/models'
import { UserModel } from '../features/user/models'
import { RoleModel, ROLE_NAME } from '../features/rbac/models/role.model'
import { KeyTokenModel } from '../features/keyToken/models'
import { OrderModel } from '../features/order/model'

export async function up() {
  const shopRole = await RoleModel.findOne({ rol_name: ROLE_NAME.SHOP }).lean()

  // Bỏ các index cũ (email_1, ...) trước khi $unset field auth.
  // Nếu không, khi xoá field email khỏi nhiều shop, index unique sẽ coi
  // các document thiếu email là null → trùng key null → E11000.
  const legacyIndexes = ['email_1']
  const existing = await ShopModel.collection.indexes()
  for (const name of legacyIndexes) {
    if (existing.some((idx) => idx.name === name)) {
      await ShopModel.collection.dropIndex(name)
      console.log(`dropped legacy index ${name} on Shops`)
    }
  }

  // đọc shop cũ KÈM field auth (qua collection thô, vì schema đã refactor)
  const oldShops = await ShopModel.collection
    .find({ email: { $exists: true } })
    .toArray()

  for (const shop of oldShops) {
    const user = await UserModel.findOneAndUpdate(
      { usr_email: shop.email },
      {
        usr_email: shop.email,
        usr_password: shop.password, // hash sẵn — copy nguyên
        usr_name: shop.name,
        usr_roles: [shopRole!._id],
        usr_status: 'active',
        usr_verified: shop.verify ?? false,
      },
      { upsert: true, new: true },
    )

    await ShopModel.collection.updateOne(
      { _id: shop._id },
      {
        $set: { shop_owner: user._id },
        $unset: { email: '', password: '', roles: '', verify: '', status: '' },
      },
    )
    await KeyTokenModel.updateMany(
      { user: shop._id },
      { $set: { user: user._id } },
    )
    await OrderModel.updateMany(
      { order_userId: shop._id },
      { $set: { order_userId: user._id } },
    )

    console.log(`migrated ${shop.email} → user ${user._id}`)
  }
}
