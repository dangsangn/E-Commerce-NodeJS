import mongoose from 'mongoose'
import { BadRequestError, NotFoundError } from '../../../core/error.response'
import { CheckoutService } from '../../checkout/service'
import { reserveInventory, releaseInventory } from '../../inventory/repository'
import { CartService } from '../../cart/service'
import { OrderRepository } from '../repository'
import { ORDER_STATUS } from '../model'

export class OrderService {
  /*
    createOrder — Create an official order.

    This is the most important function. Flow:
    1. Call checkoutReview again to validate + get the latest price
    2. Open a transaction
    3. Reserve inventory (atomically deduct stock)
    4. Create Order document
    5. Clear cart (or remove ordered items from cart)
    6. Commit / Rollback

    Why call checkoutReview again?
    → Because between the time the user views the checkout page and clicks "Place Order"
      several minutes may have passed. Prices may have changed, discounts expired,
      or stock may have run out. ALWAYS recalculate.
  */
  static createOrder = async ({
    cartId,
    userId,
    shop_order_ids,
    user_address,
    user_payment,
  }: {
    cartId: string
    userId: string
    shop_order_ids: any[]
    user_address: {
      street: string
      city: string
      state: string
      country: string
    }
    user_payment: {
      method: string
    }
  }) => {
    // 1. Call checkoutReview again — validate + get latest price
    const checkoutResult = await CheckoutService.checkoutReview({
      userId,
      shop_order_ids,
    })

    const { shop_order_ids_new, checkout_order } = checkoutResult

    // 2. Get all products that need stock deducted
    //    Flatten from shop_order_ids_new into a single products array
    const allProducts = shop_order_ids_new.flatMap(
      (shopOrder: any) => shopOrder.item_products,
    )

    // 3. Open a transaction
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      // 4. Reserve inventory for each product
      for (const product of allProducts) {
        const reservation = await reserveInventory({
          productId: product.productId,
          quantity: product.quantity,
          cartId,
          session,
        })

        /*
          If reservation === null → insufficient stock.
          findOneAndUpdate with condition { inven_stock: { $gte: quantity } }
          will return null when no matching document is found.
        */
        if (!reservation) {
          throw new BadRequestError(
            `Product ${product.name} is out of stock. Please update your cart.`,
          )
        }
      }

      // 5. Create Order document
      const newOrder = await OrderRepository.createOrder({
        payload: {
          order_userId: new mongoose.Types.ObjectId(userId),
          order_checkout: checkout_order,
          order_shipping: user_address,
          order_payment: user_payment,
          order_products: shop_order_ids_new,
          order_status: ORDER_STATUS.PENDING,
        },
        session,
      })

      if (!newOrder) {
        throw new BadRequestError('Failed to create order')
      }

      // 6. Clear cart after successful order placement
      //    Note: clearCart currently does not accept a session
      //    → For more safety, refactor clearCart to accept a session
      await CartService.removeProductsFromCart({
        userId,
        productIds: allProducts.map((product) => product.productId),
      })

      // 7. Commit transaction
      await session.commitTransaction()

      return newOrder
    } catch (error) {
      // Rollback all changes
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  /*
    getOrdersByUser — Get the list of orders for the current user.
  */
  static getOrdersByUser = async ({
    userId,
    page,
    limit,
  }: {
    userId: string
    page?: number
    limit?: number
  }) => {
    return OrderRepository.getOrdersByUserId({ userId, page, limit })
  }

  /*
    getOrderDetail — Get the details of a single order.
    Checks whether the order belongs to the current user (authorization).
  */
  static getOrderDetail = async ({
    orderId,
    userId,
  }: {
    orderId: string
    userId: string
  }) => {
    const order = await OrderRepository.getOrderById(orderId)
    if (!order) throw new NotFoundError('Order not found')

    // Authorization: only the user who created the order can view it
    if (order.order_userId.toString() !== userId) {
      throw new BadRequestError('You are not authorized to view this order')
    }

    return order
  }

  /*
    cancelOrder — Cancel an order.

    Only allowed when status = 'pending'.
    When cancelling:
    1. Restore inventory (releaseInventory)
    2. Update status = 'cancelled'
  */
  static cancelOrder = async ({
    orderId,
    userId,
  }: {
    orderId: string
    userId: string
  }) => {
    const order = await OrderRepository.getOrderById(orderId)
    if (!order) throw new NotFoundError('Order not found')

    // Authorization
    if (order.order_userId.toString() !== userId) {
      throw new BadRequestError('You are not authorized to cancel this order')
    }

    // Only cancel when status is pending
    if (order.order_status !== ORDER_STATUS.PENDING) {
      throw new BadRequestError(
        `Cannot cancel order with status: ${order.order_status}. Only pending orders can be cancelled.`,
      )
    }

    // Open a transaction
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      // 1. Restore inventory for each product
      const allProducts = order.order_products.flatMap(
        (shopOrder: any) => shopOrder.item_products,
      )

      for (const product of allProducts) {
        await releaseInventory({
          productId: product.productId,
          quantity: product.quantity,
          cartId: '', // can store cartId in the order to use here
          session,
        })
      }

      // 2. Update status = cancelled
      const cancelledOrder = await OrderRepository.updateOrderStatus({
        orderId,
        status: ORDER_STATUS.CANCELLED,
        session,
      })

      await session.commitTransaction()
      return cancelledOrder
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }
}
