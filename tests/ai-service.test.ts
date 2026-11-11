import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Faux service d'IA : on vérifie ce que la fonction lui demande et ce qu'elle fait de ses refus. */
type Reply = { status: number; body: unknown; headers?: Record<string, string> }
const IMG = 'AAAA'
const GOOD = { choices: [{ message: { content: '{"images":[{"n":1,"ex":1},{"n":2,"ex":1}],"exercices":[{"ex":1,"name":"Pont","cue":""}]}' }, finish_reason: 'stop' }] }

async function setup(env: Record<string, string>, chat: (body: { model: string; response_format?: unknown }) => Reply, modelIds = ['llama-3.1-8b-instant', 'meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct']) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  const calls: { url: string; auth: string; body?: { model: string; response_format?: unknown } }[] = []
  vi.stubGlobal('fetch', async (url: string, init?: { headers?: Record<string, string>; body?: string }) => {
    const body = init?.body ? (JSON.parse(init.body) as { model: string; response_format?: unknown }) : undefined
    calls.push({ url, auth: init?.headers?.authorization ?? '', body })
    const r: Reply = url.endsWith('/models') ? { status: 200, body: { data: modelIds.map((id) => ({ id })) } } : chat(body!)
    return new Response(JSON.stringify(r.body), { status: r.status, headers: r.headers })
  })
  const handler = (await import('../api/ai')).default
  const call = async (method: string, body?: unknown) => {
    let status = 0
    let json: unknown
    const res = { status(c: number) { status = c; return res }, json(b: unknown) { json = b } }
    await handler({ method, body }, res)
    return { status, json: json as Record<string, unknown> }
  }
  return { call, calls, chats: () => calls.filter((c) => c.url.endsWith('/chat/completions')) }
}
const marks = { task: 'marks', image: IMG, count: 2, stepSec: 0.5, prev: '' }

describe('api/ai avec un service', () => {
  beforeEach(() => { for (const k of ['XAI_API_KEY', 'GROCK_API', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'AI_PROVIDER', 'XAI_MODEL', 'AI_BASE_URL']) vi.stubEnv(k, '') })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('clé Groq : appelle Groq avec le modèle de vision le plus léger', async () => {
    const t = await setup({ GROCK_API: 'gsk_abc' }, () => ({ status: 200, body: GOOD }))
    expect((await t.call('GET')).json).toMatchObject({ enabled: true, provider: 'Groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct' })
    const r = await t.call('POST', marks)
    expect(r).toEqual({ status: 200, json: { labels: [1, 1], names: [{ ex: 1, name: 'Pont', cue: '' }] } })
    expect(t.chats()[0]).toMatchObject({ url: 'https://api.groq.com/openai/v1/chat/completions', auth: 'Bearer gsk_abc' })
    expect(t.chats()[0]!.body).toMatchObject({ model: 'meta-llama/llama-4-scout-17b-16e-instruct', response_format: { type: 'json_object' } })
  })

  it('Groq passe avant Gemini quand les deux clés existent ; AI_PROVIDER=gemini inverse', async () => {
    const a = await setup({ GROCK_API: 'gsk_abc', GEMINI_API_KEY: 'AIzaXYZ' }, () => ({ status: 200, body: GOOD }))
    expect((await a.call('GET')).json).toMatchObject({ provider: 'Groq' })
    const b = await setup({ GROCK_API: 'gsk_abc', GEMINI_API_KEY: 'AIzaXYZ', AI_PROVIDER: 'gemini' }, () => ({ status: 200, body: GOOD }), ['models/gemini-2.5-flash'])
    expect((await b.call('GET')).json).toMatchObject({ provider: 'Gemini', model: 'gemini-2.5-flash' })
  })

  it('clé xAI : appelle xAI', async () => {
    const t = await setup({ XAI_API_KEY: 'xai-abc' }, () => ({ status: 200, body: GOOD }), ['grok-3', 'grok-4-fast-non-reasoning'])
    expect((await t.call('POST', marks)).status).toBe(200)
    expect(t.chats()[0]).toMatchObject({ url: 'https://api.x.ai/v1/chat/completions' })
    expect(t.chats()[0]!.body!.model).toBe('grok-4-fast-non-reasoning')
  })

  it('réglage JSON refusé : réessaie sans, et s\'en souvient pour la demande suivante', async () => {
    const t = await setup({ GROCK_API: 'gsk_abc' }, (b) => (b.response_format ? { status: 400, body: { error: { message: 'response_format is not supported' } } } : { status: 200, body: GOOD }))
    expect((await t.call('POST', marks)).status).toBe(200)
    expect(t.chats()).toHaveLength(2)
    expect((await t.call('POST', marks)).status).toBe(200)
    expect(t.chats()).toHaveLength(3)
    expect(t.chats()[2]!.body!.response_format).toBeUndefined()
  })

  it('JSON mal formé par le modèle : réessaie sans le réglage, sans l\'abandonner pour la suite', async () => {
    let n = 0
    const t = await setup({ GROCK_API: 'gsk_abc' }, () => (n++ === 0 ? { status: 400, body: { error: { code: 'json_validate_failed', message: 'Failed to generate JSON' } } } : { status: 200, body: GOOD }))
    expect((await t.call('POST', marks)).status).toBe(200)
    await t.call('POST', marks)
    expect(t.chats()[2]!.body!.response_format).toBeDefined()
  })

  it('modèle retiré ou sans images : passe au modèle suivant', async () => {
    const t = await setup({ GROCK_API: 'gsk_abc' }, (b) => (b.model.includes('scout') ? { status: 400, body: { error: { message: 'The model has been decommissioned' } } } : { status: 200, body: GOOD }))
    expect((await t.call('POST', marks)).status).toBe(200)
    expect(t.chats().map((c) => c.body!.model)).toEqual(['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'])
    expect((await t.call('GET')).json).toMatchObject({ model: 'meta-llama/llama-4-maverick-17b-128e-instruct' })
  })

  it('modèle choisi dans Vercel : utilisé d\'abord ; s\'il est retiré, un modèle de la liste prend le relais', async () => {
    const ok = await setup({ GROCK_API: 'gsk_abc', XAI_MODEL: 'mon-modele' }, () => ({ status: 200, body: GOOD }))
    expect((await ok.call('POST', marks)).status).toBe(200)
    expect(ok.chats()[0]!.body!.model).toBe('mon-modele')
    const t = await setup({ GROCK_API: 'gsk_abc', XAI_MODEL: 'ancien-modele' }, (b) => (b.model === 'ancien-modele' ? { status: 404, body: { error: { message: 'The model `ancien-modele` does not exist' } } } : { status: 200, body: GOOD }))
    expect((await t.call('POST', marks)).status).toBe(200)
    expect(t.chats().map((c) => c.body!.model)).toEqual(['ancien-modele', 'meta-llama/llama-4-scout-17b-16e-instruct'])
  })

  it('service saturé : code 429 et délai transmis à l\'app', async () => {
    const t = await setup({ GROCK_API: 'gsk_abc' }, () => ({ status: 429, headers: { 'retry-after': '12' }, body: { error: { message: 'Rate limit reached' } } }))
    const r = await t.call('POST', marks)
    expect(r.status).toBe(429)
    expect(r.json).toMatchObject({ retryAfter: 12 })
    expect(t.chats()).toHaveLength(1)
  })

  it('clé refusée : message clair, pas d\'autre essai', async () => {
    const t = await setup({ GROCK_API: 'gsk_abc' }, () => ({ status: 401, body: { error: { message: 'Invalid API Key' } } }))
    const r = await t.call('POST', marks)
    expect(r.status).toBe(502)
    expect(String(r.json.error)).toContain('refuse la clé')
    expect(t.chats()).toHaveLength(1)
  })

  it('réponse inexploitable : pas d\'étiquettes, mais la raison', async () => {
    const t = await setup({ GROCK_API: 'gsk_abc' }, () => ({ status: 200, body: { choices: [{ message: { content: 'Je ne vois rien.' }, finish_reason: 'stop' }] } }))
    expect((await t.call('POST', marks)).json).toEqual({ labels: null, note: 'Réponse du modèle : « Je ne vois rien. »' })
  })

  it('demande invalide refusée sans appeler le service', async () => {
    const t = await setup({ GROCK_API: 'gsk_abc' }, () => ({ status: 200, body: GOOD }))
    expect((await t.call('POST', { task: 'marks', image: 'pas du base64 !', count: 2, stepSec: 1 })).status).toBe(400)
    expect((await t.call('POST', { task: 'marks', image: IMG, count: 99, stepSec: 1 })).status).toBe(400)
    expect(t.chats()).toHaveLength(0)
  })

  it('la clé n\'apparaît jamais dans une réponse', async () => {
    const t = await setup({ GROCK_API: 'gsk_secret' }, () => ({ status: 500, body: { error: { message: 'boom' } } }))
    const all = JSON.stringify([await t.call('GET'), await t.call('POST', marks)])
    expect(all).not.toContain('gsk_secret')
  })
})
