/**
 * IA (optionnelle) : découpe d'une vidéo et nommage des exercices, avec un modèle de vision.
 * Un seul fichier, sans import : une fonction Vercel qui en importe une autre peut casser selon le format de module.
 *
 * Service : Groq ou xAI (Grok), tous deux au format « chat completions » avec images.
 * Variables d'environnement Vercel (jamais de clé dans le code) :
 *   XAI_API_KEY ou GROCK_API ou GROQ_API_KEY …  la clé (« gsk_… » = Groq, « xai-… » = xAI)
 *   XAI_MODEL (ou GROQ_MODEL…)                  facultatif : sinon le modèle de vision est choisi dans la liste du service
 *   AI_BASE_URL                                 facultatif : adresse du service (déduite de la clé sinon)
 *
 * Routes :
 *   GET  /api/ai             { enabled, provider, model }
 *   GET  /api/ai?models=1    liste des modèles (aide au réglage ; jamais la clé)
 *   POST /api/ai             { task: 'segments', sheets, duration } ou { task: 'labels', segments }
 */
interface Req { method?: string; body?: unknown; query?: Record<string, string | string[] | undefined> }
interface Res { status(code: number): Res; json(body: unknown): void }

const env = (k: string) => (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env[k]
const firstEnv = (names: string[]) => names.map(env).find((v) => v && v.trim())?.trim()

const KEY_NAMES = ['XAI_API_KEY', 'GROCK_API', 'GROK_API', 'GROQ_API', 'GROQ_API_KEY', 'GROCK_API_KEY', 'GROK_API_KEY']
const MODEL_NAMES = ['XAI_MODEL', 'AI_MODEL', 'GROCK_MODEL', 'GROK_MODEL', 'GROQ_MODEL']

const MAX_SHEETS = 5 // prudence : certains services limitent le nombre d'images par requête
const MAX_IMAGE_CHARS = 1_500_000
const CUE_MAX = 80

const key = () => firstEnv(KEY_NAMES)
function provider(k: string): { name: string; base: string } {
  const custom = firstEnv(['AI_BASE_URL', 'XAI_BASE_URL'])
  if (custom) return { name: 'personnalisé', base: custom.replace(/\/+$/, '') }
  if (k.startsWith('xai-')) return { name: 'xAI', base: 'https://api.x.ai/v1' }
  return { name: 'Groq', base: 'https://api.groq.com/openai/v1' }
}

/** Modèles de vision, du plus léger au plus lourd, d'après leur nom. */
export function pickVisionModel(ids: string[]): string | null {
  const order = [/scout/i, /vision/i, /maverick/i]
  for (const re of order) {
    const hit = ids.find((id) => re.test(id) && !/guard|whisper|tts/i.test(id))
    if (hit) return hit
  }
  return null
}

let discovered: string | null | undefined
async function listModels(k: string, base: string): Promise<{ ok: true; ids: string[] } | { ok: false; status: number }> {
  try {
    const r = await fetch(`${base}/models`, { headers: { authorization: `Bearer ${k}` } })
    if (!r.ok) return { ok: false, status: r.status }
    const j = (await r.json()) as { data?: { id?: string }[] }
    return { ok: true, ids: (j.data ?? []).map((m) => m.id ?? '').filter(Boolean) }
  } catch {
    return { ok: false, status: 0 }
  }
}
async function model(k: string, base: string): Promise<string | null> {
  const set = firstEnv(MODEL_NAMES)
  if (set) return set
  if (discovered !== undefined) return discovered
  const l = await listModels(k, base)
  if (!l.ok) return null // pas mémorisé : on réessaiera
  discovered = pickVisionModel(l.ids)
  return discovered
}

type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
const jpeg = (b64: string): Part => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } })
const b64ok = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= MAX_IMAGE_CHARS && /^[A-Za-z0-9+/=]+$/.test(s)

async function ask(k: string, base: string, mdl: string, content: Part[], maxTokens: number): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${k}` },
      body: JSON.stringify({ model: mdl, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: 'user', content }] }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } | string }
      const msg = typeof j.error === 'string' ? j.error : j.error?.message
      return { ok: false, error: `Le service d'IA a refusé la demande (code ${r.status})${msg ? ` : ${msg.slice(0, 200)}` : ''}.` }
    }
    const data = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    return { ok: true, text: data.choices?.[0]?.message?.content ?? '' }
  } catch {
    return { ok: false, error: "Le service d'IA est injoignable." }
  }
}

export interface Found { start: number; end: number; name: string; cue: string }
export interface Label { id: string; name: string; cue: string }

export function parseFound(text: string, duration: number): Found[] {
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) return []
  try {
    const arr = JSON.parse(m[0]) as Partial<Found>[]
    return arr
      .filter((x) => typeof x.start === 'number' && typeof x.end === 'number' && typeof x.name === 'string' && Number.isFinite(x.start) && Number.isFinite(x.end))
      .map((x) => ({ start: Math.max(0, x.start!), end: Math.min(duration, x.end!), name: x.name!.trim().slice(0, 60), cue: String(x.cue ?? '').trim().slice(0, CUE_MAX) }))
      .filter((x) => x.end - x.start >= 1 && x.name)
  } catch {
    return []
  }
}

export function parseLabels(text: string, ids: string[]): Label[] {
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) return []
  try {
    const arr = JSON.parse(m[0]) as Partial<Label>[]
    return arr
      .filter((x): x is Label => typeof x.id === 'string' && ids.includes(x.id) && typeof x.name === 'string')
      .map((x) => ({ id: x.id, name: x.name.trim().slice(0, 60), cue: String(x.cue ?? '').trim().slice(0, CUE_MAX) }))
  } catch {
    return []
  }
}

interface Sheet { image: string; times: number[] }

function parseSegmentsBody(b: unknown): { sheets: Sheet[]; duration: number } | null {
  const o = b as { sheets?: unknown; duration?: unknown } | null
  const duration = Number(o?.duration)
  if (!Number.isFinite(duration) || duration <= 0 || duration > 4 * 3600) return null
  if (!Array.isArray(o?.sheets) || o.sheets.length < 1 || o.sheets.length > MAX_SHEETS) return null
  const sheets: Sheet[] = []
  for (const s of o.sheets as Partial<Sheet>[]) {
    if (!b64ok(s.image) || !Array.isArray(s.times) || s.times.length < 1 || s.times.length > 16) return null
    if (s.times.some((t) => typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > duration + 1)) return null
    sheets.push({ image: s.image, times: s.times })
  }
  return { sheets, duration }
}

function parseLabelsBody(b: unknown): { id: string; image: string }[] | null {
  const segs = (b as { segments?: unknown } | null)?.segments
  if (!Array.isArray(segs) || segs.length < 1 || segs.length > MAX_SHEETS) return null
  const out: { id: string; image: string }[] = []
  for (const s of segs as { id?: unknown; image?: unknown }[]) {
    if (typeof s.id !== 'string' || s.id.length > 80 || !b64ok(s.image)) return null
    out.push({ id: s.id, image: s.image })
  }
  return out
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const k = key()
  if (req.method === 'GET') {
    if (!k) return res.status(200).json({ enabled: false, hasKey: false })
    const p = provider(k)
    if (req.query?.models) {
      const l = await listModels(k, p.base)
      return l.ok
        ? res.status(200).json({ provider: p.name, models: l.ids, chosen: firstEnv(MODEL_NAMES) ?? pickVisionModel(l.ids) })
        : res.status(502).json({ provider: p.name, error: `Le service a refusé la demande (code ${l.status}). La clé correspond-elle bien à ${p.name} ?` })
    }
    const m = await model(k, p.base)
    return res.status(200).json({ enabled: Boolean(m), hasKey: true, provider: p.name, model: m })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
  if (!k) return res.status(503).json({ error: "L'IA n'est pas activée (aucune clé)." })
  const p = provider(k)
  const mdl = await model(k, p.base)
  if (!mdl) return res.status(503).json({ error: `Aucun modèle de vision trouvé chez ${p.name}. Renseigne XAI_MODEL.` })

  const task = (req.body as { task?: unknown } | null)?.task
  if (task === 'segments') {
    const body = parseSegmentsBody(req.body)
    if (!body) return res.status(400).json({ error: 'Requête invalide.' })
    const content: Part[] = [{
      type: 'text',
      text:
        `Voici ${body.sheets.length} planche(s) d'images extraites d'une vidéo d'exercices d'étirements ou de posture qui dure ${Math.round(body.duration)} secondes. ` +
        "Chaque planche est une grille d'images lues de gauche à droite puis de haut en bas ; l'instant de chaque image (en secondes) est écrit dessus et rappelé dans la liste. " +
        "Repère chaque exercice distinct, dans l'ordre. Ignore l'introduction, la conclusion et les moments sans exercice. " +
        "Pour chacun : début et fin en secondes (sans chevauchement), nom court en français (40 caractères au plus) et consigne de 80 caractères au plus. " +
        'Réponds uniquement par un tableau JSON : [{"start":0,"end":30,"name":"…","cue":"…"}].',
    }]
    body.sheets.forEach((s, i) => {
      content.push({ type: 'text', text: `Planche ${i + 1}, instants : ${s.times.map((t) => Math.round(t)).join(', ')} s.` })
      content.push(jpeg(s.image))
    })
    const r = await ask(k, p.base, mdl, content, 3000)
    return r.ok ? res.status(200).json({ exercises: parseFound(r.text, body.duration) }) : res.status(502).json({ error: r.error })
  }
  if (task === 'labels') {
    const segs = parseLabelsBody(req.body)
    if (!segs) return res.status(400).json({ error: 'Requête invalide.' })
    const content: Part[] = [{
      type: 'text',
      text:
        "Voici des bandes d'images, une par segment d'une vidéo d'étirements ou de posture (trois moments du segment côte à côte). Pour chaque segment, donne un nom d'exercice court en français " +
        `et une consigne de ${CUE_MAX} caractères au plus. Réponds uniquement par un tableau JSON : [{"id":"…","name":"…","cue":"…"}].`,
    }]
    for (const s of segs) { content.push({ type: 'text', text: `Segment ${s.id} :` }); content.push(jpeg(s.image)) }
    const r = await ask(k, p.base, mdl, content, 1500)
    return r.ok ? res.status(200).json({ labels: parseLabels(r.text, segs.map((s) => s.id)) }) : res.status(502).json({ error: r.error })
  }
  return res.status(400).json({ error: 'Requête invalide.' })
}
