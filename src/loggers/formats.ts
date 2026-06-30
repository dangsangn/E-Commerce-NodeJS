import winston from 'winston'
import { getContext } from './context'

const { combine, timestamp, printf, colorize, json, errors } = winston.format

/**
 * List of sensitive keys to mask. Exported for easier expansion.
 * Matching does not distinguish between flower and common flowers.
 */
export const REDACT_KEYS = [
  'password',
  'passwordconfirm',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'apikey',
  'api-key',
  'x-zpi-key',
  'secret',
  'client-secret',
  'cloudinary-api-secret',
  'cookie',
  'set-cookies',
]

const REDACTED = '[REDACTED]'

// Recursively masking the values ​​of sensitive keys. Does not mutate the original object.
const redact = (value: any, seen = new WeakSet()): any => {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return '[Circular]'
  seen.add(value)

  if (Array.isArray(value)) return value.map((v) => redact(v, seen))

  const out: Record<string, any> = {}
  for (const [key, val] of Object.entries(value)) {
    if (REDACT_KEYS.includes(key.toLowerCase())) {
      out[key] = REDACTED
    } else {
      out[key] = redact(val, seen)
    }
  }
  return out
}

const enrich = winston.format((info) => {
  const ctx = getContext()
  if (ctx) {
    info.requestId = ctx.requestId
    if (ctx.userId) info.userId = ctx.userId
  }

  // Hide the secrets for each meta field, leaving the standard Winston fields untouched.
  const STANDARD = new Set([
    'level',
    'message',
    'timestamp',
    'stack',
    'requestId',
    'userId',
  ])

  for (const key of Object.keys(info)) {
    if (STANDARD.has(key)) continue
    if (REDACT_KEYS.includes(key.toLowerCase())) {
      info[key] = REDACTED
    } else {
      info[key] = redact(info[key])
    }
  }
  return info
})

/**
 * Formatting order is very important:
 * errors() and timestamp() must run BEFORE enrich()/printf()/json()
 * so that when enrich/printf reads info.stack and info.timestamp, the data is already available.
 */
