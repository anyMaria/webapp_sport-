/**
 * Appel à l'API de Grok (xAI), partagé par les fonctions serveur. Format « chat completions » avec images.
 * Rien n'est écrit en dur sur le modèle : à vérifier dans la documentation actuelle de xAI, puis à régler en
 * variables d'environnement Vercel :
 *   XAI_API_KEY   la clé (jamais dans le code ni dans le dépôt) ; GROCK_API et GROK_API sont aussi lus
 *   XAI_MODEL     le nom d'un modèle qui accepte les images
 *   XAI_BASE_URL  facultatif ; par défaut https://api.x.ai/v1
 */
export const env = (k: string) => (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env[k]

/** Premier nom de variable renseigné. Plusieurs écritures acceptées (XAI, GROK, GROCK) pour éviter une panne de nom. */
const firstEnv = (names: string[]) => names.map(env).find((v) => v && v.trim())?.trim()

export interface XaiConfig { key: string; model: string; base: string }

export const xaiKey = () => firstEnv(['XAI_API_KEY', 'GROCK_API', 'GROK_API', 'GROCK_API_KEY', 'GROK_API_KEY'])
export const xaiBase = () => (env('XAI_BASE_URL') ?? 'https://api.x.ai/v1').replace(/\/+$/, '')

export function xaiConfig(): XaiConfig | null {
  const key = xaiKey()
  const model = firstEnv(['XAI_MODEL', 'GROCK_MODEL', 'GROK_MODEL'])
  if (!key || !model) return null
  return { key, model, base: xaiBase() }
}

/** Noms des modèles que la clé peut utiliser (pour choisir XAI_MODEL). Ne renvoie jamais la clé. */
export async function listModels(): Promise<{ ok: true; models: string[] } | { ok: false; status: number }> {
  const key = xaiKey()
  if (!key) return { ok: false, status: 0 }
  try {
    const r = await fetch(`${xaiBase()}/models`, { headers: { authorization: `Bearer ${key}` } })
    if (!r.ok) return { ok: false, status: r.status }
    const j = (await r.json()) as { data?: { id?: string }[] }
    return { ok: true, models: (j.data ?? []).map((m) => m.id ?? '').filter(Boolean) }
  } catch {
    return { ok: false, status: 0 }
  }
}

export type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

export const jpegPart = (base64: string): Part => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } })

export async function askVision(cfg: XaiConfig, content: Part[], maxTokens: number): Promise<{ ok: true; text: string } | { ok: false; status: number }> {
  try {
    const r = await fetch(`${cfg.base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
    })
    if (!r.ok) return { ok: false, status: r.status }
    const data = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    return { ok: true, text: data.choices?.[0]?.message?.content ?? '' }
  } catch {
    return { ok: false, status: 0 }
  }
}
