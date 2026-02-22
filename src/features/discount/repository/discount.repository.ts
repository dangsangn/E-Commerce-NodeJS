import { CreateDiscountDTO, QueryDiscountDTO, UpdateDiscountDTO } from '../dtos'
import { DiscountModel } from '../models'
import { QueryFilter } from 'mongoose'

class DiscountRepository {
  static async findByCode(code: string) {
    return await DiscountModel.findOne({ discount_code: code }).lean()
  }

  static async create(payload: CreateDiscountDTO) {
    return await DiscountModel.create({
      ...payload,
      discount_uses_count: 0,
      discount_users_used: [],
    })
  }

  static async findById(id: string) {
    return await DiscountModel.findById(id)
  }

  static async findByShopId(shopId: string, isActive?: boolean) {
    const filter: QueryFilter<any> = { discount_shop_id: shopId }
    if (isActive !== undefined) filter.discount_is_active = isActive

    return await DiscountModel.find(filter).sort({ createdAt: -1 }).lean()
  }

  static async findWithPagination(query: QueryDiscountDTO) {
    const { page = 1, limit = 10, sort = '-createdAt', ...filter } = query

    // build filter object
    const filterQuery: QueryFilter<any> = {}
    if (filter.discount_code) {
      filterQuery.discount_code = filter.discount_code
    }
    if (filter.discount_shop_id) {
      filterQuery.discount_shop_id = filter.discount_shop_id
    }
    if (filter.discount_type) {
      filterQuery.discount_type = filter.discount_type
    }
    if (filter.discount_is_active) {
      filterQuery.discount_is_active = filter.discount_is_active
    }

    // calculate skip
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      DiscountModel.find(filterQuery).sort(sort).skip(skip).limit(limit).lean(),
      DiscountModel.countDocuments(filterQuery),
    ])

    return {
      data,
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  static async update(id: string, payload: UpdateDiscountDTO) {
    return await DiscountModel.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    }).lean()
  }

  static async softDelete(id: string) {
    return await DiscountModel.findByIdAndUpdate(
      id,
      { discount_is_active: false },
      { new: true },
    ).lean()
  }

  static async delete(id: string) {
    return await DiscountModel.findByIdAndDelete(id).lean()
  }

  // business logic
  static async incrementUserCount(discountId: string, userId: string) {
    return await DiscountModel.findByIdAndUpdate(
      discountId,
      {
        $inc: { discount_uses_count: 1 },
        $push: { discount_users_used: userId },
      },
      { new: true },
    ).lean()
  }

  static async hasUserUsedDiscount(discountId: string, userId: string) {
    return await DiscountModel.findOne({
      _id: discountId,
      discount_users_used: userId, // query array, mongoose auto check if element exist in array
    }).lean()
  }

  static async countUserUsage(discountId: string, userId: string) {
    const result = await DiscountModel.aggregate([
      { $match: { _id: discountId } },
      {
        $project: {
          count: {
            $size: {
              $filter: {
                input: '$discount_users_used',
                as: 'userId',
                cond: { $eq: ['$$userId', userId] },
              },
            },
          },
        },
      },
    ])

    return result[0].count || 0
  }
}

export default DiscountRepository
