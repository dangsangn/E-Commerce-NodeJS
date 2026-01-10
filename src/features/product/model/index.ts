import { model, Schema } from 'mongoose'

const DOCUMENT_NAME = 'Product'
const COLLECTION_NAME = 'Products'

export const productType = Object.freeze({
  ELECTRONICS: 'ELECTRONICS',
  CLOTHING: 'CLOTHING',
  SHOES: 'SHOES',
  OTHER: 'OTHER',
})

const productSchema = new Schema(
  {
    product_name: {
      type: String,
      required: true,
    },
    product_thumb: {
      type: String,
      required: true,
    },
    product_description: {
      type: String,
    },
    product_price: {
      type: Number,
      required: true,
    },
    product_quantity: {
      type: Number,
      required: true,
    },
    product_type: {
      type: String,
      required: true,
      enum: Object.values(productType),
    },
    product_shop: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
    },
    product_attributes: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
)

export const clothingSchema = new Schema(
  {
    brand: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      required: true,
    },
    material: {
      type: String,
    },
    product_shop: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
    },
  },
  {
    collection: 'clothes',
    timestamps: true,
  }
)

export const electronicSchema = new Schema(
  {
    manufacturer: {
      type: String,
      required: true,
    },
    model: {
      type: String,
    },
    product_shop: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
    },
  },
  {
    collection: 'electronics',
    timestamps: true,
  }
)

export const ProductModel = model(DOCUMENT_NAME, productSchema)
export const ClothingModel = model('Clothing', clothingSchema)
export const ElectronicModel = model('Electronic', electronicSchema)
