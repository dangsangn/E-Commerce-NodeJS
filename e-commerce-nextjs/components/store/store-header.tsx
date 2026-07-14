import Link from 'next/link'
import { getAccessPayload } from '@/lib/auth/session'
import { logoutAction } from '@/actions/auth.actions'
import { buttonVariants } from '@/components/ui/button'
import { SearchBox } from '@/components/store/search-box'

export async function StoreHeader({ q = '' }: { q?: string }) {
  const payload = await getAccessPayload()
  const isShop = Boolean(payload?.roles?.includes('shop'))
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold">SHOP</Link>
        <div className="flex-1">
          <SearchBox defaultValue={q} />
        </div>
        <nav className="flex items-center gap-3 text-sm">
          {payload ? (
            <>
              {isShop ? (
                <Link href="/seller" className="text-muted-foreground hover:text-foreground">Seller dashboard</Link>
              ) : null}
              <span className="hidden text-muted-foreground sm:inline">{payload.email}</span>
              <form action={logoutAction}>
                <button type="submit" className="text-muted-foreground hover:text-foreground">Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className={buttonVariants({ variant: 'outline' })}>Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
