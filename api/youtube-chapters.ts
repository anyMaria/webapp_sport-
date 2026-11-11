/**
 * Repères (chapitres) d'une vidéo YouTube : renvoie la description, que l'app lit ensuite ligne par ligne
 * (« 2:15 Nom de l'exercice »). Facultatif : sans clé, la fonction répond { enabled: false } et le bouton
 * n'apparaît pas dans l'app.
 * La clé reste côté serveur, en variable d'environnement Vercel : YOUTUBE_API_KEY
 * (clé gratuite de l'API YouTube Data v3, créée dans la console Google Cloud).
 */
interface Req { method?: string; query?: Record<string, string | string[] | undefined> }
interface Res { status(code: number): Res; json(body: unknown): void }

const env = (k: string) => (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env[k]

export default async function handler(req: Req, res: Res): Promise<void> {
  const key = env('YOUTUBE_API_KEY')
  if (!key) return res.status(req.query?.id ? 503 : 200).json({ enabled: false, error: "Les repères YouTube ne sont pas activés." })
  const id = req.query?.id
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée.' })
  if (!id) return res.status(200).json({ enabled: true })
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(id)) return res.status(400).json({ error: 'Identifiant de vidéo invalide.' })
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${encodeURIComponent(key)}`)
    if (!r.ok) return res.status(502).json({ error: 'YouTube a refusé la demande.' })
    const j = (await r.json()) as { items?: { snippet?: { description?: string } }[] }
    const description = j.items?.[0]?.snippet?.description
    if (description === undefined) return res.status(404).json({ error: 'Vidéo introuvable.' })
    return res.status(200).json({ enabled: true, description })
  } catch {
    return res.status(502).json({ error: 'YouTube est injoignable.' })
  }
}
