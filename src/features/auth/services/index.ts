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
import ResetTicketService from './reset-ticket.service'
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

  static forgotPassword = async ({ email }: { email: string }) => {
    // Built up front and returned unchanged on every branch, so no code path
    // can accidentally reveal whether this email has an account.
    const genericResponse = {
      message: 'If that email exists, a reset code has been sent.',
      email,
    }

    const user = await UserModel.findOne({ usr_email: email }).lean()

    // No account -> stay silent.
    if (!user) return genericResponse

    // Blocked -> stay silent. Resetting a password must not double as a way to
    // get around an admin block.
    if (user.usr_status === USER_STATUS.BLOCK) return genericResponse

    // Never verified their email at signup -> stay silent. Sending a reset code
    // here would open a side door around the signup verification step.
    if (user.usr_status === USER_STATUS.PENDING) return genericResponse

    if (await OtpService.canResend(email, 'reset')) {
      const otp = await OtpService.generate(email, 'reset')
      // Fire-and-forget: the HTTP response must not wait on SMTP. Waiting would
      // both slow the request and leak, through response time, that this email
      // actually exists.
      EmailService.sendResetPasswordOtpMail(email, otp).catch((error) => {
        logger.error('Send reset password mail failed', { error, email })
      })
    }

    return genericResponse
  }

  static verifyResetOtp = async ({
    email,
    otp,
  }: {
    email: string
    otp: string
  }) => {
    const valid = await OtpService.verify(email, otp, 'reset')
    if (!valid) throw new BadRequestError('Invalid or expired OTP')

    // Re-read the user after verifying: their status may have changed during
    // the five minutes the code was valid (an admin blocking them, say).
    const user = await UserModel.findOne({
      usr_email: email,
      usr_status: USER_STATUS.ACTIVE,
    }).lean()
    if (!user) throw new BadRequestError('Invalid or expired OTP')

    const resetTicket = await ResetTicketService.issue(String(user._id))
    return { resetTicket, expiresIn: ResetTicketService.TTL }
  }

  static resetPassword = async ({
    resetTicket,
    password,
  }: {
    resetTicket: string
    password: string
  }) => {
    const userId = await ResetTicketService.consume(resetTicket)
    if (!userId) throw new BadRequestError('Reset session is invalid or expired')

    // usr_password is `select: false` in the schema, so it must be asked for.
    const user = await UserModel.findById(userId)
      .select('+usr_password')
      .lean()
    if (!user) throw new BadRequestError('Reset session is invalid or expired')

    // If the account is currently compromised, letting the owner "change" the
    // password back to the one the attacker already knows achieves nothing.
    const isSamePassword = await bcrypt.compare(password, user.usr_password!)
    if (isSamePassword) {
      throw new BadRequestError('New password must differ from the current one')
    }

    const salt = await bcrypt.genSalt(10)
    const hashPassword = await bcrypt.hash(password, salt)
    await UserModel.updateOne(
      { _id: userId },
      { $set: { usr_password: hashPassword } },
    )

    // Not optional: KeyToken holds the secret every JWT of this user is signed
    // with, so deleting it invalidates every access and refresh token still in
    // circulation. Without this, an attacker already holding a session keeps it
    // even after the owner resets their password.
    await KeyTokenService.deleteKeyToken(String(userId))

    EmailService.sendPasswordChangedMail(user.usr_email).catch((error) => {
      logger.error('Send password changed mail failed', { error, userId })
    })

    return { message: 'Password has been reset. Please log in again.' }
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
