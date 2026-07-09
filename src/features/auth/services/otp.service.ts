import crypto from 'crypto'
import { pubClient as redis } from '@/utils/redis.util'
import { hash } from 'zod'
import { BadRequestError } from '@/core/error.response'

const OTP_TTL = 300 // 5 minutes

const hashOtp = (otp: string) => {
  return crypto
    .createHmac('sha256', process.env.OTP_SECRET!)
    .update(otp)
    .digest('hex')
}

class OtpService {
  static MAX_ATTEMPTS = 5
  static RESEND_COOL_DOWN = 60

  static async generate(email: string): Promise<string> {
    const otp = crypto.randomInt(1, 1_000_000).toString().padStart(6, '0')
    await redis.setEx(`otp:signup:${email}`, OTP_TTL, hashOtp(otp))
    return otp
  }

  static async verify(email: string, otp: string): Promise<boolean> {
    const attempts = await redis.incr(`otp:attempts:${email}`)
    if (attempts === 1) await redis.expire(`otp:attempts:${email}`, OTP_TTL)
    if (attempts > this.MAX_ATTEMPTS) {
      await redis.del(`otp:signup:${email}`)
      throw new BadRequestError('Too many attempts. Please request a new code.')
    }

    const stored = await redis.get(`otp:signup:${email}`)
    if (!stored) return false
    const match = crypto.timingSafeEqual(
      Buffer.from(hashOtp(otp)),
      Buffer.from(stored),
    )
    if (match) await redis.del(`otp:signup:${email}`)
    return match
  }

  // Users are only allowed to resend the OTP once every 60 seconds.
  static async canResend(email: string): Promise<boolean> {
    // Only Set of Not eXist
    const ok = await redis.set(`otp:resend:${email}`, '1', {
      NX: true,
      expiration: {
        type: 'EX',
        value: this.RESEND_COOL_DOWN,
      },
    })
    return ok === 'OK'
  }
}

export default OtpService
