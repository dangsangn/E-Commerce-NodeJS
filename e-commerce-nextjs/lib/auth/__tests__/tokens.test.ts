import { describe, it, expect } from 'vitest'
import { decodeJwt, isExpiringSoon, hasRole } from '@/lib/auth/tokens'
import type { JwtPayload } from '@/types/api'

// Tạo JWT giả: header.payload.signature (chỉ payload là quan trọng khi decode)
function fakeJwt(payload: object): string {
  const b64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`
}

describe('decodeJwt', () => {
  it('decode payload hợp lệ', () => {
    const p = { userId: 'u1', email: 'a@b.com', roles: ['shop'], type: 'access', exp: 100, iat: 1 }
    expect(decodeJwt(fakeJwt(p))).toEqual(p)
  })
  it('trả null nếu token sai định dạng', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull()
    expect(decodeJwt('a.b')).toBeNull()
  })
})

describe('isExpiringSoon', () => {
  const p: JwtPayload = { userId: 'u1', email: 'a@b.com', roles: [], type: 'access', exp: 1000, iat: 0 }
  it('true khi còn dưới skew (60s)', () => {
    // exp=1000s => 1_000_000ms; now=970_000ms => còn 30s < 60s
    expect(isExpiringSoon(p, 970_000)).toBe(true)
  })
  it('false khi còn nhiều thời gian', () => {
    expect(isExpiringSoon(p, 900_000)).toBe(false) // còn 100s > 60s
  })
  it('true khi payload null hoặc thiếu exp', () => {
    expect(isExpiringSoon(null, 0)).toBe(true)
  })
})

describe('hasRole', () => {
  it('nhận biết role', () => {
    const p: JwtPayload = { userId: 'u', email: 'e', roles: ['user', 'shop'], type: 'access', exp: 1, iat: 1 }
    expect(hasRole(p, 'shop')).toBe(true)
    expect(hasRole(p, 'admin')).toBe(false)
    expect(hasRole(null, 'shop')).toBe(false)
  })
})
