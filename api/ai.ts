/**
 * IA (optionnelle) : découpe d'une vidéo et nommage des exercices, avec un modèle de vision.
 * Un seul fichier, sans import : une fonction Vercel qui en importe une autre peut casser selon le format de module.
 *
 * Service : Gemini (Google), Groq ou xAI (Grok), tous au format « chat completions » avec images.
 * Variables d'environnement Vercel (jamais de clé dans le code) :
 *   GEMINI_API_KEY                              clé Google AI Studio (« AIza… »), prioritaire si elle existe
 *   XAI_API_KEY ou GROCK_API ou GROQ_API_KEY …  clé Groq (« gsk_… ») ou xAI (« xai-… »)
 *   GEMINI_MODEL / XAI_MODEL (ou GROQ_MODEL…)   facultatif : sinon le modèle de vision est choisi dans la liste du service
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

const GEMINI_KEY_NAMES = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_AI_KEY']
const KEY_NAMES = ['XAI_API_KEY', 'GROCK_API', 'GROK_API', 'GROQ_API', 'GROQ_API_KEY', 'GROCK_API_KEY', 'GROK_API_KEY']
const MODEL_NAMES = ['XAI_MODEL', 'AI_MODEL', 'GROCK_MODEL', 'GROK_MODEL', 'GROQ_MODEL']

const MAX_SHEETS = 5 // prudence : certains services limitent le nombre d'images par requête
const MAX_IMAGE_CHARS = 1_500_000
const CUE_MAX = 80

/** Clé à utiliser : Gemini d'abord (meilleur pour les images), sauf si AI_PROVIDER vaut « groq ». */
const key = () => (env('AI_PROVIDER')?.toLowerCase() === 'groq' ? undefined : firstEnv(GEMINI_KEY_NAMES)) ?? firstEnv(KEY_NAMES)
const isGemini = (k: string) => k.startsWith('AIza')
function provider(k: string): { name: string; base: string } {
  const custom = firstEnv(['AI_BASE_URL', 'XAI_BASE_URL'])
  if (custom) return { name: 'personnalisé', base: custom.replace(/\/+$/, '') }
  if (isGemini(k)) return { name: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai' }
  if (k.startsWith('xai-')) return { name: 'xAI', base: 'https://api.x.ai/v1' }
  return { name: 'Groq', base: 'https://api.groq.com/openai/v1' }
}

/** Modèles de vision, du plus léger au plus lourd, d'après leur nom. */
export function pickVisionModel(ids: string[]): string | null {
  const order = [/scout/i, /vision/i, /maverick/i, /llama-4/i, /pixtral/i, /[-_]vl[-_\d]/i]
  for (const re of order) {
    const hit = ids.find((id) => re.test(id) && !/guard|whisper|tts/i.test(id))
    if (hit) return hit
  }
  return null
}

/** Gemini : le plus récent modèle « flash » (pas « lite », ni image, voix, direct…). */
export function pickGeminiModel(ids: string[]): string | null {
  const names = ids.map((i) => i.replace(/^models\//, ''))
  const ok = names.filter((n) => /gemini/i.test(n) && /flash/i.test(n) && !/lite|image|tts|live|audio|embedding|exp|thinking|preview/i.test(n))
  ok.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  return ok[0] ?? names.filter((n) => /gemini.*flash/i.test(n)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] ?? null
}

const discovered: Record<string, string | null> = {}
/** Résultat à champs facultatifs (pas d'union) : se compile aussi avec les réglages moins stricts de Vercel. */
interface ModelList { ok: boolean; ids: string[]; status: number }
async function listModels(k: string, base: string): Promise<ModelList> {
  try {
    const r = await fetch(`${base}/models`, { headers: { authorization: `Bearer ${k}` } })
    if (!r.ok) return { ok: false, ids: [], status: r.status }
    const j = (await r.json()) as { data?: { id?: string }[] }
    return { ok: true, ids: (j.data ?? []).map((m) => m.id ?? '').filter(Boolean), status: 200 }
  } catch {
    return { ok: false, ids: [], status: 0 }
  }
}
async function model(k: string, base: string): Promise<string | null> {
  const set = isGemini(k) ? firstEnv(['GEMINI_MODEL']) : firstEnv(MODEL_NAMES)
  if (set) return set
  if (base in discovered) return discovered[base] ?? null
  const l = await listModels(k, base)
  if (!l.ok) return null // pas mémorisé : on réessaiera
  discovered[base] = isGemini(k) ? pickGeminiModel(l.ids) : pickVisionModel(l.ids)
  return discovered[base] ?? null
}

type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
const jpeg = (b64: string): Part => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } })
const b64ok = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= MAX_IMAGE_CHARS && /^[A-Za-z0-9+/=]+$/.test(s)

interface Answer { ok: boolean; text: string; error: string; finish: string }
async function ask(k: string, base: string, mdl: string, content: Part[], maxTokens: number): Promise<Answer> {
  const call = (extra: Record<string, unknown>) => fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${k}` },
    body: JSON.stringify({ model: mdl, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: 'user', content }], ...extra }),
  })
  try {
    // Les modèles qui « réfléchissent » peuvent épuiser leur réponse en raisonnement : on essaie d'abord sans raisonnement,
    // puis sans ce réglage si le modèle ne le connaît pas.
    let r = base.includes('generativelanguage') ? await call({}) : await call({ reasoning_effort: 'none' })
    if (r.status === 400 && !base.includes('generativelanguage')) r = await call({})
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } | string }
      const msg = typeof j.error === 'string' ? j.error : j.error?.message
      return { ok: false, text: '', finish: '', error: `Le service d'IA a refusé la demande (code ${r.status})${msg ? ` : ${msg.slice(0, 200)}` : ''}.` }
    }
    const data = (await r.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] }
    return { ok: true, text: data.choices?.[0]?.message?.content ?? '', finish: data.choices?.[0]?.finish_reason ?? '', error: '' }
  } catch {
    return { ok: false, text: '', finish: '', error: "Le service d'IA est injoignable." }
  }
}

/** Explication quand rien d'exploitable n'est revenu : réponse tronquée, ou début de ce que le modèle a répondu. */
export function whyEmpty(r: { text: string; finish: string }): string {
  if (r.finish === 'length') return 'La réponse a été coupée : le modèle a trop réfléchi avant de répondre.'
  const t = answerOf(r.text).replace(/\s+/g, ' ').trim()
  return t ? `Réponse du modèle : « ${t.slice(0, 300)} »` : 'Le modèle n\'a rien répondu.'
}

export interface Found { start: number; end: number; name: string; cue: string }
export interface Label { id: string; name: string; cue: string }

/** Certains modèles écrivent leur raisonnement entre <think> et </think> avant la réponse : on l'ignore. */
const answerOf = (text: string) => text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '')

export function parseFound(rawText: string, duration: number): Found[] {
  const text = answerOf(rawText)
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

/**
 * Réponse « une étiquette par image » : { "frames": [0,0,1,1,2…], "exercises": [{ "id": 1, "name": "…", "cue": "…" }] }.
 * Même numéro tant que c'est le même exercice, 0 pour l'introduction, les textes et la fin. Les limites tombent à mi-chemin
 * entre deux images voisines d'exercices différents. Un numéro isolé entre deux images identiques est du bruit.
 */
export function exercisesFromFrames(rawText: string, times: number[], duration: number): Found[] {
  const m = answerOf(rawText).match(/\{[\s\S]*\}/)
  if (!m) return []
  let o: { frames?: unknown; exercises?: { id?: unknown; name?: unknown; cue?: unknown }[] }
  try { o = JSON.parse(m[0]) } catch { return [] }
  if (!Array.isArray(o.frames) || o.frames.length !== times.length) return []
  const f = (o.frames as unknown[]).map((v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0))
  for (let i = 1; i < f.length - 1; i++) if (f[i] !== f[i - 1] && f[i - 1] === f[i + 1]) f[i] = f[i - 1]!
  const names = new Map<number, { name: string; cue: string }>()
  for (const e of Array.isArray(o.exercises) ? o.exercises : []) {
    if (typeof e.id === 'number' && typeof e.name === 'string') names.set(Math.round(e.id), { name: e.name.trim().slice(0, 60), cue: String(e.cue ?? '').trim().slice(0, CUE_MAX) })
  }
  const out: Found[] = []
  let i = 0
  while (i < f.length) {
    if (f[i] === 0) { i++; continue }
    let j = i
    while (j + 1 < f.length && f[j + 1] === f[i]) j++
    const start = i === 0 ? 0 : (times[i - 1]! + times[i]!) / 2
    const end = j === f.length - 1 ? duration : (times[j]! + times[j + 1]!) / 2
    if (end - start >= 1) {
      const n = names.get(f[i]!)
      out.push({ start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10, name: n?.name || `Exercice ${out.length + 1}`, cue: n?.cue ?? '' })
    }
    i = j + 1
  }
  return out
}

export function parseLabels(rawText: string, ids: string[]): Label[] {
  const text = answerOf(rawText)
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
const MAX_TIMES_PER_SHEET = 25

function parseSegmentsBody(b: unknown): { sheets: Sheet[]; duration: number; cuts: number[] } | null {
  const o = b as { sheets?: unknown; duration?: unknown; cuts?: unknown } | null
  const duration = Number(o?.duration)
  if (!Number.isFinite(duration) || duration <= 0 || duration > 4 * 3600) return null
  if (!Array.isArray(o?.sheets) || o.sheets.length < 1 || o.sheets.length > MAX_SHEETS) return null
  const sheets: Sheet[] = []
  for (const s of o.sheets as Partial<Sheet>[]) {
    if (!b64ok(s.image) || !Array.isArray(s.times) || s.times.length < 1 || s.times.length > MAX_TIMES_PER_SHEET) return null
    if (s.times.some((t) => typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > duration + 1)) return null
    sheets.push({ image: s.image, times: s.times })
  }
  const cuts = Array.isArray(o?.cuts) ? (o.cuts as unknown[]).filter((c): c is number => typeof c === 'number' && Number.isFinite(c) && c >= 0 && c <= duration).slice(0, 200).map((c) => Math.round(c * 10) / 10) : []
  return { sheets, duration, cuts }
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
        ? res.status(200).json({ provider: p.name, models: l.ids, chosen: isGemini(k) ? (firstEnv(['GEMINI_MODEL']) ?? pickGeminiModel(l.ids)) : (firstEnv(MODEL_NAMES) ?? pickVisionModel(l.ids)) })
        : res.status(502).json({ provider: p.name, error: `Le service a refusé la demande (code ${l.status}). La clé correspond-elle bien à ${p.name} ?` })
    }
    const m = await model(k, p.base)
    if (m) return res.status(200).json({ enabled: true, hasKey: true, provider: p.name, model: m })
    // Pas de modèle : dire pourquoi (liste refusée, ou aucun nom de vision reconnu).
    const l = await listModels(k, p.base)
    const reason = l.ok ? `Aucun modèle de vision reconnu parmi ${l.ids.length} modèles. Ouvre /api/ai?models=1 et choisis-en un pour GEMINI_MODEL ou XAI_MODEL.` : `Liste des modèles refusée (code ${l.status}) : vérifie la clé.`
    return res.status(200).json({ enabled: false, hasKey: true, provider: p.name, model: null, reason })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
  if (!k) return res.status(503).json({ error: "L'IA n'est pas activée (aucune clé)." })
  const p = provider(k)
  const mdl = await model(k, p.base)
  if (!mdl) return res.status(503).json({ error: `Aucun modèle de vision trouvé chez ${p.name}. Renseigne GEMINI_MODEL ou XAI_MODEL.` })

  const task = (req.body as { task?: unknown } | null)?.task
  if (task === 'segments') {
    const body = parseSegmentsBody(req.body)
    if (!body) return res.status(400).json({ error: 'Requête invalide.' })
    const times = body.sheets.flatMap((x) => x.times)
    const step = Math.round((body.duration / Math.max(1, times.length)) * 10) / 10
    const cutsText = body.cuts.length
      ? `Changements d'image détectés automatiquement (en secondes) : ${body.cuts.join(', ')}. Un exercice commence souvent à l'un de ces instants. `
      : ''
    const content: Part[] = [{
      type: 'text',
      text:
        `Voici ${body.sheets.length} planche(s) d'images extraites d'une vidéo d'exercices (étirements, mobilité, posture, sport) de ${Math.round(body.duration)} secondes : ${times.length} images en tout, une toutes les ${step} s environ. ` +
        "Chaque planche est une grille lue de gauche à droite puis de haut en bas ; l'instant de chaque image est écrit dessus et rappelé dans la liste. " +
        "Les exercices s'enchaînent souvent sans coupure, dans un même décor, avec parfois une indication à l'écran (durée ou nombre de répétitions) : un exercice dure souvent 3 à 30 secondes. " +
        cutsText +
        `Pour CHAQUE image, dans l'ordre, donne le numéro de l'exercice montré : le même numéro tant que la posture ou le mouvement répété est le même, un nouveau numéro (1, 2, 3…) dès qu'il change, même après peu de secondes. ` +
        "Mets 0 pour l'introduction, les écrans de texte, les transitions et la fin. " +
        `Puis nomme chaque exercice : nom court en français (40 caractères au plus) et consigne de 80 caractères au plus. ` +
        `Réponds uniquement par un objet JSON avec exactement ${times.length} numéros dans "frames" : {"frames":[0,0,1,1,2],"exercises":[{"id":1,"name":"…","cue":"…"}]}.`,
    }]
    body.sheets.forEach((s, i) => {
      content.push({ type: 'text', text: `Planche ${i + 1}, instants : ${s.times.map((t) => Math.round(t)).join(', ')} s.` })
      content.push(jpeg(s.image))
    })
    const r = await ask(k, p.base, mdl, content, 8000)
    if (!r.ok) return res.status(502).json({ error: r.error })
    const byFrame = exercisesFromFrames(r.text, times, body.duration)
    const exercises = byFrame.length ? byFrame : parseFound(r.text, body.duration)
    return res.status(200).json({ exercises, note: exercises.length ? undefined : whyEmpty(r) })
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
    const r = await ask(k, p.base, mdl, content, 4000)
    return r.ok ? res.status(200).json({ labels: parseLabels(r.text, segs.map((s) => s.id)) }) : res.status(502).json({ error: r.error })
  }
  return res.status(400).json({ error: 'Requête invalide.' })
}
