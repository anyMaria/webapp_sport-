import { describe, expect, it } from 'vitest'
import handler, { candidatesFor, grokCandidates, marksPrompt, parseLabels, parseMarks, pickGeminiModel, pickVisionModel, retryDelay, variantsFor, whyEmpty } from '../api/ai'

function call(method: string, body?: unknown, query?: Record<string, string>) {
  let status = 0
  let json: unknown
  const res = { status(c: number) { status = c; return res }, json(b: unknown) { json = b } }
  return handler({ method, body, query }, res).then(() => ({ status, json }))
}

describe('api/ai sans clé', () => {
  it('GET : désactivé', async () => { expect(await call('GET')).toEqual({ status: 200, json: { enabled: false, hasKey: false } }) })
  it('POST : refusé', async () => { expect((await call('POST', { task: 'marks' })).status).toBe(503) })
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
  it('noms : ignore les identifiants inconnus, accepte un objet autour de la liste', () => {
    expect(parseLabels('[{"id":"a","name":"Pont","cue":"x"},{"id":"zz","name":"Autre"}]', ['a'])).toEqual([{ id: 'a', name: 'Pont', cue: 'x' }])
    expect(parseLabels('{"labels":[{"id":"a","name":"Pont"}]}', ['a'])).toEqual([{ id: 'a', name: 'Pont', cue: '' }])
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
  it('lit les images numérotées et les noms', () => {
    const text = 'Voici : {"images":[{"n":1,"ex":0},{"n":2,"ex":1},{"n":3,"ex":1},{"n":4,"ex":2}],"exercices":[{"ex":1,"name":" Flexion ","cue":"Dos long"},{"ex":2,"name":"Chien tête en bas"}]}'
    expect(parseMarks(text, 4)).toEqual({ labels: [0, 1, 1, 2], names: [{ ex: 1, name: 'Flexion', cue: 'Dos long' }, { ex: 2, name: 'Chien tête en bas', cue: '' }] })
  })
  it('une image oubliée reprend l\'étiquette d\'avant, une image en trop est ignorée', () => {
    expect(parseMarks('{"images":[{"n":1,"ex":1},{"n":2,"ex":1},{"n":4,"ex":2},{"n":9,"ex":3}]}', 4)?.labels).toEqual([1, 1, 1, 2])
  })
  it('accepte une simple liste de numéros, des lettres, et renumérote dans l\'ordre', () => {
    expect(parseMarks('{"frames":[0,7,7,3]}', 4)?.labels).toEqual([0, 1, 1, 2])
    const r = parseMarks('{"images":[{"n":1,"ex":"B"},{"n":2,"ex":"B"},{"n":3,"ex":"A"}],"exercises":{"A":{"name":"Pont"},"B":"Fente"}}', 3)
    expect(r).toEqual({ labels: [1, 1, 2], names: [{ ex: 2, name: 'Pont', cue: '' }, { ex: 1, name: 'Fente', cue: '' }] })
  })
  it('ignore le raisonnement entre <think>', () => {
    expect(parseMarks('<think>{"images":[9]}</think>{"images":[1,1]}', 2)?.labels).toEqual([1, 1])
  })
  it('refuse une réponse inexploitable', () => {
    expect(parseMarks('pas de json', 4)).toBeNull()
    expect(parseMarks('{"images":[{"n":1,"ex":1}]}', 4)).toBeNull()
    expect(parseMarks('{"exercices":[]}', 4)).toBeNull()
  })
  it('la consigne demande le bon nombre d\'étiquettes et rappelle ce qui précède', () => {
    const p = marksPrompt(12, 0.45, 'Chat-vache')
    expect(p).toContain('exactement 12 entrées')
    expect(p).toContain('« Chat-vache »')
    expect(p).toContain('JSON')
    expect(marksPrompt(12, 0.45, '')).not.toContain('Juste avant')
  })
})

describe('service saturé et réglages', () => {
  it('délai conseillé : en-tête, message, valeur par défaut', () => {
    expect(retryDelay('7', '')).toBe(7)
    expect(retryDelay(null, 'Rate limit reached. Please try again in 7.66s.')).toBe(8)
    expect(retryDelay(null, 'Please try again in 1m2.5s.')).toBe(60)
    expect(retryDelay(null, 'try again in 320ms')).toBe(1)
    expect(retryDelay(null, 'trop de demandes')).toBe(10)
  })
  it('réponse en JSON d\'abord, puis sans ce réglage', () => {
    expect(variantsFor('meta-llama/llama-4-scout-17b-16e-instruct')).toEqual([{ response_format: { type: 'json_object' } }, {}])
    expect(variantsFor('qwen/qwen3-32b')[0]).toMatchObject({ reasoning_effort: 'none' })
  })
})

describe('modèles possibles par service', () => {
  it('Groq : plusieurs modèles de vision, dans l\'ordre', () => {
    expect(candidatesFor('Groq', ['whisper-large', 'meta-llama/llama-4-maverick-17b', 'meta-llama/llama-4-scout-17b', 'llama-3.1-8b-instant'])).toEqual(['meta-llama/llama-4-scout-17b', 'meta-llama/llama-4-maverick-17b'])
  })
  it('xAI : vision d\'abord, sinon les Grok récents rapides, jamais image ni code', () => {
    expect(grokCandidates(['grok-3', 'grok-4', 'grok-4-fast-non-reasoning', 'grok-code-fast-1', 'grok-2-image-1212', 'grok-2-vision-1212'])).toEqual(['grok-2-vision-1212', 'grok-4-fast-non-reasoning', 'grok-4'])
    expect(candidatesFor('xAI', ['grok-3'])).toEqual([])
  })
})

describe('choix du modèle Gemini', () => {
  it('prend le flash le plus récent, ni lite ni image', () => {
    expect(pickGeminiModel(['models/gemini-2.0-flash', 'models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-2.5-flash-image', 'models/text-embedding-004'])).toBe('gemini-2.5-flash')
    expect(pickGeminiModel(['models/text-embedding-004'])).toBeNull()
  })
})
