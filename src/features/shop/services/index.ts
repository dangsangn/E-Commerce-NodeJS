import { ShopModel } from '../models'

export default class ShopService {
  static findByEmail = async ({
    email,
    select = {
      email: 1,
      name: 1,
      status: 1,
      verify: 1,
      roles: 1,
      password: 1,
    },
  }: {
    email: string
    select?: Record<string, number>
  }) => {
    const newShop = await ShopModel.findOne({ email }).select(select).lean()
    return newShop
  }
}
