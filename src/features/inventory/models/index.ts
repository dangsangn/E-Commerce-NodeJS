import { model, Schema } from 'mongoose'

const DOCUMENT_NAME = 'Inventory'
const COLLECTION_NAME = 'Inventories'

const inventorySchema = new Schema(
  {
    inven_shop_id: { type: Schema.Types.ObjectId, ref: 'Shop' },
    inven_product_id: { type: Schema.Types.ObjectId, ref: 'Product' },
    inven_sku_id: { type: Schema.Types.ObjectId, ref: 'Sku', required: true },
    inven_stock: { type: Number, required: true },
    inven_location: { type: String, default: 'unKnow' },
    inven_reservation: { type: Array, default: [] },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  },
)

// One SKU, one record exists — blocking in the DB
inventorySchema.index({ inven_sku_id: 1 }, { unique: true })

export const InventoryModel = model(DOCUMENT_NAME, inventorySchema)
