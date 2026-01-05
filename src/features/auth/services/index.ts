import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { ShopModel } from '../../shop/models'
import KeyTokenService from '../../keyToken/services'
import { createTokenPair, TokenPayload, verifyToken } from '../utils'
import { getInfoData } from '../../../utils'
import {
  BadRequestError,
  UnauthorizedError,
} from '../../../core/error.response'
import ShopService from '../../shop/services'

export const ROLES = {
  SHOP: 'shop',
  WRITER: 'writer',
  EDITOR: 'editor',
  ADMIN: 'admin',
}

class AuthService {
  static login = async ({
    email,
    password,
  }: {
    email: string
    password: string
  }) => {
    const shop = await ShopService.findByEmail({ email })
    if (!shop) {
      throw new BadRequestError('Shop not found')
    }

    const isMatchPassword = await bcrypt.compare(password, shop.password)
    if (!isMatchPassword) {
      throw new UnauthorizedError('Invalid password')
    }

    // Generate secret key for HS256 (symmetric encryption)
    const secretKey = crypto.randomBytes(64).toString('hex')

    const tokens = await createTokenPair(
      {
        userId: String(shop._id),
        email,
      },
      secretKey
    )

    // Store key in database (for token refresh/revocation)
    const keyToken = await KeyTokenService.createKeyToken({
      userId: String(shop._id),
      secretKey,
      refreshToken: tokens.refreshToken,
    })

    if (!keyToken) {
      throw new BadRequestError('Create key token failed')
    }

    return {
      shop: getInfoData({
        fields: ['_id', 'email', 'name'],
        object: shop,
      }),
      tokens,
    }
  }

  static signup = async ({
    email,
    password,
    name,
  }: {
    email: string
    password: string
    name: string
  }) => {
    const existingShop = await ShopModel.findOne({ email }).lean()

    if (existingShop) {
      throw new BadRequestError('Shop already exists')
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

      // Generate secret key for HS256 (symmetric encryption)
      const secretKey = crypto.randomBytes(64).toString('hex')

      const keyToken = await KeyTokenService.createKeyToken({
        userId: String(newShop._id),
        secretKey,
      })

      if (!keyToken) {
        throw new BadRequestError('Create key token failed')
      }

      const tokens = await createTokenPair(
        {
          userId: String(newShop._id),
          email,
        },
        secretKey
      )

      return {
        shop: getInfoData({
          fields: ['_id', 'email', 'name'],
          object: newShop,
        }),
        tokens,
      }
    }

    return null
  }

  static logout = async ({ userId }: { userId: string }) => {
    return await KeyTokenService.deleteKeyToken(userId)
  }

  static refreshToken = async ({ refreshToken }: { refreshToken: string }) => {
    const foundToken = await KeyTokenService.findByRefreshTokenUsed(
      refreshToken
    )
    if (foundToken) {
      await KeyTokenService.deleteKeyTokenByRefreshToken(refreshToken)
      throw new BadRequestError('Refresh token is used. Please login again.')
    }

    const holdToken = await KeyTokenService.findByRefreshToken(refreshToken)
    if (!holdToken) {
      throw new BadRequestError('Refresh token is invalid')
    }

    const { email } = verifyToken(
      refreshToken,
      holdToken.secretKey
    ) as TokenPayload

    const foundShop = await ShopService.findByEmail({ email })

    if (!foundShop) {
      throw new BadRequestError('Shop not exist')
    }

    const newAccessToken = await createTokenPair(
      { userId: String(foundShop._id), email },
      holdToken.secretKey
    )

    //update token
    await holdToken.updateOne({
      $set: {
        refreshToken: newAccessToken.refreshToken,
      },
      $addToSet: {
        refreshTokensUsed: refreshToken,
      },
    })

    return {
      tokens: newAccessToken,
      shop: getInfoData({
        fields: ['_id', 'email', 'name'],
        object: foundShop,
      }),
    }
  }
}

export default AuthService
