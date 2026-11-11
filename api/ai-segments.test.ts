import { describe, expect, it } from 'vitest'
import handler, { parseFound } from './ai-segments'

function call(method: string, body?: unknown) {
  let status = 0
  let json: unknown
  const res = { status(c: number) { status = c; return res }, json(b: unknown) { json = b } }
  return handler({ method, body }, res).then(() => ({ status, json }))
}

describe('api/ai-segments sans clé', () => {
  it('GET : désactivé', async () => { expect(await call('GET')).toEqual({ status: 200, json: { enabled: false, hasKey: false } }) })
  it('POST : refusé', async () => { expect((await call('POST', {})).status).toBe(503) })
  it('autres méthodes refusées', async () => { expect((await call('PUT')).status).toBe(405) })
})

describe('lecture de la réponse', () => {
  it('garde les exercices valides et borne les temps', () => {
    const text = 'Voici : [{"start":-2,"end":30,"name":" Chat-vache ","cue":"Dos rond"},{"start":40,"end":40.2,"name":"Trop court"},{"start":50,"end":999,"name":"Fente","cue":""},{"start":"x","end":3,"name":"Faux"}]'
    expect(parseFound(text, 120)).toEqual([
      { start: 0, end: 30, name: 'Chat-vache', cue: 'Dos rond' },
      { start: 50, end: 120, name: 'Fente', cue: '' },
    ])
  })
  it('réponse illisible : rien', () => {
    expect(parseFound('désolé', 100)).toEqual([])
    expect(parseFound('[oups', 100)).toEqual([])
  })
})
