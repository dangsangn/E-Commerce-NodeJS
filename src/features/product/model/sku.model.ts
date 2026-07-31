import { model, Schema } from 'mongoose'
import { imageSchema } from '.'

const DOCUMENT_NAME = 'Sku'
const COLLECTION_NAME = 'Skus'

const skuSchema = new Schema(
  {
    // Business code — the one the shop/warehouse/accounting department can read visually.
    // Different from _id (technical code). Suggested format: `${spuId}-0-
    sku_code: { type: String, required: true },
    sku_product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    sku_shop_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Coordinates in the variant matrix. [] = No variant SPU (1 unique SKU)
    sku_tier_idx: { type: [Number], default: [] },
    sku_price: { type: Schema.Types.Decimal128, required: true },
    sku_thumb: { type: imageSchema, default: null },
    // Exactly 1 SKU/SPU with sku_default = true — SKU displayed when the page is first opened
    sku_default: { type: Boolean, default: false },

    isPublished: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  },
)
// Do not allow two SKUs with the same coordinates in the same SPU — blocking at the DB layer,
// Do not trust validation at the application layer
skuSchema.index({ sku_product_id: 1, sku_tier_idx: 1 }, { unique: true })
skuSchema.index({ sku_code: 1 }, { unique: true })
skuSchema.index({ sku_product_id: 1, isDeleted: 1 }) // query list SKU of 1 SPU

export const skuModel = model(DOCUMENT_NAME, skuSchema)
