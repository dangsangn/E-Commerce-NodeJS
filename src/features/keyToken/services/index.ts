import { KeyTokenModel } from '../models'

class KeyTokenService {
  static createKeyToken = async ({
    userId,
    publicKey,
  }: {
    userId: string
    publicKey: string
  }) => {
    try {
      const publicKeyString = publicKey.toString()
      const tokens = await KeyTokenModel.create({
        user: userId,
        publicKey: publicKeyString,
      })
      return tokens ? tokens.publicKey : null
    } catch (error) {
      throw error
    }
  }
}

export default KeyTokenService
