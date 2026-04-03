import mongoose from 'mongoose'
import { OrderModel } from '../model'
import { createPaginationResponse, parsePagination } from '../../../utils'

export class OrderRepository {
  // Create an order — pass session to be part of a transaction
  static createOrder = async ({
    payload,
    session,
  }: {
    payload: any
    session: mongoose.ClientSession
  }) => {
    return (await OrderModel.create([payload], { session }))[0]
  }

  // Get a paginated list of orders for a user
  static getOrdersByUserId = async ({
    userId,
    page = 1,
    limit = 10,
  }: {
    userId: string
    page?: number
    limit?: number
  }) => {
    const {
      skip,
      limit: limitNum,
      page: pageNum,
    } = parsePagination({ page, limit })

    const [result, total] = await Promise.all([
      OrderModel.find({ order_userId: userId })
        .sort({ createdAt: -1 }) // newest first
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      OrderModel.countDocuments({ order_userId: userId }),
    ])

    return createPaginationResponse(result, total, pageNum, limitNum)
  }

  // Get details of a single order
  static getOrderById = async (orderId: string) => {
    return OrderModel.findById(orderId).lean().exec()
  }

  // Update an order's status
  static updateOrderStatus = async ({
    orderId,
    status,
    session,
  }: {
    orderId: string
    status: string
    session?: mongoose.ClientSession
  }) => {
    return OrderModel.findByIdAndUpdate(
      orderId,
      { order_status: status },
      { new: true, lean: true, session },
    )
  }
}
