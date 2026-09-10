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
    /*
      The same coordinates as a scalar: [0, 1] -> "0-1", [] -> "".

      It exists only to carry the uniqueness constraint. Indexing sku_tier_idx
      directly makes a MULTIKEY index: Mongo indexes each ELEMENT of the array,
      not the array as one key, so [0,0] and [0,1] both emit the entry
      (product, 0) and the second insert dies with E11000. The bug hides on
      single-axis products — [0] and [1] never collide — and only appears the
      first time a shop adds a second axis.

      Derived at write time and never edited afterwards: changing a SKU's
      coordinates would re-point it at a different variant, which is why the
      seller UI does not offer it.
    */
    sku_tier_key: { type: String, required: true, default: '' },
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
// Do not allow two SKUs on the same cell of the same SPU — blocked at the DB layer,
// not trusted to validation in the application layer.
skuSchema.index({ sku_product_id: 1, sku_tier_key: 1 }, { unique: true })
skuSchema.index({ sku_code: 1 }, { unique: true })
skuSchema.index({ sku_product_id: 1, isDeleted: 1 }) // query list SKU of 1 SPU

export const skuModel = model(DOCUMENT_NAME, skuSchema)
