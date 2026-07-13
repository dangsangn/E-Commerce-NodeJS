import { describe, it, expect } from 'vitest'
import { signupSchema, loginSchema, verifyOtpSchema } from '@/lib/validations/auth'

describe('signupSchema', () => {
  it('chấp nhận dữ liệu hợp lệ', () => {
    const r = signupSchema.safeParse({ email: 'a@b.com', password: '123456', name: 'An' })
    expect(r.success).toBe(true)
  })
  it('từ chối email sai', () => {
    expect(signupSchema.safeParse({ email: 'x', password: '123456', name: 'An' }).success).toBe(false)
  })
  it('từ chối mật khẩu ngắn', () => {
    expect(signupSchema.safeParse({ email: 'a@b.com', password: '123', name: 'An' }).success).toBe(false)
  })
  it('từ chối thiếu tên', () => {
    expect(signupSchema.safeParse({ email: 'a@b.com', password: '123456', name: '' }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('chấp nhận hợp lệ', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '123456' }).success).toBe(true)
  })
})

describe('verifyOtpSchema', () => {
  it('chấp nhận OTP 6 số', () => {
    expect(verifyOtpSchema.safeParse({ email: 'a@b.com', otp: '123456' }).success).toBe(true)
  })
  it('từ chối OTP không đủ 6 số', () => {
    expect(verifyOtpSchema.safeParse({ email: 'a@b.com', otp: '123' }).success).toBe(false)
  })
})
