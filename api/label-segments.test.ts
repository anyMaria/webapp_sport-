import { describe, expect, it } from 'vitest'
import handler from './label-segments'

function call(method: string, body?: unknown) {
  let status = 0
  let json: unknown
  const res = { status(c: number) { status = c; return res }, json(b: unknown) { json = b } }
  return handler({ method, body }, res).then(() => ({ status, json }))
}

describe('api/label-segments sans clé', () => {
  it('GET : désactivé, le bouton n’apparaît pas', async () => {
    expect(await call('GET')).toEqual({ status: 200, json: { enabled: false } })
  })
  it('POST : refusé sans clé', async () => {
    expect((await call('POST', { segments: [{ id: 'a', images: ['AAAA'] }] })).status).toBe(503)
  })
  it('autres méthodes refusées', async () => {
    expect((await call('DELETE')).status).toBe(405)
  })
})
