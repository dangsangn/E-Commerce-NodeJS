# Frontend Seller Dashboard — M1: Foundation + Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng nền tảng frontend (BFF, session cookie httpOnly, middleware) và luồng auth OTP (signup → verify → login → logout) cho app `e-commerce-nextjs`, giữ session an toàn và bảo vệ khu vực `/seller`.

**Architecture:** Next.js server làm BFF — Server Components đọc dữ liệu, Server Actions ghi dữ liệu, `x-api-key` chỉ tồn tại ở server, token nằm trong cookie httpOnly. Middleware (Edge) tự refresh access token sắp hết hạn và chặn `/seller` nếu chưa đăng nhập. UI bằng shadcn/ui + Tailwind v4, tiếng Việt.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui, zod v4, Vitest (unit test cho logic thuần), pnpm.

## Global Constraints

- Thư mục làm việc: `e-commerce-nextjs/` (đây là project riêng, có `package.json`/`pnpm-lock.yaml` riêng). Mọi lệnh `pnpm` chạy trong thư mục này.
- Path alias: `@/*` → gốc `e-commerce-nextjs/` (theo `tsconfig.json`).
- Package manager: **pnpm**.
- `cookies()` từ `next/headers` là **async** (Next 16) — luôn `await cookies()`.
- **Middleware chạy trên Edge runtime** — chỉ dùng API edge-safe (`fetch`, `atob`, `TextDecoder`, Web Cookies). KHÔNG import module có `import 'server-only'` hay `next/headers` trong middleware.
- Module có `import 'server-only'` KHÔNG được import trong test Vitest hay trong middleware. Logic thuần cần test/edge phải nằm ở module không có `server-only`.
- Backend contract: base `${BACKEND_URL}/api/v1`; mọi request cần header `x-api-key`; request auth cần `x-client-id` + `authorization` (access token); **chỉ** `/auth/refresh-token` và `/auth/logout` dùng `x-client-id` + `x-refresh-token`. Response envelope `{ message, statusCode, data }`.
- Token: `accessToken` HS256 hết hạn 2 ngày, `refreshToken` 7 ngày; payload `{ userId, email, roles: string[], type, exp, iat }`. Role names: `user`|`shop`|`admin`.
- UI ngôn ngữ: **tiếng Việt**.
- **Testing strategy:** TDD (failing test trước) cho logic thuần trong `lib/` (token decode, expiry, http helpers, zod schema). Server Actions / pages / middleware verify bằng `tsc`, `eslint`, và smoke chạy thật với backend đang chạy + `API_KEY` hợp lệ (không viết integration test mock backend ở M1).
- Không commit khi user chưa yêu cầu ở cấp session; các step "Commit" bên dưới là mốc của plan — người thực thi commit trong nhánh làm việc của họ.

---

### Task 1: Dependencies, biến môi trường, hạ tầng test

**Files:**
- Modify: `e-commerce-nextjs/package.json` (scripts)
- Modify: `e-commerce-nextjs/.gitignore` (un-ignore `.env.example`)
- Create: `e-commerce-nextjs/vitest.config.ts`
- Create: `e-commerce-nextjs/.env.example`
- Create: `e-commerce-nextjs/.env.local` (không commit — `.gitignore` giữ `.env*`)
- Create: `e-commerce-nextjs/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: script `pnpm test`, `pnpm test:run`, `pnpm typecheck`; alias `@` hoạt động trong Vitest.

- [ ] **Step 1: Cài dependencies**

Run trong `e-commerce-nextjs/`:
```bash
pnpm add zod server-only
pnpm add -D vitest
```
Expected: cài thành công, `package.json` có `zod`, `server-only`, `vitest`.

- [ ] **Step 2: Thêm scripts vào `package.json`**

Trong `"scripts"` thêm:
```json
"test": "vitest",
"test:run": "vitest run",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 3: Tạo `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
```

- [ ] **Step 4: Un-ignore `.env.example`, tạo `.env.example` và `.env.local`**

`e-commerce-nextjs/.gitignore` hiện có dòng `.env*` (ignore mọi env file). Thêm ngoại lệ để commit được `.env.example` — thêm ngay dưới dòng `.env*`:
```
# env files (can opt-in for committing if needed)
.env*
!.env.example
```

`.env.example`:
```
# URL của backend Express (không có /api/v1 ở cuối)
BACKEND_URL=http://localhost:5000
# API key hợp lệ đã seed trong DB backend (permission phải chứa 0000)
API_KEY=
```
`.env.local` (điền giá trị thật để chạy dev — KHÔNG commit, vẫn bị `.env*` ignore):
```
BACKEND_URL=http://localhost:5000
API_KEY=<dán-api-key-thật>
```

- [ ] **Step 5: Viết smoke test để xác nhận hạ tầng test chạy**

`lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('test infrastructure', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Chạy test, xác nhận PASS**

Run: `pnpm test:run`
Expected: 1 test passed.

- [ ] **Step 7: Commit**

```bash
git add e-commerce-nextjs/package.json e-commerce-nextjs/.gitignore e-commerce-nextjs/vitest.config.ts e-commerce-nextjs/.env.example e-commerce-nextjs/lib/__tests__/smoke.test.ts
git commit -m "chore(fe): add zod, vitest test infra, env template"
```
(Nếu `.env.example` vẫn báo ignore, dùng `git add -f e-commerce-nextjs/.env.example`.)

---

### Task 2: shadcn/ui + component nền + Toaster

**Files:**
- Create/Modify: `e-commerce-nextjs/components.json`, `e-commerce-nextjs/lib/utils.ts`, `e-commerce-nextjs/app/globals.css`
- Create: `e-commerce-nextjs/components/ui/*` (button, input, label, card, sonner)
- Modify: `e-commerce-nextjs/app/layout.tsx`

**Interfaces:**
- Produces: `cn()` từ `@/lib/utils`; component `@/components/ui/button|input|label|card`, `Toaster` + `toast` từ `@/components/ui/sonner`.

- [ ] **Step 1: Khởi tạo shadcn/ui (Tailwind v4)**

Run trong `e-commerce-nextjs/`:
```bash
pnpm dlx shadcn@latest init -b neutral -y
```
Expected: tạo `components.json`, `lib/utils.ts` (có hàm `cn`), cập nhật `app/globals.css` với biến theme (`--background`, `--primary`, ...) và alias. Nếu CLI hỏi tương tác, chọn: TypeScript = yes, base color = Neutral, CSS variables = yes.

- [ ] **Step 2: Thêm các component nền**

```bash
pnpm dlx shadcn@latest add button input label card sonner -y
```
Expected: tạo `components/ui/button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `sonner.tsx`; cài `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `next-themes`, `sonner`.

- [ ] **Step 3: Gắn `Toaster` vào root layout và đặt lang="vi"**

Sửa `app/layout.tsx` — đổi `lang="en"` → `lang="vi"`, cập nhật `metadata`, và thêm Toaster:
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "E-Commerce Seller",
  description: "Kênh người bán",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Xác nhận build & typecheck**

Run: `pnpm typecheck && pnpm build`
Expected: typecheck sạch; build thành công (trang mặc định `/` vẫn build được).

- [ ] **Step 5: Commit**

```bash
git add e-commerce-nextjs/components.json e-commerce-nextjs/lib e-commerce-nextjs/components e-commerce-nextjs/app/globals.css e-commerce-nextjs/app/layout.tsx e-commerce-nextjs/package.json
git commit -m "chore(fe): init shadcn/ui + base components + Toaster"
```

---

### Task 3: Kiểu API + token utils (edge-safe, thuần)

**Files:**
- Create: `e-commerce-nextjs/types/api.ts`
- Create: `e-commerce-nextjs/lib/auth/tokens.ts`
- Test: `e-commerce-nextjs/lib/auth/__tests__/tokens.test.ts`

**Interfaces:**
- Produces:
  - `types/api.ts`: `ApiEnvelope<T>`, `Tokens {accessToken, refreshToken}`, `AuthUser {_id, email?, name?}`, `LoginData {user: AuthUser, tokens: Tokens}`, `JwtPayload {userId, email, roles: string[], type: 'access'|'refresh', exp: number, iat: number}`, `RefreshData {tokens: Tokens, shop: {userId, email, roles: string[]}}`.
  - `lib/auth/tokens.ts` (KHÔNG `server-only`): `COOKIE {ACCESS, REFRESH, CLIENT}`, `decodeJwt(token): JwtPayload|null`, `isExpiringSoon(payload, nowMs, skewSeconds?): boolean`, `hasRole(payload, role): boolean`.

- [ ] **Step 1: Tạo `types/api.ts`**

```ts
export interface ApiEnvelope<T> {
  message: string
  statusCode: number
  data: T
}

export interface Tokens {
  accessToken: string
  refreshToken: string
}

export interface AuthUser {
  _id: string
  email?: string
  name?: string
  usr_email?: string
  usr_name?: string
}

export interface LoginData {
  user: AuthUser
  tokens: Tokens
}

export interface JwtPayload {
  userId: string
  email: string
  roles: string[]
  type: 'access' | 'refresh'
  exp: number
  iat: number
}

export interface RefreshData {
  tokens: Tokens
  shop: { userId: string; email: string; roles: string[] }
}
```

- [ ] **Step 2: Viết test thất bại cho `tokens.ts`**

`lib/auth/__tests__/tokens.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { decodeJwt, isExpiringSoon, hasRole } from '@/lib/auth/tokens'

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
  const p = { userId: 'u1', email: 'a@b.com', roles: [], type: 'access', exp: 1000, iat: 0 } as const
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
    const p = { userId: 'u', email: 'e', roles: ['user', 'shop'], type: 'access', exp: 1, iat: 1 } as const
    expect(hasRole(p, 'shop')).toBe(true)
    expect(hasRole(p, 'admin')).toBe(false)
    expect(hasRole(null, 'shop')).toBe(false)
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận FAIL**

Run: `pnpm test:run lib/auth/__tests__/tokens.test.ts`
Expected: FAIL — không import được `@/lib/auth/tokens` (chưa tồn tại).

- [ ] **Step 4: Cài đặt `lib/auth/tokens.ts`**

```ts
import type { JwtPayload } from '@/types/api'

export const COOKIE = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
  CLIENT: 'client_id',
} as const

export function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const bytes = Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as JwtPayload
  } catch {
    return null
  }
}

export function isExpiringSoon(
  payload: JwtPayload | null,
  nowMs: number,
  skewSeconds = 60,
): boolean {
  if (!payload?.exp) return true
  return payload.exp * 1000 - nowMs <= skewSeconds * 1000
}

export function hasRole(payload: JwtPayload | null, role: string): boolean {
  return Boolean(payload?.roles?.includes(role))
}
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `pnpm test:run lib/auth/__tests__/tokens.test.ts`
Expected: tất cả PASS.

- [ ] **Step 6: Commit**

```bash
git add e-commerce-nextjs/types e-commerce-nextjs/lib/auth
git commit -m "feat(fe): api types + edge-safe token utils (decode/expiry/role)"
```

---

### Task 4: HTTP helpers thuần + server API client

**Files:**
- Create: `e-commerce-nextjs/lib/api/http.ts`
- Test: `e-commerce-nextjs/lib/api/__tests__/http.test.ts`
- Create: `e-commerce-nextjs/lib/api/server-client.ts`

**Interfaces:**
- Consumes: `COOKIE` từ `@/lib/auth/tokens`.
- Produces:
  - `lib/api/http.ts` (KHÔNG `server-only`): `class ApiError extends Error { status: number }`, `interface SessionHeaders { clientId?: string; accessToken?: string }`, `buildHeaders({ apiKey, json?, session? }): Record<string,string>`, `unwrap<T>(res: Response): Promise<T>`.
  - `lib/api/server-client.ts` (`server-only`): `apiFetch<T>(path, opts?): Promise<T>` với `opts: { method?, body?, multipart?: FormData, auth?: boolean, tags?: string[], cache?: RequestCache }`; re-export `ApiError`.

- [ ] **Step 1: Viết test thất bại cho `http.ts`**

`lib/api/__tests__/http.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildHeaders, unwrap, ApiError } from '@/lib/api/http'

describe('buildHeaders', () => {
  it('luôn gắn x-api-key', () => {
    expect(buildHeaders({ apiKey: 'K' })).toEqual({ 'x-api-key': 'K' })
  })
  it('gắn content-type khi json=true', () => {
    expect(buildHeaders({ apiKey: 'K', json: true })['content-type']).toBe('application/json')
  })
  it('gắn x-client-id và authorization từ session', () => {
    const h = buildHeaders({ apiKey: 'K', session: { clientId: 'u1', accessToken: 'tok' } })
    expect(h['x-client-id']).toBe('u1')
    expect(h['authorization']).toBe('tok')
  })
  it('bỏ qua header auth khi session trống', () => {
    const h = buildHeaders({ apiKey: 'K', session: {} })
    expect(h['x-client-id']).toBeUndefined()
    expect(h['authorization']).toBeUndefined()
  })
})

function fakeRes(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('unwrap', () => {
  it('trả data khi 2xx', async () => {
    const data = await unwrap<{ x: number }>(fakeRes(200, { message: 'OK', statusCode: 200, data: { x: 1 } }))
    expect(data).toEqual({ x: 1 })
  })
  it('trả nguyên body nếu không có field data', async () => {
    const data = await unwrap<{ y: number }>(fakeRes(200, { y: 2 }))
    expect(data).toEqual({ y: 2 })
  })
  it('ném ApiError với message backend khi lỗi', async () => {
    await expect(unwrap(fakeRes(400, { message: 'Sai mật khẩu' }))).rejects.toMatchObject({
      status: 400,
      message: 'Sai mật khẩu',
    })
  })
  it('ApiError có message mặc định khi body không parse được', async () => {
    const res = { ok: false, status: 500, json: async () => { throw new Error('bad') } } as unknown as Response
    await expect(unwrap(res)).rejects.toBeInstanceOf(ApiError)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm test:run lib/api/__tests__/http.test.ts`
Expected: FAIL — chưa có `@/lib/api/http`.

- [ ] **Step 3: Cài đặt `lib/api/http.ts`**

```ts
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface SessionHeaders {
  clientId?: string
  accessToken?: string
}

export function buildHeaders(input: {
  apiKey: string
  json?: boolean
  session?: SessionHeaders
}): Record<string, string> {
  const headers: Record<string, string> = { 'x-api-key': input.apiKey }
  if (input.json) headers['content-type'] = 'application/json'
  if (input.session?.clientId) headers['x-client-id'] = input.session.clientId
  if (input.session?.accessToken) headers['authorization'] = input.session.accessToken
  return headers
}

export async function unwrap<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'message' in body && (body as { message?: string }).message) ||
      `Yêu cầu thất bại (${res.status})`
    throw new ApiError(res.status, message as string)
  }
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data
  }
  return body as T
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm test:run lib/api/__tests__/http.test.ts`
Expected: tất cả PASS.

- [ ] **Step 5: Cài đặt `lib/api/server-client.ts`**

```ts
import 'server-only'
import { cookies } from 'next/headers'
import { COOKIE } from '@/lib/auth/tokens'
import { ApiError, buildHeaders, unwrap, type SessionHeaders } from '@/lib/api/http'

export interface FetchOptions {
  method?: string
  body?: unknown
  multipart?: FormData
  auth?: boolean
  tags?: string[]
  cache?: RequestCache
}

function baseUrl(): string {
  const url = process.env.BACKEND_URL
  if (!url) throw new Error('BACKEND_URL chưa được cấu hình')
  return `${url}/api/v1`
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  let session: SessionHeaders | undefined
  if (opts.auth) {
    const store = await cookies()
    session = {
      clientId: store.get(COOKIE.CLIENT)?.value,
      accessToken: store.get(COOKIE.ACCESS)?.value,
    }
  }

  const json = !opts.multipart && opts.body !== undefined
  const headers = buildHeaders({ apiKey: process.env.API_KEY!, json, session })

  const method = opts.method ?? (opts.body !== undefined || opts.multipart ? 'POST' : 'GET')
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers,
    body: opts.multipart ?? (json ? JSON.stringify(opts.body) : undefined),
    cache: opts.cache ?? 'no-store',
    next: opts.tags ? { tags: opts.tags } : undefined,
  })
  return unwrap<T>(res)
}

export { ApiError }
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: sạch.

- [ ] **Step 7: Commit**

```bash
git add e-commerce-nextjs/lib/api
git commit -m "feat(fe): pure http helpers (tested) + server-only apiFetch BFF client"
```

---

### Task 5: Session (cookie httpOnly) — server-only

**Files:**
- Create: `e-commerce-nextjs/lib/auth/session.ts`

**Interfaces:**
- Consumes: `COOKIE`, `decodeJwt` từ `@/lib/auth/tokens`; `Tokens`, `JwtPayload` từ `@/types/api`.
- Produces (`server-only`): `setSession(tokens: Tokens, clientId: string): Promise<void>`, `clearSession(): Promise<void>`, `getAccessPayload(): Promise<JwtPayload|null>`, `getClientId(): Promise<string|undefined>`, `getRefreshToken(): Promise<string|undefined>`, `isShop(): Promise<boolean>`, `isAuthenticated(): Promise<boolean>`.

- [ ] **Step 1: Cài đặt `lib/auth/session.ts`**

```ts
import 'server-only'
import { cookies } from 'next/headers'
import { COOKIE, decodeJwt } from '@/lib/auth/tokens'
import type { JwtPayload, Tokens } from '@/types/api'

const TWO_DAYS = 60 * 60 * 24 * 2
const SEVEN_DAYS = 60 * 60 * 24 * 7

export async function setSession(tokens: Tokens, clientId: string): Promise<void> {
  const store = await cookies()
  const secure = process.env.NODE_ENV === 'production'
  const common = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' }
  store.set(COOKIE.ACCESS, tokens.accessToken, { ...common, maxAge: TWO_DAYS })
  store.set(COOKIE.REFRESH, tokens.refreshToken, { ...common, maxAge: SEVEN_DAYS })
  store.set(COOKIE.CLIENT, clientId, { ...common, maxAge: SEVEN_DAYS })
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE.ACCESS)
  store.delete(COOKIE.REFRESH)
  store.delete(COOKIE.CLIENT)
}

export async function getAccessPayload(): Promise<JwtPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE.ACCESS)?.value
  return token ? decodeJwt(token) : null
}

export async function getClientId(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(COOKIE.CLIENT)?.value
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(COOKIE.REFRESH)?.value
}

export async function isShop(): Promise<boolean> {
  const payload = await getAccessPayload()
  return Boolean(payload?.roles?.includes('shop'))
}

export async function isAuthenticated(): Promise<boolean> {
  return Boolean(await getClientId())
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: sạch. (Không unit test được vì phụ thuộc `next/headers`; sẽ smoke ở Task 12.)

- [ ] **Step 3: Commit**

```bash
git add e-commerce-nextjs/lib/auth/session.ts
git commit -m "feat(fe): httpOnly cookie session helpers (server-only)"
```

---

### Task 6: Zod validation schema cho auth

**Files:**
- Create: `e-commerce-nextjs/lib/validations/auth.ts`
- Test: `e-commerce-nextjs/lib/validations/__tests__/auth.test.ts`

**Interfaces:**
- Produces: `signupSchema`, `loginSchema`, `verifyOtpSchema` (zod); types `SignupInput`, `LoginInput`, `VerifyOtpInput`.

- [ ] **Step 1: Viết test thất bại**

`lib/validations/__tests__/auth.test.ts`:
```ts
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
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm test:run lib/validations/__tests__/auth.test.ts`
Expected: FAIL — chưa có module.

- [ ] **Step 3: Cài đặt `lib/validations/auth.ts`**

```ts
import { z } from 'zod'

export const signupSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  name: z.string().min(1, 'Vui lòng nhập tên'),
})

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

export const verifyOtpSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  otp: z.string().regex(/^\d{6}$/, 'OTP gồm 6 chữ số'),
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm test:run lib/validations/__tests__/auth.test.ts`
Expected: tất cả PASS.

- [ ] **Step 5: Commit**

```bash
git add e-commerce-nextjs/lib/validations
git commit -m "feat(fe): zod auth validation schemas (tested)"
```

---

### Task 7: Server Actions cho auth

**Files:**
- Create: `e-commerce-nextjs/actions/auth.actions.ts`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError` từ `@/lib/api/server-client`; `setSession`, `clearSession` từ `@/lib/auth/session`; `COOKIE` từ `@/lib/auth/tokens`; schema từ `@/lib/validations/auth`; `LoginData` từ `@/types/api`.
- Produces: `interface ActionState { ok: boolean; message?: string }`; actions `signupAction(prev, formData)`, `loginAction(prev, formData)`, `verifyOtpAction(prev, formData)`, `resendOtpAction(prev, formData)`, `logoutAction()`. `initialActionState`.

- [ ] **Step 1: Cài đặt `actions/auth.actions.ts`**

```ts
'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { apiFetch, ApiError } from '@/lib/api/server-client'
import { setSession, clearSession } from '@/lib/auth/session'
import { COOKIE } from '@/lib/auth/tokens'
import { loginSchema, signupSchema, verifyOtpSchema } from '@/lib/validations/auth'
import type { LoginData } from '@/types/api'

export interface ActionState {
  ok: boolean
  message?: string
}

export const initialActionState: ActionState = { ok: false }

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
```

- [ ] **Step 2: Typecheck & lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sạch.

- [ ] **Step 3: Commit**

```bash
git add e-commerce-nextjs/actions/auth.actions.ts
git commit -m "feat(fe): auth server actions (signup/login/verify-otp/resend/logout)"
```

---

### Task 8: Middleware (refresh + bảo vệ /seller) + trang /seller tối thiểu

**Files:**
- Create: `e-commerce-nextjs/middleware.ts`
- Create: `e-commerce-nextjs/app/(seller)/seller/page.tsx`
- Create: `e-commerce-nextjs/app/(seller)/seller/layout.tsx`

**Interfaces:**
- Consumes: `COOKIE`, `decodeJwt`, `isExpiringSoon` từ `@/lib/auth/tokens`; `Tokens`, `RefreshData` từ `@/types/api`.
- Produces: middleware bảo vệ matcher `/seller/:path*`; trang `/seller` hiển thị email từ payload + nút Đăng xuất (dùng `logoutAction`).

- [ ] **Step 1: Cài đặt `middleware.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { COOKIE, decodeJwt, isExpiringSoon } from '@/lib/auth/tokens'
import type { Tokens } from '@/types/api'

const TWO_DAYS = 60 * 60 * 24 * 2
const SEVEN_DAYS = 60 * 60 * 24 * 7

async function refreshTokens(clientId: string, refresh: string): Promise<Tokens | null> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/api/v1/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.API_KEY!,
        'x-client-id': clientId,
        'x-refresh-token': refresh,
      },
    })
    if (!res.ok) return null
    const json = await res.json()
    return (json?.data?.tokens ?? null) as Tokens | null
  } catch {
    return null
  }
}

function writeCookies(res: NextResponse, tokens: Tokens, clientId: string) {
  const secure = process.env.NODE_ENV === 'production'
  const common = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' }
  res.cookies.set(COOKIE.ACCESS, tokens.accessToken, { ...common, maxAge: TWO_DAYS })
  res.cookies.set(COOKIE.REFRESH, tokens.refreshToken, { ...common, maxAge: SEVEN_DAYS })
  res.cookies.set(COOKIE.CLIENT, clientId, { ...common, maxAge: SEVEN_DAYS })
}

function redirectToLogin(req: NextRequest): NextResponse {
  const url = new URL('/login', req.url)
  url.searchParams.set('redirect', req.nextUrl.pathname)
  const res = NextResponse.redirect(url)
  res.cookies.delete(COOKIE.ACCESS)
  res.cookies.delete(COOKIE.REFRESH)
  res.cookies.delete(COOKIE.CLIENT)
  return res
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const access = req.cookies.get(COOKIE.ACCESS)?.value
  const refresh = req.cookies.get(COOKIE.REFRESH)?.value
  const clientId = req.cookies.get(COOKIE.CLIENT)?.value

  if (!clientId) return redirectToLogin(req)

  let payload = access ? decodeJwt(access) : null
  const res = NextResponse.next()

  // Refresh proactively nếu access sắp/đã hết hạn và còn refresh token.
  if (refresh && isExpiringSoon(payload, Date.now())) {
    const tokens = await refreshTokens(clientId, refresh)
    if (!tokens) return redirectToLogin(req)
    writeCookies(res, tokens, clientId)
    payload = decodeJwt(tokens.accessToken)
  }

  if (!payload) return redirectToLogin(req)

  return res
}

export const config = {
  matcher: ['/seller/:path*'],
}
```

> Ghi chú: role-gate (`/seller/*` yêu cầu role `shop`, redirect sang `/seller/account`) sẽ thêm ở M2 khi trang account tồn tại. M1 chỉ bảo vệ theo trạng thái đăng nhập + refresh.

- [ ] **Step 2: Tạo layout & trang `/seller` tối thiểu**

`app/(seller)/seller/layout.tsx`:
```tsx
export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 p-6 md:p-10">{children}</div>
}
```

`app/(seller)/seller/page.tsx`:
```tsx
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
```

- [ ] **Step 3: Typecheck & build**

Run: `pnpm typecheck && pnpm build`
Expected: sạch; build thành công.

- [ ] **Step 4: Commit**

```bash
git add e-commerce-nextjs/middleware.ts "e-commerce-nextjs/app/(seller)"
git commit -m "feat(fe): edge middleware (auth guard + token refresh) + minimal /seller"
```

---

### Task 9: Route group (auth) + trang Đăng nhập

**Files:**
- Create: `e-commerce-nextjs/app/(auth)/layout.tsx`
- Create: `e-commerce-nextjs/components/auth/submit-button.tsx`
- Create: `e-commerce-nextjs/app/(auth)/login/page.tsx`
- Create: `e-commerce-nextjs/components/auth/login-form.tsx`

**Interfaces:**
- Consumes: `loginAction`, `initialActionState`, `ActionState` từ `@/actions/auth.actions`.
- Produces: `SubmitButton` (client, dùng `useFormStatus`); trang `/login` nhận `searchParams.redirect`.

- [ ] **Step 1: Layout tối giản cho (auth)**

`app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: SubmitButton dùng chung**

`components/auth/submit-button.tsx`:
```tsx
'use client'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Đang xử lý…' : children}
    </Button>
  )
}
```

- [ ] **Step 3: Login form (client) + toast lỗi**

`components/auth/login-form.tsx`:
```tsx
'use client'
import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { loginAction, initialActionState } from '@/actions/auth.actions'
import { SubmitButton } from '@/components/auth/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useActionState(loginAction, initialActionState)

  useEffect(() => {
    if (state.message) toast.error(state.message)
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đăng nhập</CardTitle>
        <CardDescription>Truy cập kênh người bán</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirect" value={redirectTo} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <SubmitButton>Đăng nhập</SubmitButton>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">Đăng ký</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Trang `/login`**

`app/(auth)/login/page.tsx`:
```tsx
import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect } = await searchParams
  return <LoginForm redirectTo={redirect || '/seller'} />
}
```

- [ ] **Step 5: Typecheck & build**

Run: `pnpm typecheck && pnpm build`
Expected: sạch; build thành công.

- [ ] **Step 6: Commit**

```bash
git add "e-commerce-nextjs/app/(auth)/layout.tsx" "e-commerce-nextjs/app/(auth)/login" e-commerce-nextjs/components/auth
git commit -m "feat(fe): auth layout + login page (server action form)"
```

---

### Task 10: Trang Đăng ký

**Files:**
- Create: `e-commerce-nextjs/app/(auth)/signup/page.tsx`
- Create: `e-commerce-nextjs/components/auth/signup-form.tsx`

**Interfaces:**
- Consumes: `signupAction`, `initialActionState` từ `@/actions/auth.actions`; `SubmitButton`.
- Produces: trang `/signup`.

- [ ] **Step 1: Signup form (client)**

`components/auth/signup-form.tsx`:
```tsx
'use client'
import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { signupAction, initialActionState } from '@/actions/auth.actions'
import { SubmitButton } from '@/components/auth/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, initialActionState)

  useEffect(() => {
    if (state.message) toast.error(state.message)
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đăng ký</CardTitle>
        <CardDescription>Tạo tài khoản để bắt đầu bán hàng</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Họ tên</Label>
            <Input id="name" name="name" required autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" name="password" type="password" required autoComplete="new-password" />
          </div>
          <SubmitButton>Đăng ký</SubmitButton>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">Đăng nhập</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Trang `/signup`**

`app/(auth)/signup/page.tsx`:
```tsx
import { SignupForm } from '@/components/auth/signup-form'

export default function SignupPage() {
  return <SignupForm />
}
```

- [ ] **Step 3: Typecheck & build**

Run: `pnpm typecheck && pnpm build`
Expected: sạch; build thành công.

- [ ] **Step 4: Commit**

```bash
git add "e-commerce-nextjs/app/(auth)/signup" e-commerce-nextjs/components/auth/signup-form.tsx
git commit -m "feat(fe): signup page"
```

---

### Task 11: Trang Xác thực OTP + gửi lại OTP

**Files:**
- Create: `e-commerce-nextjs/app/(auth)/verify-otp/page.tsx`
- Create: `e-commerce-nextjs/components/auth/verify-otp-form.tsx`

**Interfaces:**
- Consumes: `verifyOtpAction`, `resendOtpAction`, `initialActionState` từ `@/actions/auth.actions`; `SubmitButton`.
- Produces: trang `/verify-otp` đọc `searchParams.email`.

- [ ] **Step 1: Verify OTP form (client) — có nút gửi lại**

`components/auth/verify-otp-form.tsx`:
```tsx
'use client'
import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { verifyOtpAction, resendOtpAction, initialActionState } from '@/actions/auth.actions'
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
```

- [ ] **Step 2: Trang `/verify-otp`**

`app/(auth)/verify-otp/page.tsx`:
```tsx
import { VerifyOtpForm } from '@/components/auth/verify-otp-form'

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return <VerifyOtpForm email={email || ''} />
}
```

- [ ] **Step 3: Typecheck & build**

Run: `pnpm typecheck && pnpm build`
Expected: sạch; build thành công.

- [ ] **Step 4: Commit**

```bash
git add "e-commerce-nextjs/app/(auth)/verify-otp" e-commerce-nextjs/components/auth/verify-otp-form.tsx
git commit -m "feat(fe): verify-otp page + resend"
```

---

### Task 12: Kiểm thử tích hợp thủ công (smoke) toàn luồng

**Files:**
- Không tạo file mới. Chạy thật với backend đang chạy.

**Interfaces:**
- Consumes: toàn bộ M1.

**Điều kiện tiên quyết:** backend Express đang chạy (`pnpm dev` ở gốc repo, MongoDB + Redis + SMTP mailtrap cấu hình theo `.env.development`), và `e-commerce-nextjs/.env.local` có `BACKEND_URL` + `API_KEY` hợp lệ (api key đã seed, permission chứa `0000`).

- [ ] **Step 1: Chạy toàn bộ unit test**

Run trong `e-commerce-nextjs/`: `pnpm test:run`
Expected: tất cả test (tokens, http, validations, smoke) PASS.

- [ ] **Step 2: Chạy typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: sạch; build thành công.

- [ ] **Step 3: Chạy dev và smoke luồng đăng ký → OTP**

Run: `pnpm dev` (mặc định cổng 3000). Mở `http://localhost:3000/signup`.
- Điền tên/email/mật khẩu hợp lệ → submit.
- Expected: redirect tới `/verify-otp?email=...`; nhận email OTP (mailtrap).
- Nhập sai OTP → toast lỗi "Invalid or expired OTP".
- Nhập đúng OTP → redirect `/seller`, thấy email + vai trò `user`.

- [ ] **Step 4: Smoke đăng xuất + bảo vệ route**

- Ở `/seller` bấm **Đăng xuất** → redirect `/login`.
- Truy cập thẳng `http://localhost:3000/seller` khi chưa đăng nhập → redirect `/login?redirect=/seller`.

- [ ] **Step 5: Smoke đăng nhập + redirect param**

- Ở `/login?redirect=/seller` đăng nhập bằng tài khoản vừa tạo → redirect `/seller`.
- Sai mật khẩu → toast lỗi "Invalid password".

- [ ] **Step 6: Xác nhận cookie httpOnly & không lộ api-key**

- DevTools → Application → Cookies: `access_token`, `refresh_token`, `client_id` đều `HttpOnly`.
- DevTools → Network: không request nào từ trình duyệt chứa header `x-api-key` (mọi call backend đi qua server Next).

- [ ] **Step 7: Commit (nếu có chỉnh sửa nhỏ khi smoke)**

```bash
git add -A e-commerce-nextjs
git commit -m "test(fe): M1 smoke pass — auth flow end-to-end"
```

---

## Self-Review

**1. Spec coverage (M1 phần của spec §6):**
- Cài shadcn/ui, `cn`, tokens Tailwind, `.env` → Task 1, 2. ✔
- `server-client` → Task 4. ✔
- `session`/cookie → Task 5. ✔
- `middleware` (refresh + gate) → Task 8 (auth guard + refresh; role-gate hoãn sang M2 có ghi chú rõ). ✔
- Trang login/signup/verify-otp/resend + logout action → Task 7, 9, 10, 11. ✔
- Kết quả demo (đăng ký → OTP → verify → auto-login → giữ session; login/logout) → Task 12. ✔
- Contract headers (`x-api-key`, `x-client-id`, `authorization`; logout/refresh dùng `x-refresh-token`) → Task 4 (apiFetch), Task 7 (logout raw fetch), Task 8 (refresh raw fetch). ✔

**2. Placeholder scan:** Không có TBD/TODO; mọi step có code hoặc lệnh cụ thể. ✔

**3. Type consistency:** `ActionState`, `initialActionState` khai báo ở Task 7, dùng nhất quán ở Task 9–11. `COOKIE`/`decodeJwt`/`isExpiringSoon` khai báo Task 3, dùng ở Task 4/5/8. `Tokens`/`LoginData`/`RefreshData` khai báo Task 3, dùng ở Task 4/7/8. `apiFetch`/`ApiError` Task 4 → Task 7. `setSession`/`clearSession` Task 5 → Task 7. Nhất quán. ✔

**Ghi chú giới hạn đã biết:** `/seller` ở M1 truy cập được cho mọi user đã đăng nhập (role-gate `shop` thêm ở M2). Đúng chủ đích để M1 vẫn demo được luồng auth độc lập.
