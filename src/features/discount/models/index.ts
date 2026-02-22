import { model, Schema } from 'mongoose'

const DOCUMENT_NAME = 'Discount'
const COLLECTION_NAME = 'Discounts'

const DiscountSchema = new Schema(
  {
    discount_name: {
      type: String,
      required: true,
    },
    discount_description: {
      type: String,
      required: true,
    },
    discount_code: {
      type: String,
      required: true,
      unique: true,
    },
    discount_type: {
      type: String,
      required: true,
      enum: ['fixed_amount', 'percentage'],
    },
    discount_value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    discount_start_date: {
      type: Date,
      required: true,
    },
    discount_end_date: {
      type: Date,
      required: true,
    },
    discount_max_uses_per_user: {
      type: Number,
      default: 1,
    },
    discount_uses_count: {
      type: Number,
      default: 0,
    },
    discount_users_used: {
      type: Array,
      default: [],
    },
    discount_shop_id: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
    },
    discount_min_order_value: {
      type: Number,
      default: 0,
    },

    discount_is_active: {
      type: Boolean,
      default: true,
    },
    discount_applies_to: {
      type: String,
      required: true,
      enum: ['all', 'specific_products'],
    },
    discount_product_ids: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
)

export const DiscountModel = model(DOCUMENT_NAME, DiscountSchema)

// create data example to test
/*
{
  discount_name: 'Summer Sale',
  discount_description: 'Summer Sale',
  discount_code: 'SUMMER_SALE',
  discount_type: 'percentage',
  discount_value: 10,
  discount_start_date: new Date(),
  discount_end_date: new Date(),
  discount_max_uses_per_user: 1,
  discount_uses_count: 0,
  discount_users_used: [],
  discount_shop_id: '507f1f77bcf86cd799439011',
  discount_min_order_value: 100,
  discount_is_active: true,
  discount_applies_to: 'all',
  discount_product_ids: [],
}
*/
