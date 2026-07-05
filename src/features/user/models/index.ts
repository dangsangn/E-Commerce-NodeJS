import { model, Schema } from 'mongoose'

const DOCUMENT_NAME = 'User'
const COLLECTION_NAME = 'Users'

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  BLOCK: 'block',
})

const userSchema = new Schema(
  {
    usr_slug: { type: String, default: '' },
    usr_name: { type: String, default: '', maxLength: 150, trim: true },
    usr_email: { type: String, required: true, unique: true, trim: true },
    usr_phone: { type: String, default: '' },

    usr_password: { type: String, required: true, select: false },
    usr_salt: { type: String, default: '', select: false },

    usr_avatar: { type: String, default: '' },
    usr_avatar_public_id: { type: String, default: '' },
    usr_sex: { type: String, default: '' },
    usr_date_of_birth: { type: Date, default: null },

    usr_roles: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Role',
      },
    ],

    usr_status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    usr_verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  },
)

export const UserModel = model(DOCUMENT_NAME, userSchema)
