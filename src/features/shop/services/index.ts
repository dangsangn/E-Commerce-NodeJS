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

  static getShops = async ({
    query,
    limit = 20,
    skip = 0,
    sort = { createdAt: -1 },
    select = {
      email: 1,
      name: 1,
      status: 1,
      verify: 1,
      roles: 1,
    },
  }: {
    query: Record<string, unknown>
    limit?: number
    skip?: number
    sort?: Record<string, 1 | -1>
    select?: Record<string, number>
  }) => {
    const shops = await ShopModel.find(query)
      .select(select)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()
    return shops
  }
}
