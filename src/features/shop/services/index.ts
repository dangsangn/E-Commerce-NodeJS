import { UserModel } from '../../user/models'
import { ShopModel } from '../models'

export default class ShopService {
  static findByEmail = async ({
    email,
  }: {
    email: string
    select?: Record<string, number>
  }) => {
    return ShopModel.aggregate([
      {
        $lookup: {
          from: 'Users',
          localField: 'shop_owner',
          foreignField: '_id',
          as: 'owner',
        },
      },
      {
        $unwind: '$owner',
      },
      {
        $match: { 'owner.usr_email': email },
      },
      {
        $project: {
          shop_name: 1,
          shop_logo: 1,
          shop_description: 1,
          owner_email: '$owner.usr_email',
          owner_name: '$owner.usr_name',
        },
      },
    ])
  }

  static getShops = async ({
    query,
    limit = 20,
    skip = 0,
    sort = { createdAt: -1 },
  }: {
    query: Record<string, unknown>
    limit?: number
    skip?: number
    sort?: Record<string, 1 | -1>
    select?: Record<string, number>
  }) => {
    const shops = await ShopModel.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'shop_owner',
        select: 'usr_email shop_name shop_logo shop_description',
      })
      .lean()
    return shops
  }
}
