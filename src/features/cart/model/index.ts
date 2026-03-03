import { model, Schema } from 'mongoose'

const DOCUMENT_NAME = 'Cart'
const COLLECTION_NAME = 'carts'

export const CART_STATE = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
})

export const cartProductSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    name: {
      type: String,
      required: true,
    },
    thumb: {
      type: String,
      required: true,
    },
  },
  { _id: false },
)

const cartSchema = new Schema(
  {
    // tamp shop as user, implement user model later
    cart_userId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      unique: true,
    },
    cart_products: {
      type: [cartProductSchema],
      required: true,
      default: [],
    },
    cart_state: {
      type: String,
      required: true,
      enum: Object.values(CART_STATE),
      default: CART_STATE.ACTIVE,
    },
    cart_count_product: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, collection: COLLECTION_NAME },
)

export const CartModel = model(DOCUMENT_NAME, cartSchema)
