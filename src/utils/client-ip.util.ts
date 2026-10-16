/// <reference path="../types/express.d.ts" />
import { isIP } from 'net'
import { Request } from 'express'

// Sent by our own Next.js server: browsers never reach this API directly, so
// without it req.ip is the Next.js server for every user and per-IP limits
// collapse into one shared bucket. See docs/22. client-ip-forwarding-guide.md
export const END_USER_IP_HEADER = 'x-end-user-ip'

// API key names (ApiKeys.name) allowed to vouch for the end user's IP. Only
// keys that live on a server belong here — a key shipped inside a mobile app
// can be extracted by anyone, so its claims are worthless.
// Read per call rather than at import so it never races dotenv.config().
const trustedForwarders = (): Set<string> =>
  new Set(
    (process.env.TRUSTED_IP_FORWARDERS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )

// Must run after the apiKey middleware: trust comes from WHO is calling
// (req.objKey), not from where the connection came from.
export function getClientIp(req: Request): string {
  const claimed = req.headers[END_USER_IP_HEADER]?.toString().trim()
  const forwarder = req.objKey?.name
  if (claimed && isIP(claimed) && forwarder && trustedForwarders().has(forwarder)) {
    return claimed
  }
  return req.ip ?? 'unknown'
}
