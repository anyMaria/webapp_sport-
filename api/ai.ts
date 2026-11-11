/**
 * IA (optionnelle) : repérage des exercices d'une vidéo et nommage, avec un modèle de vision.
 * Un seul fichier, sans import : une fonction Vercel qui en importe une autre peut casser selon le format de module.
 *
 * Service : Groq ou xAI (Grok) d'abord, Gemini (Google) seulement s'il n'y a pas d'autre clé. Tous au format « chat completions » avec images.
 * Variables d'environnement Vercel (jamais de clé dans le code) :
 *   XAI_API_KEY ou GROCK_API ou GROQ_API_KEY …  clé Groq (« gsk_… ») ou xAI (« xai-… »)
 *   GEMINI_API_KEY                              clé Google AI Studio (« AIza… »), utilisée s'il n'y a pas d'autre clé ou si AI_PROVIDER vaut « gemini »
 *   XAI_MODEL (ou GROQ_MODEL…) / GEMINI_MODEL   facultatif : sinon le modèle de vision est choisi dans la liste du service
 *   AI_BASE_URL                                 facultatif : adresse du service (déduite de la clé sinon)
 *
 * Routes :
 *   GET  /api/ai             { enabled, provider, model }
 *   GET  /api/ai?models=1    liste des modèles (aide au réglage ; jamais la clé)
 *   POST /api/ai             { task: 'marks', image, count, stepSec, prev } : une planche d'images, une étiquette par image
 *                            { task: 'labels', segments } : un nom par segment
 */
interface Req { method?: string; body?: unknown; query?: Record<string, string | string[] | undefined> }
interface Res { status(code: number): Res; json(body: unknown): void }

const env = (k: string) => (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env[k]
const firstEnv = (names: string[]) => names.map(env).find((v) => v && v.trim())?.trim()

const GEMINI_KEY_NAMES = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_AI_KEY']
const KEY_NAMES = ['XAI_API_KEY', 'GROCK_API', 'GROK_API', 'GROQ_API', 'GROQ_API_KEY', 'GROCK_API_KEY', 'GROK_API_KEY']
const MODEL_NAMES = ['XAI_MODEL', 'AI_MODEL', 'GROCK_MODEL', 'GROK_MODEL', 'GROQ_MODEL']

const MAX_STRIPS = 5 // certains services limitent le nombre d'images par requête
const MAX_IMAGE_CHARS = 1_500_000
const MAX_PER_SHEET = 25
const CUE_MAX = 80
const MAX_CANDIDATES = 3

/** Clé à utiliser : Groq ou xAI d'abord ; Gemini s'il n'y a que lui, ou si AI_PROVIDER vaut « gemini ». */
function key(): string | undefined {
  const gemini = firstEnv(GEMINI_KEY_NAMES)
  const other = firstEnv(KEY_NAMES)
  return env('AI_PROVIDER')?.toLowerCase() === 'gemini' ? (gemini ?? other) : (other ?? gemini)
}
const isGemini = (k: string) => k.startsWith('AIza')
function provider(k: string): { name: string; base: string } {
  const custom = firstEnv(['AI_BASE_URL', 'XAI_BASE_URL'])
  if (custom) return { name: 'personnalisé', base: custom.replace(/\/+$/, '') }
  if (isGemini(k)) return { name: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai' }
  if (k.startsWith('xai-')) return { name: 'xAI', base: 'https://api.x.ai/v1' }
  return { name: 'Groq', base: 'https://api.groq.com/openai/v1' }
}

const NOT_VISION = /guard|whisper|tts|embed|image-gen|imagine|code|audio|speech/i
const byOrder = (ids: string[], order: RegExp[]) => {
  const out: string[] = []
  for (const re of order) for (const id of ids) if (re.test(id) && !NOT_VISION.test(id) && !out.includes(id)) out.push(id)
  return out
}

/** Groq : modèles de vision, du plus léger au plus lourd, d'après leur nom. */
export function visionCandidates(ids: string[]): string[] {
  return byOrder(ids, [/scout/i, /vision/i, /maverick/i, /llama-4/i, /pixtral/i, /[-_]vl[-_\d]/i])
}
export const pickVisionModel = (ids: string[]): string | null => visionCandidates(ids)[0] ?? null

/** xAI : un modèle « vision » s'il y en a, sinon les Grok récents, les plus rapides d'abord. */
export function grokCandidates(ids: string[]): string[] {
  const recent = [...ids].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  return byOrder(recent, [/vision/i, /grok-[4-9].*fast.*non-reasoning/i, /grok-[4-9].*fast/i, /grok-[4-9]/i])
}

/** Gemini : le plus récent modèle « flash » (pas « lite », ni image, voix, direct…). */
export function pickGeminiModel(ids: string[]): string | null {
  const names = ids.map((i) => i.replace(/^models\//, ''))
  const ok = names.filter((n) => /gemini/i.test(n) && /flash/i.test(n) && !/lite|image|tts|live|audio|embedding|exp|thinking|preview/i.test(n))
  ok.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  return ok[0] ?? names.filter((n) => /gemini.*flash/i.test(n)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] ?? null
}

export function candidatesFor(providerName: string, ids: string[]): string[] {
  if (providerName === 'Gemini') { const g = pickGeminiModel(ids); return g ? [g] : [] }
  const list = providerName === 'xAI' ? grokCandidates(ids) : visionCandidates(ids)
  return (list.length ? list : providerName === 'xAI' ? [] : grokCandidates(ids)).slice(0, MAX_CANDIDATES)
}

/** Mémoire de la fonction tant qu'elle reste « chaude » : modèles possibles, et ce qui a marché la dernière fois. */
const discovered: Record<string, string[]> = {}
const goodModel: Record<string, number> = {}
const goodVariant: Record<string, number> = {}

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
async function models(k: string, p: { name: string; base: string }): Promise<string[]> {
  const set = isGemini(k) ? firstEnv(['GEMINI_MODEL']) : firstEnv(MODEL_NAMES)
  if (set) return [set]
  const known = discovered[p.base]
  if (known) return known
  const l = await listModels(k, p.base)
  if (!l.ok) return [] // pas mémorisé : on réessaiera
  return (discovered[p.base] = candidatesFor(p.name, l.ids))
}

type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
const jpeg = (b64: string): Part => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } })
const b64ok = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= MAX_IMAGE_CHARS && /^[A-Za-z0-9+/=]+$/.test(s)

interface Answer { ok: boolean; status: number; text: string; error: string; finish: string; retryAfter: number; model: string }

/** Réglages essayés dans l'ordre : réponse en JSON garanti quand le service le permet, sans « raisonnement » pour les modèles qui réfléchissent. */
export function variantsFor(mdl: string): Record<string, unknown>[] {
  const json = { response_format: { type: 'json_object' } }
  return /qwen|think|reason/i.test(mdl) ? [{ ...json, reasoning_effort: 'none' }, json, {}] : [json, {}]
}

/** Délai conseillé par le service quand il est saturé (en-tête « retry-after », ou « try again in 7.6s » dans le message). */
export function retryDelay(header: string | null, msg: string): number {
  const h = Number(header)
  if (header && Number.isFinite(h) && h > 0) return Math.min(60, Math.ceil(h))
  const m = /try again in\s+(?:(\d+)m)?\s*([\d.]+)\s*(ms|s)/i.exec(msg)
  if (!m) return 10
  const sec = Number(m[1] ?? 0) * 60 + (m[3] === 'ms' ? Number(m[2]) / 1000 : Number(m[2]))
  return Math.min(60, Math.max(1, Math.ceil(sec)))
}

const refusal = (status: number, msg: string) => {
  if (status === 401 || status === 403) return `Le service d'IA refuse la clé (code ${status}). Vérifie-la dans les réglages de Vercel.`
  if (status === 413) return 'Les images sont trop lourdes pour le service d\'IA.'
  if (status === 429) return 'Le service d\'IA est très demandé en ce moment.'
  return `Le service d'IA a refusé la demande (code ${status})${msg ? ` : ${msg.slice(0, 200)}` : ''}.`
}

/**
 * Pose la question au premier modèle qui l'accepte. Un refus sur un réglage (JSON, raisonnement) fait essayer le réglage suivant ;
 * un refus sur le modèle (introuvable, sans images) fait essayer le modèle suivant. Ce qui a marché est retenu pour les demandes suivantes.
 */
async function ask(k: string, base: string, mdls: string[], content: Part[], maxTokens: number): Promise<Answer> {
  let last: Answer = { ok: false, status: 0, text: '', finish: '', retryAfter: 0, model: '', error: "Le service d'IA est injoignable." }
  for (let mi = Math.min(goodModel[base] ?? 0, mdls.length - 1); mi < mdls.length; mi++) {
    const mdl = mdls[mi]!
    const variants = variantsFor(mdl)
    let nextModel = false
    let accident = false
    for (let vi = Math.min(goodVariant[mdl] ?? 0, variants.length - 1); vi < variants.length; vi++) {
      let r: Response
      try {
        r = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${k}` },
          body: JSON.stringify({ model: mdl, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: 'user', content }], ...variants[vi] }),
        })
      } catch {
        return last
      }
      if (r.ok) {
        goodModel[base] = mi
        if (!accident) goodVariant[mdl] = vi
        const data = (await r.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] }
        return { ok: true, status: 200, text: data.choices?.[0]?.message?.content ?? '', finish: data.choices?.[0]?.finish_reason ?? '', retryAfter: 0, model: mdl, error: '' }
      }
      const j = (await r.json().catch(() => ({}))) as { error?: { message?: string; code?: string } | string }
      const msg = (typeof j.error === 'string' ? j.error : `${j.error?.code ?? ''} ${j.error?.message ?? ''}`).trim()
      last = { ok: false, status: r.status, text: '', finish: '', model: mdl, retryAfter: r.status === 429 ? retryDelay(r.headers.get('retry-after'), msg) : 0, error: refusal(r.status, msg) }
      if (r.status === 404 || (r.status === 400 && /model|image|vision|multimodal|decommission/i.test(msg) && !/response_format|reasoning|json/i.test(msg))) { nextModel = true; break }
      if (r.status !== 400) return last
      // 400 sur un réglage : on essaie le suivant. Un JSON mal formé par le modèle est un accident, pas un réglage à abandonner.
      if (/json_validate|failed_generation/i.test(msg)) accident = true
      else goodVariant[mdl] = Math.min(vi + 1, variants.length - 1)
    }
    if (!nextModel) return last
  }
  return last
}

/** Certains modèles écrivent leur raisonnement entre <think> et </think> avant la réponse : on l'ignore. */
const answerOf = (text: string) => text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '')

/** Explication quand rien d'exploitable n'est revenu : réponse tronquée, ou début de ce que le modèle a répondu. */
export function whyEmpty(r: { text: string; finish: string }): string {
  if (r.finish === 'length') return 'La réponse a été coupée : le modèle a trop réfléchi avant de répondre.'
  const t = answerOf(r.text).replace(/\s+/g, ' ').trim()
  return t ? `Réponse du modèle : « ${t.slice(0, 300)} »` : 'Le modèle n\'a rien répondu.'
}

export interface Label { id: string; name: string; cue: string }
export interface MarkName { ex: number; name: string; cue: string }
export interface Marks { labels: number[]; names: MarkName[] }

const jsonObject = (rawText: string): Record<string, unknown> | null => {
  const m = answerOf(rawText).match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const o = JSON.parse(m[0]) as unknown
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Réponse « une étiquette par image » : {"images":[{"n":1,"ex":0},{"n":2,"ex":1}…],"exercices":[{"ex":1,"name":"…","cue":"…"}]}.
 * Tolérante : accepte aussi une simple liste de numéros, des étiquettes en lettres, une image oubliée (elle reprend l'étiquette d'avant).
 * Renvoie null si moins de la moitié des images ont une étiquette.
 */
export function parseMarks(rawText: string, count: number): Marks | null {
  const o = jsonObject(rawText)
  if (!o) return null
  const list = [o.images, o.frames, o.image].find(Array.isArray) as unknown[] | undefined
  if (!list) return null
  const ids = new Map<string, number>()
  const idOf = (v: unknown): number => {
    if (v === null || v === undefined) return 0
    const s = String(v).trim().toLowerCase()
    if (!s || /^(0|none|null|aucun|aucune|non|-)$/.test(s)) return 0
    if (!ids.has(s)) ids.set(s, ids.size + 1)
    return ids.get(s)!
  }
  const raw: (number | undefined)[] = new Array<number | undefined>(count).fill(undefined)
  let given = 0
  list.forEach((item, i) => {
    const isObj = item !== null && typeof item === 'object'
    const e = (isObj ? item : {}) as { n?: unknown; ex?: unknown; exercice?: unknown; exercise?: unknown; id?: unknown }
    const n = isObj && Number.isFinite(Number(e.n)) ? Math.round(Number(e.n)) : i + 1
    if (n < 1 || n > count || raw[n - 1] !== undefined) return
    raw[n - 1] = idOf(isObj ? (e.ex ?? e.exercice ?? e.exercise ?? e.id) : item)
    given++
  })
  if (given < count / 2) return null
  const labels: number[] = []
  for (let i = 0; i < count; i++) labels.push(raw[i] ?? labels[i - 1] ?? 0)
  const names: MarkName[] = []
  const add = (exKey: unknown, v: { name?: unknown; nom?: unknown; cue?: unknown; consigne?: unknown } | null) => {
    const ex = ids.get(String(exKey).trim().toLowerCase())
    const name = String(v?.name ?? v?.nom ?? '').trim().slice(0, 60)
    if (ex && name && !names.some((x) => x.ex === ex)) names.push({ ex, name, cue: String(v?.cue ?? v?.consigne ?? '').trim().slice(0, CUE_MAX) })
  }
  const ex = o.exercices ?? o.exercises ?? o.exercice
  if (Array.isArray(ex)) for (const e of ex as { ex?: unknown; id?: unknown }[]) add(e?.ex ?? e?.id, e as { name?: unknown })
  else if (ex && typeof ex === 'object') for (const [id, v] of Object.entries(ex as Record<string, unknown>)) add(id, typeof v === 'string' ? { name: v } : (v as { name?: unknown }))
  return { labels, names }
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

interface MarksBody { image: string; count: number; stepSec: number; prev: string }
function parseMarksBody(b: unknown): MarksBody | null {
  const o = b as { image?: unknown; count?: unknown; stepSec?: unknown; prev?: unknown } | null
  const count = Number(o?.count)
  const stepSec = Number(o?.stepSec)
  if (!b64ok(o?.image) || !Number.isInteger(count) || count < 1 || count > MAX_PER_SHEET) return null
  if (!Number.isFinite(stepSec) || stepSec <= 0 || stepSec > 3600) return null
  return { image: o.image, count, stepSec, prev: typeof o?.prev === 'string' ? o.prev.replace(/[«»"\n\r]/g, ' ').trim().slice(0, 60) : '' }
}

export function marksPrompt(count: number, stepSec: number, prev: string): string {
  const step = String(Math.round(stepSec * 10) / 10).replace('.', ',')
  return (
    `Voici une planche de ${count} images extraites d'une vidéo d'exercices (étirements, mobilité, posture, sport). ` +
    `Les images se suivent dans le temps, de gauche à droite puis de haut en bas, une toutes les ${step} s environ. Chaque image porte son numéro, de 1 à ${count}, en haut à gauche. ` +
    (prev ? `Juste avant l'image 1, la vidéo montrait : « ${prev} ». Si l'image 1 montre encore la même chose, garde ce nom. ` : '') +
    "Pour chaque image, donne le numéro de l'exercice montré : le même numéro tant que la personne fait le même exercice (même posture, ou même mouvement répété), un nouveau numéro (1, 2, 3…) dès que l'exercice change, même s'il ne dure que quelques secondes. " +
    "Mets 0 quand l'image ne montre pas d'exercice : introduction, texte seul, personne qui parle ou se déplace, fin. " +
    `Puis donne à chaque exercice un nom court en français (40 caractères au plus) et une consigne (${CUE_MAX} caractères au plus). ` +
    `Réponds uniquement en JSON, avec exactement ${count} entrées dans "images", sous cette forme : ` +
    '{"images":[{"n":1,"ex":0},{"n":2,"ex":1},{"n":3,"ex":1}],"exercices":[{"ex":1,"name":"Chat-vache","cue":"Dos rond, puis dos creux"}]}'
  )
}

function parseLabelsBody(b: unknown): { id: string; image: string }[] | null {
  const segs = (b as { segments?: unknown } | null)?.segments
  if (!Array.isArray(segs) || segs.length < 1 || segs.length > MAX_STRIPS) return null
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
        ? res.status(200).json({ provider: p.name, models: l.ids, chosen: (isGemini(k) ? firstEnv(['GEMINI_MODEL']) : firstEnv(MODEL_NAMES)) ?? candidatesFor(p.name, l.ids)[0] ?? null, candidates: candidatesFor(p.name, l.ids) })
        : res.status(502).json({ provider: p.name, error: `Le service a refusé la demande (code ${l.status}). La clé correspond-elle bien à ${p.name} ?` })
    }
    const m = await models(k, p)
    if (m.length) return res.status(200).json({ enabled: true, hasKey: true, provider: p.name, model: m[Math.min(goodModel[p.base] ?? 0, m.length - 1)] })
    // Pas de modèle : dire pourquoi (liste refusée, ou aucun nom de vision reconnu).
    const l = await listModels(k, p.base)
    const reason = l.ok ? `Aucun modèle qui lit les images n'a été reconnu parmi les ${l.ids.length} modèles de ${p.name}. Ouvre /api/ai?models=1 et choisis-en un pour la variable XAI_MODEL.` : `${p.name} refuse la clé (code ${l.status}).`
    return res.status(200).json({ enabled: false, hasKey: true, provider: p.name, model: null, reason })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
  if (!k) return res.status(503).json({ error: "L'IA n'est pas activée (aucune clé)." })
  const p = provider(k)
  const mdls = await models(k, p)
  if (!mdls.length) return res.status(503).json({ error: `Aucun modèle qui lit les images n'a été trouvé chez ${p.name}. Renseigne la variable XAI_MODEL.` })
  const fail = (r: Answer) => res.status(r.status === 429 ? 429 : 502).json({ error: r.error, retryAfter: r.retryAfter || undefined })

  const task = (req.body as { task?: unknown } | null)?.task
  if (task === 'marks') {
    const body = parseMarksBody(req.body)
    if (!body) return res.status(400).json({ error: 'Requête invalide.' })
    const r = await ask(k, p.base, mdls, [{ type: 'text', text: marksPrompt(body.count, body.stepSec, body.prev) }, jpeg(body.image)], 3000)
    if (!r.ok) return fail(r)
    const marks = parseMarks(r.text, body.count)
    return res.status(200).json(marks ? { labels: marks.labels, names: marks.names } : { labels: null, note: whyEmpty(r) })
  }
  if (task === 'labels') {
    const segs = parseLabelsBody(req.body)
    if (!segs) return res.status(400).json({ error: 'Requête invalide.' })
    const content: Part[] = [{
      type: 'text',
      text:
        "Voici des bandes d'images, une par segment d'une vidéo d'étirements ou de posture (trois moments du segment côte à côte). Pour chaque segment, donne un nom d'exercice court en français " +
        `et une consigne de ${CUE_MAX} caractères au plus. Réponds uniquement en JSON, sous cette forme : {"labels":[{"id":"…","name":"…","cue":"…"}]}.`,
    }]
    for (const s of segs) { content.push({ type: 'text', text: `Segment ${s.id} :` }); content.push(jpeg(s.image)) }
    const r = await ask(k, p.base, mdls, content, 4000)
    return r.ok ? res.status(200).json({ labels: parseLabels(r.text, segs.map((s) => s.id)) }) : fail(r)
  }
  return res.status(400).json({ error: 'Requête invalide.' })
}
