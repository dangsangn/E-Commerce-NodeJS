/**
 * Self-test for the forgot-password primitives (OtpService + ResetTicketService).
 *
 * The project has no test runner, so this is a standalone script in the same
 * spirit as the other files under src/test. It needs only Redis — no MongoDB,
 * no SMTP — and cleans up every key it writes.
 *
 *   npx ts-node -r tsconfig-paths/register src/test/auth/otp-reset.selftest.ts
 *
 * See docs/19. forgot-password-flow-guide.md
 */
import * as dotenv from 'dotenv'
dotenv.config()
import { pubClient as redis, initRedis, closeRedis } from '@/utils/redis.util'
import OtpService from '@/features/auth/services/otp.service'
import ResetTicketService from '@/features/auth/services/reset-ticket.service'

const EMAIL = '__selftest__@example.invalid'
let pass = 0, fail = 0
const check = (name: string, ok: boolean) => {
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

const cleanup = async () => {
  const keys = await redis.keys(`*${EMAIL}*`)
  if (keys.length) await redis.del(keys)
}

const main = async () => {
  await initRedis()
  await cleanup()

  // --- purpose namespacing: the core fix ---
  const signupOtp = await OtpService.generate(EMAIL, 'signup')
  const resetOtp = await OtpService.generate(EMAIL, 'reset')
  check('signup and reset OTPs coexist (different codes/keys)',
    (await redis.get(`otp:signup:${EMAIL}`)) !== null &&
    (await redis.get(`otp:reset:${EMAIL}`)) !== null)

  check('signup OTP is REJECTED by the reset flow',
    (await OtpService.verify(EMAIL, signupOtp, 'reset')) === false)
  check('reset OTP still valid after that failed attempt',
    (await redis.get(`otp:reset:${EMAIL}`)) !== null)
  check('reset OTP accepted by the reset flow',
    (await OtpService.verify(EMAIL, resetOtp, 'reset')) === true)
  check('reset OTP deleted after successful verify (single use)',
    (await redis.get(`otp:reset:${EMAIL}`)) === null)
  check('signup OTP untouched by the whole reset exchange',
    (await redis.get(`otp:signup:${EMAIL}`)) !== null)
  check('signup OTP still verifies for signup',
    (await OtpService.verify(EMAIL, signupOtp, 'signup')) === true)

  // --- resend cooldown is per purpose ---
  await cleanup()
  check('first signup resend allowed', (await OtpService.canResend(EMAIL, 'signup')) === true)
  check('second signup resend blocked', (await OtpService.canResend(EMAIL, 'signup')) === false)
  check('reset resend NOT blocked by signup cooldown',
    (await OtpService.canResend(EMAIL, 'reset')) === true)

  // --- a verified code lifts its own cooldown ("Start over" right after OTP) ---
  await cleanup()
  check('reset cooldown armed by first send', (await OtpService.canResend(EMAIL, 'reset')) === true)
  const spent = await OtpService.generate(EMAIL, 'reset')
  await OtpService.verify(EMAIL, spent, 'reset')
  check('new reset code allowed right after a successful verify',
    (await OtpService.canResend(EMAIL, 'reset')) === true)
  await OtpService.generate(EMAIL, 'reset')
  await OtpService.verify(EMAIL, '000000', 'reset')
  check('failed verify does NOT lift the cooldown',
    (await OtpService.canResend(EMAIL, 'reset')) === false)

  // --- attempt counter is per purpose ---
  await cleanup()
  await OtpService.generate(EMAIL, 'reset')
  for (let i = 0; i < 5; i++) await OtpService.verify(EMAIL, '000000', 'reset')
  let locked = false
  try { await OtpService.verify(EMAIL, '000000', 'reset') } catch { locked = true }
  check('reset locks out after 5 wrong attempts', locked)
  const su = await OtpService.generate(EMAIL, 'signup')
  check('signup unaffected by reset lockout',
    (await OtpService.verify(EMAIL, su, 'signup')) === true)

  // --- concurrent verify must yield exactly ONE success ---
  await cleanup()
  const raceOtp = await OtpService.generate(EMAIL, 'reset')
  // 4, not more: the attempt counter increments on EVERY verify call (by
  // design), so >5 concurrent calls would trip the lockout instead.
  const results = await Promise.all(
    Array.from({ length: 4 }, () => OtpService.verify(EMAIL, raceOtp, 'reset')),
  )
  check(`4 concurrent verifies of one OTP -> exactly 1 success (got ${results.filter(Boolean).length})`,
    results.filter(Boolean).length === 1)

  // --- reset ticket ---
  const ticket = await ResetTicketService.issue('64f000000000000000000abc')
  check('ticket is 64 hex chars', /^[0-9a-f]{64}$/.test(ticket))
  check('raw ticket is NOT a redis key (stored hashed)',
    (await redis.get(`pwd:ticket:${ticket}`)) === null)
  check('ticket consumes to the right userId',
    (await ResetTicketService.consume(ticket)) === '64f000000000000000000abc')
  check('ticket is single use', (await ResetTicketService.consume(ticket)) === null)
  check('unknown ticket returns null', (await ResetTicketService.consume('deadbeef')) === null)

  const t2 = await ResetTicketService.issue('64f000000000000000000abc')
  const consumed = await Promise.all(
    Array.from({ length: 8 }, () => ResetTicketService.consume(t2)),
  )
  check(`8 concurrent consumes -> exactly 1 success (got ${consumed.filter(Boolean).length})`,
    consumed.filter(Boolean).length === 1)

  // --- peek: validate before spending ---
  const t3 = await ResetTicketService.issue('64f000000000000000000abc')
  check('peek returns the userId', (await ResetTicketService.peek(t3)) === '64f000000000000000000abc')
  check('peek does NOT spend the ticket (rejected password can retry)',
    (await ResetTicketService.peek(t3)) === '64f000000000000000000abc')
  check('consume still works after peeks',
    (await ResetTicketService.consume(t3)) === '64f000000000000000000abc')
  check('peek after consume returns null', (await ResetTicketService.peek(t3)) === null)

  // Two resets racing on one ticket: both peeks pass, only one consume wins —
  // exactly the guard resetPassword relies on before writing the password.
  const t4 = await ResetTicketService.issue('64f000000000000000000abc')
  const raced = await Promise.all(
    Array.from({ length: 4 }, async () => {
      const peeked = await ResetTicketService.peek(t4)
      return peeked !== null && (await ResetTicketService.consume(t4)) === peeked
    }),
  )
  check(`4 concurrent peek+consume -> exactly 1 write allowed (got ${raced.filter(Boolean).length})`,
    raced.filter(Boolean).length === 1)

  await cleanup()
  const leftover = await redis.keys(`*${EMAIL}*`)
  check('no test keys left behind', leftover.length === 0)

  console.log(`\n${pass} passed, ${fail} failed`)
  await closeRedis()
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => { console.error(e); await closeRedis(); process.exit(1) })
