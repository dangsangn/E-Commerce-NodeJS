import { model, Schema } from 'mongoose'

const DOCUMENT_NAME = 'Resource'
const COLLECTION_NAME = 'Resources'

const resourceSchema = new Schema(
  {
    src_name: { type: String, required: true, unique: true, trim: true }, //ex: 'products', 'orders', 'users'
    src_slug: { type: String, default: '' },
    src_description: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  },
)

export const ResourceModel = model(DOCUMENT_NAME, resourceSchema)
