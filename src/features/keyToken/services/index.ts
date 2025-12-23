import { KeyTokenModel } from '../models'

class KeyTokenService {
  static createKeyToken = async ({
    userId,
    publicKey,
    privateKey,
  }: {
    userId: string
    publicKey: string
    privateKey: string
  }) => {
    try {
      // const publicKeyString = publicKey.toString()
      const tokens = await KeyTokenModel.create({
        user: userId,
        publicKey: publicKey,
        privateKey: privateKey,
      })
      return tokens ? tokens.publicKey : null
    } catch (error) {
      throw error
    }
  }
}

export default KeyTokenService
