import { askVision, jpegPart, xaiConfig, type Part } from './_xai'

/**
 * Nommage par IA (optionnel). Reçoit 2 ou 3 images réduites par segment, renvoie { id, name, cue } en français.
 * Service : Grok (xAI), voir _xai.ts. Sans clé ou sans modèle, la fonction répond { enabled: false }
 * et le bouton n'apparaît pas dans l'app.
 */
interface Req { method?: string; body?: unknown }
interface Res { status(code: number): Res; json(body: unknown): void }

const MAX_SEGMENTS = 40
const MAX_IMAGES = 3
const MAX_IMAGE_CHARS = 400_000 // base64 d'un JPEG de 512 px de large : très au-dessus de la taille attendue
const CUE_MAX = 80

interface Segment { id: string; images: string[] }
interface Label { id: string; name: string; cue: string }

function parseBody(b: unknown): Segment[] | null {
  const segs = (b as { segments?: unknown } | null)?.segments
  if (!Array.isArray(segs) || segs.length === 0 || segs.length > MAX_SEGMENTS) return null
  const out: Segment[] = []
  for (const s of segs as Partial<Segment>[]) {
    if (typeof s.id !== 'string' || !Array.isArray(s.images) || s.images.length === 0 || s.images.length > MAX_IMAGES) return null
    if (s.images.some((i) => typeof i !== 'string' || i.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(i))) return null
    out.push({ id: s.id, images: s.images })
  }
  return out
}

function parseLabels(text: string, ids: string[]): Label[] {
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

export default async function handler(req: Req, res: Res): Promise<void> {
  const cfg = xaiConfig()
  if (req.method === 'GET') return res.status(200).json({ enabled: Boolean(cfg) })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
  if (!cfg) return res.status(503).json({ error: "Le nommage par IA n'est pas activé." })

  const segments = parseBody(req.body)
  if (!segments) return res.status(400).json({ error: 'Requête invalide.' })

  const content: Part[] = [
    {
      type: 'text',
      text:
        "Voici des images extraites de segments d'une vidéo d'étirements ou de posture. Pour chaque segment, donne un nom d'exercice court en français " +
        `et une consigne de ${CUE_MAX} caractères au plus. Réponds uniquement par un tableau JSON : [{"id":"…","name":"…","cue":"…"}].`,
    },
  ]
  for (const s of segments) {
    content.push({ type: 'text', text: `Segment ${s.id} :` })
    for (const data of s.images) content.push(jpegPart(data))
  }

  const r = await askVision(cfg, content, 2048)
  if (!r.ok) return res.status(502).json({ error: r.status ? `Le service d'IA a refusé la demande (code ${r.status}).` : "Le service d'IA est injoignable." })
  return res.status(200).json({ labels: parseLabels(r.text, segments.map((s) => s.id)) })
}
