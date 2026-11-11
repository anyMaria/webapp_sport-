import { describe, expect, it } from 'vitest'
import handler, { exercisesFromFrames, parseFound, parseLabels, pickGeminiModel, pickVisionModel, whyEmpty } from '../api/ai'

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
    expect(parseFound('<think>je pense à [1, 2] et à [3]</think>[{"start":0,"end":20,"name":"Pont"}]', 60)).toEqual([{ start: 0, end: 20, name: 'Pont', cue: '' }])
  })
  it('noms : ignore les identifiants inconnus', () => {
    expect(parseLabels('[{"id":"a","name":"Pont","cue":"x"},{"id":"zz","name":"Autre"}]', ['a'])).toEqual([{ id: 'a', name: 'Pont', cue: 'x' }])
  })
})

describe('explication d\'une réponse vide', () => {
  it('réponse coupée, réponse en texte, silence', () => {
    expect(whyEmpty({ text: '<think>long</think>', finish: 'length' })).toContain('trop réfléchi')
    expect(whyEmpty({ text: 'Je ne vois pas d\'exercice.', finish: 'stop' })).toBe("Réponse du modèle : « Je ne vois pas d'exercice. »")
    expect(whyEmpty({ text: '', finish: 'stop' })).toContain('rien répondu')
  })
})

describe('une étiquette par image', () => {
  const times = [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75, 4.25, 4.75]
  it('regroupe les images, place les limites à mi-chemin, ignore le 0', () => {
    const text = '{"frames":[0,0,1,1,1,2,2,2,0,0],"exercises":[{"id":1,"name":"Flexion","cue":"Dos long"},{"id":2,"name":"Chien tête en bas"}]}'
    expect(exercisesFromFrames(text, times, 5)).toEqual([
      { start: 1, end: 2.5, name: 'Flexion', cue: 'Dos long' },
      { start: 2.5, end: 4, name: 'Chien tête en bas', cue: '' },
    ])
  })
  it('lisse une image isolée', () => {
    const r = exercisesFromFrames('{"frames":[1,1,1,2,1,1,1,1,1,1],"exercises":[]}', times, 5)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ start: 0, end: 5, name: 'Exercice 1' })
  })
  it('refuse un nombre d\'étiquettes différent du nombre d\'images', () => {
    expect(exercisesFromFrames('{"frames":[1,2],"exercises":[]}', times, 5)).toEqual([])
    expect(exercisesFromFrames('pas de json', times, 5)).toEqual([])
  })
})

describe('choix du modèle Gemini', () => {
  it('prend le flash le plus récent, ni lite ni image', () => {
    expect(pickGeminiModel(['models/gemini-2.0-flash', 'models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-2.5-flash-image', 'models/text-embedding-004'])).toBe('gemini-2.5-flash')
    expect(pickGeminiModel(['models/text-embedding-004'])).toBeNull()
  })
})
