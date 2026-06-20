import { model, Schema } from 'mongoose'

const DOCUMENT_NAME = 'Order'
const COLLECTION_NAME = 'Orders'

export const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPING: 'shipping',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
})

const orderSchema = new Schema(
  {
    order_userId: {
      type: Schema.Types.ObjectId,
      ref: 'User', // temporarily using Shop as User
      required: true,
    },
    /*
      order_checkout is a snapshot of the checkout result at the time of ordering.
      Saved so it can be retrieved later without recalculating.
      {
        totalPrice: number,      // total original price
        totalDiscount: number,   // total discount
        feeShip: number,         // shipping fee
        totalCheckout: number,   // actual total amount paid
      }
    */
    order_checkout: {
      type: Object,
      default: {},
      required: true,
    },
    /*
      order_shipping is a snapshot of the shipping information.
      {
        street: string,
        city: string,
        state: string,
        country: string,
      }
    */
    order_shipping: {
      type: Object,
      default: {},
      required: true,
    },
    /*
      order_payment is the payment information.
      {
        method: 'COD' | 'CARD' | 'MOMO',
      }
    */
    order_payment: {
      type: Object,
      default: {},
      required: true,
    },
    /*
      order_products is a snapshot of all products, grouped by shop.
      Structure is similar to shop_order_ids_new from checkout review:
      [
        {
          shopId: string,
          shop_discounts: [{ code, shopId }],
          item_products: [{ productId, price, quantity, name, thumb }],
          price_raw: number,
          price_apply_discount: number,
        }
      ]
    */
    order_products: {
      type: Array,
      required: true,
      default: [],
    },
    order_tracking_number: {
      type: String,
      default: '',
    },
    order_status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  },
)

export const OrderModel = model(DOCUMENT_NAME, orderSchema)
