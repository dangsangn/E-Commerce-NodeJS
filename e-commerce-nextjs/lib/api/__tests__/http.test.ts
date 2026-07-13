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
