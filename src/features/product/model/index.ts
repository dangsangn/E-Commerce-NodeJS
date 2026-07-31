import { model, Schema } from 'mongoose'
import slugify from 'slugify'

const DOCUMENT_NAME = 'Product'
const COLLECTION_NAME = 'Products'

export const productType = Object.freeze({
  ELECTRONICS: 'ELECTRONICS',
  CLOTHING: 'CLOTHING',
  SHOES: 'SHOES',
  OTHER: 'OTHER',
})

export const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
  },
  {
    _id: false,
  },
)

const variationSchema = new Schema(
  {
    name: { type: String, required: true }, // 'Color' | 'Size' | 'Storage'
    options: { type: [String], required: true }, // ['Red', 'Blue']
    images: { type: [imageSchema], default: [] }, // image according to the first axis option
  },
  {
    _id: false,
  },
)

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
    product_thumb_public_id: {
      type: String,
      required: true,
    },
    product_images: {
      type: [imageSchema],
      default: [], // gallery of images
    },
    product_slug: {
      type: String,
    },
    product_description: {
      type: String,
    },
    product_price: {
      type: Schema.Types.Decimal128,
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
      ref: 'User',
    },
    product_attributes: {
      type: Schema.Types.Mixed,
      required: true,
    },
    product_ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating must be at most 5'],
      set: (val: number) => Math.round(val * 10) / 10,
    },
    isDraft: {
      type: Boolean,
      default: true,
      index: true,
      select: false,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
      select: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: { type: Date, default: null },
    product_variations: {
      type: [variationSchema],
      default: [],
      validate: {
        validator: (v: any) => v.length <= 3,
        message: 'Max is 3-axis variant',
      },
    },
    product_price_min: { type: Schema.Types.Decimal128 },
    product_price_max: { type: Schema.Types.Decimal128 },
    product_sku_count: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  },
)

// create index for search
productSchema.index({ product_name: 'text', product_description: 'text' })

productSchema.pre('save', async function () {
  this.product_slug = slugify(this.product_name, { lower: true })
})

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
    collection: 'Clothes',
    timestamps: true,
  },
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
    collection: 'Electronics',
    timestamps: true,
  },
)

export const ProductModel = model(DOCUMENT_NAME, productSchema)
export const ClothingModel = model('Clothing', clothingSchema)
export const ElectronicModel = model('Electronic', electronicSchema)
