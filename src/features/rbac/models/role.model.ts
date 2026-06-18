import { model, Schema } from 'mongoose'

const DOCUMENT_NAME = 'Role'
const COLLECTION_NAME = 'Roles'

export const ROLE_STATUS = Object.freeze({
  ACTIVE: 'active',
  BLOCK: 'block',
  PENDING: 'pending',
})

export const ROLE_NAME = Object.freeze({
  USER: 'user',
  SHOP: 'shop',
  ADMIN: 'admin',
})

const roleSchema = new Schema(
  {
    rol_name: {
      type: String,
      enum: Object.values(ROLE_NAME),
      default: ROLE_NAME.USER,
      required: true,
      trim: true,
    },
    rol_slug: { type: String, require: true },
    rol_status: {
      type: String,
      enum: Object.values(ROLE_STATUS),
      default: ROLE_STATUS.ACTIVE,
    },
    rol_description: {
      type: String,
      default: '',
    },
    rol_grants: [
      {
        resource: { type: String, require: true }, // 'product' | 'order' | ...
        actions: { type: [String], require: true }, // ['create:any', 'read:own', ...]
        attributes: { type: String, default: '*' }, // '*, !usr_password'
      },
    ],
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  },
)

export const RoleModel = model(DOCUMENT_NAME, roleSchema)
