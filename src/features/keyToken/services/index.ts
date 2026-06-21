import { Types } from 'mongoose'
import { KeyTokenModel } from '../models'

class KeyTokenService {
  static createKeyToken = async ({
    userId,
    secretKey,
    refreshToken = null,
  }: {
    userId: string
    secretKey: string
    refreshToken?: string | null
  }) => {
    const filter = { user: userId }
    const update = {
      secretKey,
      refreshTokensUsed: [],
      refreshToken: refreshToken,
    }
    const options = {
      upsert: true,
      new: true,
    }
    const tokens = await KeyTokenModel.findOneAndUpdate(filter, update, options)
    return tokens ? tokens.secretKey : null
  }

  static findByUserId = async (userId: string) => {
    return await KeyTokenModel.findOne({ user: userId }).lean()
  }

  static deleteKeyToken = async (userId: string) => {
    return await KeyTokenModel.deleteOne({ user: new Types.ObjectId(userId) })
  }

  static findByRefreshTokenUsed = async (refreshToken: string) => {
    return await KeyTokenModel.findOne({
      refreshTokensUsed: refreshToken,
    }).lean()
  }

  static deleteKeyTokenByRefreshToken = async (refreshToken: string) => {
    return await KeyTokenModel.deleteOne({ refreshToken: refreshToken })
  }

  static findByRefreshToken = async (refreshToken: string) => {
    return await KeyTokenModel.findOne({ refreshToken: refreshToken })
  }
}

export default KeyTokenService
