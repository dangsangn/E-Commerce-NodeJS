'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { apiFetch, ApiError } from '@/lib/api/server-client'
import { setSession, clearSession } from '@/lib/auth/session'
import { COOKIE } from '@/lib/auth/tokens'
import { loginSchema, signupSchema, verifyOtpSchema } from '@/lib/validations/auth'
import type { LoginData } from '@/types/api'
import type { ActionState } from '@/actions/state'

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }
  try {
    await apiFetch('/auth/signup', { body: parsed.data })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Đăng ký thất bại') }
  }
  redirect(`/verify-otp?email=${encodeURIComponent(parsed.data.email)}`)
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }
  const redirectTo = (formData.get('redirect') as string) || '/seller'
  try {
    const data = await apiFetch<LoginData>('/auth/login', { body: parsed.data })
    await setSession(data.tokens, data.user._id)
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Đăng nhập thất bại') }
  }
  redirect(redirectTo)
}

export async function verifyOtpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = verifyOtpSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }
  try {
    const data = await apiFetch<LoginData>('/auth/verify-otp', { body: parsed.data })
    await setSession(data.tokens, data.user._id)
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Xác thực OTP thất bại') }
  }
  redirect('/seller')
}

export async function resendOtpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') ?? '')
  if (!email) return { ok: false, message: 'Thiếu email' }
  try {
    await apiFetch('/auth/resend-otp', { body: { email } })
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Gửi lại OTP thất bại') }
  }
  return { ok: true, message: 'Đã gửi lại mã OTP' }
}

export async function logoutAction(): Promise<void> {
  const store = await cookies()
  const clientId = store.get(COOKIE.CLIENT)?.value
  const refresh = store.get(COOKIE.REFRESH)?.value
  // Backend /auth/logout xác thực bằng x-client-id + x-refresh-token (không phải authorization).
  if (clientId && refresh) {
    try {
      await fetch(`${process.env.BACKEND_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'x-api-key': process.env.API_KEY!,
          'x-client-id': clientId,
          'x-refresh-token': refresh,
        },
      })
    } catch {
      // Bỏ qua lỗi mạng — vẫn xoá session phía client.
    }
  }
  await clearSession()
  redirect('/login')
}
