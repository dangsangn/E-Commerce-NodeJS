import crypto from 'crypto'
import { pubClient as redis } from '@/utils/redis.util'

const TICKET_TTL = 600 // 10 minutes

// A ticket carries 256 bits of entropy, so brute force is infeasible and a
// plain SHA-256 is enough — unlike the 6-digit OTP, which needs an HMAC with a
// secret to survive someone reading Redis. Hashing here only ensures a Redis
// dump is not a stack of directly usable tickets.
const hashTicket = (ticket: string) =>
  crypto.createHash('sha256').update(ticket).digest('hex')

class ResetTicketService {
  static TTL = TICKET_TTL

  static async issue(userId: string): Promise<string> {
    const ticket = crypto.randomBytes(32).toString('hex')
    await redis.setEx(`pwd:ticket:${hashTicket(ticket)}`, TICKET_TTL, userId)
    return ticket
  }

  // Single use: read and delete atomically. Returns the userId, or null when
  // the ticket is unknown, already spent, or expired.
  static async consume(ticket: string): Promise<string | null> {
    return (await redis.getDel(`pwd:ticket:${hashTicket(ticket)}`)) ?? null
  }
}

export default ResetTicketService
