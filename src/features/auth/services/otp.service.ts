import crypto from 'crypto'
import { pubClient as redis } from '@/utils/redis.util'
import { BadRequestError } from '@/core/error.response'

const OTP_TTL = 300 // 5 minutes

// What an OTP is for. Each purpose gets its own Redis namespace, so a code
// issued for one flow can never be redeemed in another — and the attempt
// counter / resend cooldown of one flow can never lock out the other.
export type OtpPurpose = 'signup' | 'reset'

const hashOtp = (otp: string) => {
  return crypto
    .createHmac('sha256', process.env.OTP_SECRET!)
    .update(otp)
    .digest('hex')
}

const INCR_WITH_TTL = `
  local n = redis.call('INCR', KEYS[1])
  if n == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return n
`

// Compare and delete in one atomic step. Doing GET then DEL from Node lets two
// concurrent requests both verify the same OTP — in the password reset flow
// that means one code minting two independent reset tickets.
// The comparison is on the HMAC digest, not on the OTP itself, so a
// non-constant-time compare leaks nothing useful: producing a timing signal
// would require already knowing the OTP behind the digest.
const VERIFY_AND_DEL = `
  local stored = redis.call('GET', KEYS[1])
  if not stored then return 0 end
  if stored == ARGV[1] then
    redis.call('DEL', KEYS[1])
    return 1
  end
  return 0
`

class OtpService {
  static MAX_ATTEMPTS = 5
  static RESEND_COOL_DOWN = 60

  static async generate(
    email: string,
    purpose: OtpPurpose = 'signup',
  ): Promise<string> {
    const otp = crypto.randomInt(1, 1_000_000).toString().padStart(6, '0')
    await redis.setEx(`otp:${purpose}:${email}`, OTP_TTL, hashOtp(otp))
    return otp
  }

  static async verify(
    email: string,
    otp: string,
    purpose: OtpPurpose = 'signup',
  ): Promise<boolean> {
    const attemptKey = `otp:attempts:${purpose}:${email}`

    // Count before comparing — counting afterwards would let an attacker dodge
    // the limit by aborting the connection mid-request.
    const attempts = (await redis.eval(INCR_WITH_TTL, {
      keys: [attemptKey],
      arguments: [String(OTP_TTL)],
    })) as number
    if (attempts > this.MAX_ATTEMPTS) {
      await redis.del(`otp:${purpose}:${email}`)
      throw new BadRequestError('Too many attempts. Please request a new code.')
    }

    const match = (await redis.eval(VERIFY_AND_DEL, {
      keys: [`otp:${purpose}:${email}`],
      arguments: [hashOtp(otp)],
    })) as number

    // Clear the counter on success so a fresh code does not inherit the
    // failed attempts of the previous one.
    if (match === 1) await redis.del(attemptKey)
    return match === 1
  }

  // Users are only allowed to resend the OTP once every 60 seconds.
  static async canResend(
    email: string,
    purpose: OtpPurpose = 'signup',
  ): Promise<boolean> {
    const ok = await redis.set(`otp:resend:${purpose}:${email}`, '1', {
      NX: true, // Only Set of Not eXist
      expiration: {
        type: 'EX',
        value: this.RESEND_COOL_DOWN,
      },
    })
    return ok === 'OK'
  }
}

export default OtpService
