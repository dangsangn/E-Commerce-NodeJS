import { getAccessPayload } from '@/lib/auth/session'
import { logoutAction } from '@/actions/auth.actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function SellerHomePage() {
  const payload = await getAccessPayload()
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Kênh người bán</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Đăng nhập với: <span className="font-medium">{payload?.email ?? '—'}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Vai trò: {payload?.roles?.join(', ') || 'user'}
        </p>
        <form action={logoutAction}>
          <Button type="submit" variant="outline">Đăng xuất</Button>
        </form>
      </CardContent>
    </Card>
  )
}
