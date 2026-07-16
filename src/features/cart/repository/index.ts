import mongoose from 'mongoose'
import { CART_STATE, CartModel } from '../model'

export class CartRepository {
  // get cart of user active
  static findActiveCartByUserId = async (userId: string) => {
    return CartModel.findOne({
      cart_userId: userId,
      cart_state: CART_STATE.ACTIVE,
    })
      .lean()
      .exec()
  }

  // create new cart (supports single or multiple products)
  static createCart = async (userId: string, product: any) => {
    return CartModel.create({
      cart_userId: new mongoose.Types.ObjectId(userId),
      cart_products: [product],
      cart_count_product: product.quantity,
    })
  }

  // add product to cart
  static pushProductToCart = async (cartId: string, product: any) => {
    return CartModel.findByIdAndUpdate(
      cartId,
      {
        $push: { cart_products: product },
        $inc: { cart_count_product: product.quantity },
      },
      {
        new: true,
        lean: true,
      },
    )
  }

  // update quantity product in cart
  // avoid race condition
  static updateProductQuantity = async ({
    cartId,
    productId,
    oldQuantity,
    newQuantity,
  }: {
    cartId: string
    productId: string
    oldQuantity: number
    newQuantity: number
  }) => {
    const quantityDiff = newQuantity - oldQuantity
    return CartModel.findOneAndUpdate(
      {
        _id: cartId,
        'cart_products.productId': productId,
        'cart_products.quantity': oldQuantity, // optimistic lock
      },
      {
        $set: { 'cart_products.$.quantity': newQuantity },
        $inc: { cart_count_product: quantityDiff },
      },
      {
        new: true,
        lean: true,
      },
    )
  }

  // remove product from cart
  static removeProductFromCart = async (
    cartId: string,
    productId: string,
    oldQuantity: number,
  ) => {
    return CartModel.findOneAndUpdate(
      {
        _id: cartId,
        'cart_products.productId': productId,
        'cart_products.quantity': oldQuantity, // optimistic when delete
      },
      {
        $pull: {
          cart_products: { productId: new mongoose.Types.ObjectId(productId) },
        },
        $inc: { cart_count_product: -oldQuantity },
      },
      {
        new: true,
        lean: true,
      },
    )
  }

  // remove multiple products from cart
  static removeProductsFromCart = async (
    cartId: string,
    productIds: string[],
  ) => {
    const objectProductIds = productIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    )

    return CartModel.findOneAndUpdate(
      { _id: cartId, cart_state: CART_STATE.ACTIVE },
      [
        {
          $set: {
            cart_products: {
              $filter: {
                input: '$cart_products',
                as: 'item',
                cond: {
                  $not: {
                    $in: ['$$item.productId', objectProductIds],
                  },
                },
              },
            },
          },
        },
        {
          $set: {
            cart_count_product: {
              $sum: '$cart_products.quantity',
            },
          },
        },
      ],
      {
        new: true,
        lean: true,
        // Mongoose 9 no longer auto-detects an array update as an aggregation
        // pipeline — it must be opted into explicitly.
        updatePipeline: true,
      },
    )
  }

  // delete cart after checkout
  static deleteCartByUserId = async (userId: string) => {
    return CartModel.findOneAndDelete({
      cart_userId: userId,
    })
  }
}
