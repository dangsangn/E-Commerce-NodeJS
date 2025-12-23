import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { ShopModel } from '../../shop/models'
import KeyTokenService from '../../keyToken/services'
import { createTokenPair } from '../utils'
import { getInfoData } from '../../../utils'

export const ROLES = {
  SHOP: 'shop',
  WRITER: 'writer',
  EDITOR: 'editor',
  ADMIN: 'admin',
}

class AuthService {
  static signup = async ({
    email,
    password,
    name,
  }: {
    email: string
    password: string
    name: string
  }) => {
    try {
      const existingShop = await ShopModel.findOne({ email }).lean()

      if (existingShop) {
        return {
          code: 'xxxx',
          message: 'Shop already exists',
        }
      }

      // salt and hash password
      const salt = await bcrypt.genSalt(10)
      const hashPassword = await bcrypt.hash(password, salt)
      const newShop = await ShopModel.create({
        email,
        password: hashPassword,
        name,
        roles: [ROLES.SHOP],
      })

      if (newShop) {
        // create private key and public key
        // const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        //   modulusLength: 4096,
        //   publicKeyEncoding: {
        //     type: 'pkcs1',
        //     format: 'pem',
        //   },
        //   privateKeyEncoding: {
        //     type: 'pkcs1',
        //     format: 'pem',
        //   },
        // })

        const privateKey = crypto.randomBytes(64).toString('hex')
        console.log('🚀 ~ privateKey:', privateKey)
        const publicKey = crypto.randomBytes(64).toString('hex')
        console.log('🚀 ~ publicKey:', publicKey)

        const keyToken = await KeyTokenService.createKeyToken({
          userId: String(newShop._id),
          publicKey: publicKey,
          privateKey: privateKey,
        })

        if (!keyToken) {
          return {
            code: 'xxxx',
            message: 'Create key token failed',
          }
        }

        const tokens = await createTokenPair(
          {
            userId: String(newShop._id),
            email,
          },
          publicKey,
          privateKey
        )

        return {
          code: '201',
          metadata: {
            shop: getInfoData({
              fields: ['_id', 'email', 'name'],
              object: newShop,
            }),
            tokens,
          },
        }
      }

      return {
        code: '200',
        metadata: null,
      }
    } catch (error) {
      throw error
    }
  }
}

export default AuthService
