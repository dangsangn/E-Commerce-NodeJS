import { Types } from 'mongoose'

/**
 * KeyToken type based on MongoDB model
 */
export interface KeyToken {
  _id?: Types.ObjectId
  user: Types.ObjectId
  secretKey: string
  refreshTokensUsed: string[]
  refreshToken: string | null
  createdAt?: Date
  updatedAt?: Date
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      keyToken?: KeyToken
      user?: TokenPayload
      objKey?: any // API key object (can be typed later if needed)
    }
  }
}

// Make this file a module
export {}
