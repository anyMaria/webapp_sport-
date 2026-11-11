import { describe, expect, it } from 'vitest'
import handler, { parseFound, parseLabels, pickVisionModel } from '../api/ai'

function call(method: string, body?: unknown, query?: Record<string, string>) {
  let status = 0
  let json: unknown
  const res = { status(c: number) { status = c; return res }, json(b: unknown) { json = b } }
  return handler({ method, body, query }, res).then(() => ({ status, json }))
}

describe('api/ai sans clé', () => {
  it('GET : désactivé', async () => { expect(await call('GET')).toEqual({ status: 200, json: { enabled: false, hasKey: false } }) })
  it('POST : refusé', async () => { expect((await call('POST', { task: 'segments' })).status).toBe(503) })
  it('autres méthodes refusées', async () => { expect((await call('PUT')).status).toBe(405) })
})

describe('choix du modèle de vision', () => {
  it('prend le plus léger reconnaissable, ignore les modèles non adaptés', () => {
    expect(pickVisionModel(['whisper-large', 'llama-3.1-8b-instant', 'meta-llama/llama-4-maverick-17b', 'meta-llama/llama-4-scout-17b'])).toBe('meta-llama/llama-4-scout-17b')
    expect(pickVisionModel(['x-vision-preview', 'a'])).toBe('x-vision-preview')
    expect(pickVisionModel(['llama-3.1-8b-instant'])).toBeNull()
    expect(pickVisionModel(['llama-3.1-8b-instant', 'meta-llama/llama-4-x'])).toBe('meta-llama/llama-4-x')
    expect(pickVisionModel(['llama-guard-scout'])).toBeNull()
  })
})

describe('lecture des réponses', () => {
  it('exercices : garde les valides et borne les temps', () => {
    const text = 'Voici : [{"start":-2,"end":30,"name":" Chat-vache ","cue":"Dos rond"},{"start":40,"end":40.2,"name":"Trop court"},{"start":50,"end":999,"name":"Fente","cue":""},{"start":"x","end":3,"name":"Faux"}]'
    expect(parseFound(text, 120)).toEqual([{ start: 0, end: 30, name: 'Chat-vache', cue: 'Dos rond' }, { start: 50, end: 120, name: 'Fente', cue: '' }])
    expect(parseFound('désolé', 100)).toEqual([])
  })
  it('noms : ignore les identifiants inconnus', () => {
    expect(parseLabels('[{"id":"a","name":"Pont","cue":"x"},{"id":"zz","name":"Autre"}]', ['a'])).toEqual([{ id: 'a', name: 'Pont', cue: 'x' }])
  })
})
