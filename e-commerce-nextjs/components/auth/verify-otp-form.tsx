'use client'
import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { verifyOtpAction, resendOtpAction } from '@/actions/auth.actions'
import { initialActionState } from '@/actions/state'
import { SubmitButton } from '@/components/auth/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function VerifyOtpForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(verifyOtpAction, initialActionState)
  const [resendState, resendAction] = useActionState(resendOtpAction, initialActionState)

  useEffect(() => {
    if (state.message) toast.error(state.message)
  }, [state])

  useEffect(() => {
    if (resendState.ok && resendState.message) toast.success(resendState.message)
    else if (!resendState.ok && resendState.message) toast.error(resendState.message)
  }, [resendState])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Xác thực Email</CardTitle>
        <CardDescription>Nhập mã 6 số đã gửi tới {email || 'email của bạn'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <div className="space-y-2">
            <Label htmlFor="otp">Mã OTP</Label>
            <Input id="otp" name="otp" inputMode="numeric" maxLength={6} required placeholder="______" />
          </div>
          <SubmitButton>Xác nhận</SubmitButton>
        </form>
        <form action={resendAction}>
          <input type="hidden" name="email" value={email} />
          <Button type="submit" variant="ghost" className="w-full">Gửi lại mã</Button>
        </form>
      </CardContent>
    </Card>
  )
}
