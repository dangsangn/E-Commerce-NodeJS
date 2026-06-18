import { Schema } from 'mongoose'

const DOCUMENT_NAME = 'User'
const COLLECTION_NAME = 'Users'

const userSchema = new Schema({
  usr_slug: { type: String, default: '' },
  usr_name: { type: String, default: '', maxLength: 150, trim: true },
  usr_email: { type: String, require: true, unique: true, trim: true },
  usr_phone: { type: String, default: '' },

  usr_password: { type: String, require: true, select: false },
  usr_salt: { type: String, default: '', select: false },

  usr_avatar: { type: String, default: '' },
  usr_sex: { type: String, default: '' },
  usr_date_of_birth: { type: Date, default: null },
})
