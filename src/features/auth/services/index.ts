import bcrypt from 'bcrypt'
import crypto from 'crypto'
import {
  BadRequestError,
  UnauthorizedError,
} from '../../../core/error.response'
import { getInfoData } from '../../../utils'
import KeyTokenService from '../../keyToken/services'
import { ROLE_NAME, RoleModel } from '../../rbac/models/role.model'
import { USER_STATUS, UserModel } from '../../user/models'
import { createTokenPair, TokenPayload } from '../utils'
import OtpService from './otp.service'
import EmailService from '@/services/email.service'
import logger from '@/loggers'

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

    if (user.usr_status === USER_STATUS.PENDING)
      throw new UnauthorizedError('Please verify your email first')

    if (user.usr_status === USER_STATUS.BLOCK)
      throw new UnauthorizedError('Account has been blocked')

    const isMatchPassword = await bcrypt.compare(password, user.usr_password!)
    if (!isMatchPassword) {
      throw new UnauthorizedError('Invalid password')
    }
    const roles = (user.usr_roles as any[]).map((r) => r.rol_name)

    const payload: TokenPayload = {
      userId: String(user._id),
      email,
      roles,
    }
    const tokens = await this.reissueTokens(payload)
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
      if (existing.usr_status === USER_STATUS.ACTIVE) {
        throw new BadRequestError('User already exists')
      }
      // User pending signup → treated as resend, no duplicate record created.
      this.sendEmailOtp(email)
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

    await UserModel.create({
      usr_email: email,
      usr_password: hashPassword,
      usr_name: name,
      usr_roles: [userRole._id],
      usr_status: USER_STATUS.PENDING,
      usr_verified: false,
    })

    // const payload: TokenPayload = {
    //   userId: String(newUser._id),
    //   email,
    //   roles: [userRole.rol_name],
    // }
    // const tokens = await this.reissueTokens(payload)
    this.sendEmailOtp(email)
  }

  static verifyOtp = async ({ email, otp }: { email: string; otp: string }) => {
    const valid = await OtpService.verify(email, otp)
    if (!valid) throw new BadRequestError('Invalid or expired OTP')

    const user = await UserModel.findOneAndUpdate(
      {
        usr_email: email,
        usr_status: USER_STATUS.PENDING,
      },
      {
        usr_status: USER_STATUS.ACTIVE,
        usr_verified: true,
      },
      { new: true },
    ).populate({ path: 'usr_roles', select: 'rol_name' })
    if (!user) throw new BadRequestError('User not found or already verified')

    const roles = (user.usr_roles as any[]).map((r) => r.rol_name)
    const tokens = await this.reissueTokens({
      userId: String(user._id),
      email,
      roles,
    })
    return {
      user: getInfoData({
        fields: ['_id', 'usr_email', 'usr_name'],
        object: user,
      }),
      tokens,
    }
  }

  static async sendEmailOtp(email: string) {
    const canSendOtp = await OtpService.canResend(email)
    if (canSendOtp) {
      const otp = await OtpService.generate(email)
      EmailService.sendOtpMail(email, otp).catch((error) => {
        logger.error('Send OTP mail failed', { error, email })
      })
    }
    return { message: 'OTP has been sent to your email', email }
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
      await KeyTokenService.deleteKeyToken(userInfo.userId)
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

  static reissueTokens = async (payload: TokenPayload) => {
    const secretKey = crypto.randomBytes(64).toString('hex')
    const tokens = await createTokenPair(payload, secretKey)
    await KeyTokenService.createKeyToken({
      userId: payload.userId,
      secretKey,
      refreshToken: tokens.refreshToken,
    })
    return tokens
  }
}

export default AuthService
