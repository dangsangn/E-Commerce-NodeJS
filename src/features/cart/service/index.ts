import {
  BadRequestError,
  ConflictRequestError,
  NotFoundError,
} from '../../../core/error.response'
import { ProductRepository } from '../../product/repository'
import { CartRepository } from '../repository'

export class CartService {
  static addToCart = async ({
    userId,
    productId,
    quantity,
  }: {
    userId: string
    productId: string
    quantity: number
  }) => {
    // 1. validate product is exist and published
    const product = await ProductRepository.getProductPublishedById(productId, [
      'product_name',
      'product_thumb',
      'product_price',
      'product_shop',
      'product_quantity',
    ])
    if (!product) throw new NotFoundError('Product not found or not published!')

    if (product.product_quantity < quantity)
      throw new BadRequestError('Product quantity is not enough!')

    const cartProduct = {
      productId: product._id,
      shopId: product.product_shop,
      name: product.product_name,
      thumb: product.product_thumb,
      price: product.product_price,
      quantity,
    }

    // find cart current of user
    const existingCart = await CartRepository.findActiveCartByUserId(userId)
    if (!existingCart) {
      return CartRepository.createCart(userId, cartProduct)
    }

    // if having products in cart => check if product exists
    const existingProduct = existingCart.cart_products.find(
      (p) => p.productId.toString() === productId,
    )

    if (existingProduct) {
      const newQuantity = existingProduct.quantity + quantity
      if (newQuantity > product.product_quantity)
        throw new BadRequestError('Product quantity is not enough!')

      return CartRepository.updateProductQuantity({
        cartId: existingCart._id.toString(),
        productId,
        oldQuantity: existingProduct.quantity,
        newQuantity,
      })
    }

    // if cart exists but does not have this product
    return CartRepository.pushProductToCart(
      existingCart._id.toString(),
      cartProduct,
    )
  }

  static updateCartProductQuantity = async ({
    userId,
    productId,
    oldQuantity,
    newQuantity,
  }: {
    userId: string
    productId: string
    oldQuantity: number
    newQuantity: number
  }) => {
    if (newQuantity < 0)
      throw new BadRequestError('quantity must be greater than 0!')

    if (oldQuantity < 1)
      throw new BadRequestError('old quantity must be greater than 0!')

    const cart = await CartRepository.findActiveCartByUserId(userId)
    if (!cart) throw new NotFoundError('Cart not found!')

    // newQuantity = 0 => delete product
    if (newQuantity === 0) {
      return CartRepository.removeProductFromCart(
        cart._id.toString(),
        productId,
        oldQuantity,
      )
    }

    // check inventory before update
    const product = await ProductRepository.getProductPublishedById(productId, [
      'product_quantity',
    ])
    if (!product) throw new NotFoundError('Product not found!')
    if (product.product_quantity < newQuantity) {
      throw new BadRequestError(
        `Only ${product.product_quantity} items in stock`,
      )
    }

    // condition update - only success when oldQuantity match
    const updated = await CartRepository.updateProductQuantity({
      cartId: cart._id.toString(),
      productId,
      oldQuantity,
      newQuantity,
    })

    if (!updated) {
      throw new ConflictRequestError(
        'Cart was updated by other request. Please request and try again',
      )
    }
    return updated
  }

  static removeFromCart = async ({
    userId,
    productId,
    oldQuantity,
  }: {
    userId: string
    productId: string
    oldQuantity: number
  }) => {
    const cart = await CartRepository.findActiveCartByUserId(userId)
    if (!cart) throw new NotFoundError('Cart not found')

    const updated = await CartRepository.removeProductFromCart(
      cart._id.toString(),
      productId,
      oldQuantity,
    )
    if (!updated)
      throw new ConflictRequestError(
        'Cart was updated by other request. Please request and try again',
      )

    return updated
  }

  static getCart = async ({ userId }: { userId: string }) => {
    const cart = await CartRepository.findActiveCartByUserId(userId)
    if (!cart)
      return {
        cart_products: [],
        cart_count_product: 0,
      }
    return cart
  }

  // clear cart
  static clearCart = async ({ userId }: { userId: string }) => {
    return CartRepository.deleteCartByUserId(userId)
  }

  // remove multiple products from cart
  static removeProductsFromCart = async ({
    userId,
    productIds,
  }: {
    userId: string
    productIds: string[]
  }) => {
    const cart = await CartRepository.findActiveCartByUserId(userId)
    if (!cart) throw new NotFoundError('Cart not found')

    const updated = await CartRepository.removeProductsFromCart(
      cart._id.toString(),
      productIds,
    )
    if (!updated) {
      throw new ConflictRequestError(
        'Cart was updated by other request. Please request and try again',
      )
    }

    return updated
  }
}
