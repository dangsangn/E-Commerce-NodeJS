import { NextFunction, Request, Response } from 'express'
import { pubClient as redis } from '@/utils/redis.util'
import { BadRequestError } from '@/core/error.response'
import { asyncHandler } from '@/utils'
import { getClientIp } from '@/utils/client-ip.util'

const INCR_WITH_TTL = `
  local n = redis.call('INCR', KEYS[1])
  if n == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return n
`

/**
 * Per-IP rate limit backed by Redis.
 *
 * OtpService.canResend already throttles per email address, which stops one
 * user hammering their own account. It does nothing against a script walking
 * thousands of different addresses — that costs us both account enumeration
 * and a burnt SMTP quota (which in turn damages sending-domain reputation).
 *
 * The IP comes from getClientIp: requests arrive via our Next.js server, so
 * plain req.ip would put every user into one shared bucket. See
 * docs/22. client-ip-forwarding-guide.md
 */
export const rateLimitByIp = (opts: {
  keyPrefix: string
  max: number
  windowSec: number
}) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const ip = getClientIp(req)
    const hits = (await redis.eval(INCR_WITH_TTL, {
      keys: [`rl:${opts.keyPrefix}:${ip}`],
      arguments: [String(opts.windowSec)],
    })) as number

    if (hits > opts.max) {
      throw new BadRequestError('Too many requests. Please try again later.')
    }
    return next()
  })
