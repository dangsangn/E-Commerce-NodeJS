import bcrypt from 'bcrypt'
import crypto from 'crypto'
import {
  BadRequestError,
  UnauthorizedError,
} from '../../../core/error.response'
import { getInfoData } from '../../../utils'
import KeyTokenService from '../../keyToken/services'
import { ROLE_NAME, RoleModel } from '../../rbac/models/role.model'
import { UserModel } from '../../user/models'
import { createTokenPair, TokenPayload } from '../utils'

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
    const user = await UserModel.findOne({ usr_email: email })
      .select('+usr_password')
      .populate({
        path: 'usr_roles',
        select: 'rol_name',
      })
      .lean()
    if (!user) {
      throw new BadRequestError('User not found')
    }

    const isMatchPassword = await bcrypt.compare(password, user.usr_password!)
    if (!isMatchPassword) {
      throw new UnauthorizedError('Invalid password')
    }
    const roles = (user.usr_roles as any[]).map((r) => r.rol_name)

    // Generate secret key for HS256 (symmetric encryption)
    const secretKey = crypto.randomBytes(64).toString('hex')
    const payload: TokenPayload = {
      userId: String(user._id),
      email,
      roles,
    }
    const tokens = await createTokenPair(payload, secretKey)

    // Store key in database (for token refresh/revocation)
    const keyToken = await KeyTokenService.createKeyToken({
      userId: String(user._id),
      secretKey,
      refreshToken: tokens.refreshToken,
    })

    if (!keyToken) {
      throw new BadRequestError('Create key token failed')
    }

    return {
      user: getInfoData({
        fields: ['_id', 'email', 'name'],
        object: user,
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
    const existing = await UserModel.findOne({ usr_email: email }).lean()

    if (existing) {
      throw new BadRequestError('User already exists')
    }

    const userRole = await RoleModel.findOne({
      rol_name: ROLE_NAME.USER,
    }).lean()

    if (!userRole) {
      throw new BadRequestError('Default role not be set')
    }
    // salt and hash password
    const salt = await bcrypt.genSalt(10)
    const hashPassword = await bcrypt.hash(password, salt)
    const newUser = await UserModel.create({
      usr_email: email,
      usr_password: hashPassword,
      usr_name: name,
      usr_roles: [userRole._id],
    })

    // Generate secret key for HS256 (symmetric encryption)
    const secretKey = crypto.randomBytes(64).toString('hex')
    const payload: TokenPayload = {
      userId: String(newUser._id),
      email,
      roles: [userRole.rol_name],
    }

    const tokens = await createTokenPair(payload, secretKey)

    const keyToken = await KeyTokenService.createKeyToken({
      userId: String(newUser._id),
      secretKey,
      refreshToken: tokens.refreshToken,
    })

    if (!keyToken) {
      throw new BadRequestError('Create key token failed')
    }

    return {
      user: getInfoData({
        fields: ['_id', 'usr_email', 'usr_name'],
        object: newUser,
      }),
      tokens,
    }
  }

  static logout = async ({ userId }: { userId: string }) => {
    return await KeyTokenService.deleteKeyToken(userId)
  }

  static refreshToken = async ({
    refreshToken,
    userInfo,
  }: {
    refreshToken: string
    userInfo: TokenPayload
  }) => {
    const foundToken =
      await KeyTokenService.findByRefreshTokenUsed(refreshToken)
    if (foundToken) {
      await KeyTokenService.deleteKeyTokenByRefreshToken(refreshToken)
      throw new BadRequestError('Refresh token is used. Please login again.')
    }

    const holdToken = await KeyTokenService.findByRefreshToken(refreshToken)
    if (!holdToken) {
      throw new BadRequestError('Refresh token is invalid')
    }

    const newAccessToken = await createTokenPair(userInfo, holdToken.secretKey)

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
      shop: userInfo,
    }
  }
}

export default AuthService
