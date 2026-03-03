import mongoose from 'mongoose'
import { CART_STATE, CartModel } from '../model'

export class CartRepository {
  // get cart of user active
  static findActiveCartByUserId = async (userId: string) => {
    return CartModel.findOne({
      cart_userId: userId,
      cart_status: CART_STATE.ACTIVE,
    })
      .lean()
      .exec()
  }

  // create new cart (supports single or multiple products)
  static createCart = async (userId: string, products: any) => {
    const totalQuantity = products.reduce(
      (sum: number, p: any) => sum + (p.quantity ?? 1),
      0,
    )
    return CartModel.create({
      cart_userId: new mongoose.Types.ObjectId(userId),
      cart_products: products,
      cart_count_product: totalQuantity,
    })
  }
}
