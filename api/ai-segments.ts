import { askVision, jpegPart, listModels, xaiConfig, xaiKey, type Part } from './_xai'

/**
 * Découpe par IA (optionnelle). Reçoit des images réduites prises à intervalles réguliers dans une vidéo,
 * avec leur instant, et renvoie les exercices repérés : { start, end, name, cue }.
 * Service : Grok (xAI), voir _xai.ts. Sans clé ou sans modèle : { enabled: false }, le bouton n'apparaît pas.
 */
interface Req { method?: string; body?: unknown; query?: Record<string, string | string[] | undefined> }
interface Res { status(code: number): Res; json(body: unknown): void }

export const MAX_FRAMES = 60
const MAX_IMAGE_CHARS = 150_000
const CUE_MAX = 80

interface Frame { t: number; image: string }
export interface Found { start: number; end: number; name: string; cue: string }

function parseBody(b: unknown): { frames: Frame[]; duration: number } | null {
  const o = b as { frames?: unknown; duration?: unknown } | null
  const duration = Number(o?.duration)
  if (!Number.isFinite(duration) || duration <= 0 || duration > 4 * 3600) return null
  if (!Array.isArray(o?.frames) || o.frames.length < 2 || o.frames.length > MAX_FRAMES) return null
  const frames: Frame[] = []
  for (const f of o.frames as Partial<Frame>[]) {
    if (typeof f.t !== 'number' || !Number.isFinite(f.t) || f.t < 0 || f.t > duration + 1) return null
    if (typeof f.image !== 'string' || f.image.length === 0 || f.image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(f.image)) return null
    frames.push({ t: f.t, image: f.image })
  }
  return { frames, duration }
}

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

export default async function handler(req: Req, res: Res): Promise<void> {
  const cfg = xaiConfig()
  if (req.method === 'GET' && req.query?.models) {
    // Aide au réglage : liste des modèles disponibles avec la clé, pour choisir XAI_MODEL.
    if (!xaiKey()) return res.status(503).json({ error: 'Aucune clé trouvée (XAI_API_KEY ou GROCK_API).' })
    const m = await listModels()
    return m.ok ? res.status(200).json({ models: m.models }) : res.status(502).json({ error: `xAI a refusé la demande (code ${m.status}).` })
  }
  if (req.method === 'GET') return res.status(200).json({ enabled: Boolean(cfg), hasKey: Boolean(xaiKey()) })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
  if (!cfg) return res.status(503).json({ error: "La découpe par IA n'est pas activée." })
  const body = parseBody(req.body)
  if (!body) return res.status(400).json({ error: 'Requête invalide.' })

  const content: Part[] = [{
    type: 'text',
    text:
      `Voici ${body.frames.length} images prises à intervalles réguliers dans une vidéo d'exercices d'étirements ou de posture qui dure ${Math.round(body.duration)} secondes. ` +
      "Chaque image est précédée de son instant en secondes. Repère chaque exercice distinct, dans l'ordre. Ignore l'introduction, la conclusion et les moments sans exercice. " +
      "Pour chacun : début et fin en secondes (sans chevauchement), nom court en français (40 caractères au plus) et consigne de 80 caractères au plus. " +
      'Réponds uniquement par un tableau JSON : [{"start":0,"end":30,"name":"…","cue":"…"}].',
  }]
  for (const f of body.frames) {
    content.push({ type: 'text', text: `Instant ${Math.round(f.t)} s :` })
    content.push(jpegPart(f.image))
  }
  const r = await askVision(cfg, content, 3000)
  if (!r.ok) return res.status(502).json({ error: r.status ? `Le service d'IA a refusé la demande (code ${r.status}).` : "Le service d'IA est injoignable." })
  return res.status(200).json({ exercises: parseFound(r.text, body.duration) })
}
