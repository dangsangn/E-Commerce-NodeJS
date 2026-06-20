import { Schema, model } from 'mongoose'
import { required } from 'zod/mini'

const DOCUMENT_NAME = 'Shop'
const COLLECTION_NAME = 'Shops'

export const SHOP_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
})

const shopSchema = new Schema(
  {
    shop_owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shop_name: {
      type: String,
      trim: true,
      maxLength: 150,
    },
    shop_description: {
      type: String,
      default: '',
    },
    shop_logo: {
      type: String,
      default: '',
    },
    shop_status: {
      type: String,
      enum: Object.values(SHOP_STATUS),
      default: SHOP_STATUS.ACTIVE,
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  },
)

export const ShopModel = model(DOCUMENT_NAME, shopSchema)
