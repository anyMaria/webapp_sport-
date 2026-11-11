/**
 * Appel à l'API de Grok (xAI), partagé par les fonctions serveur. Format « chat completions » avec images.
 * Rien n'est écrit en dur sur le modèle : à vérifier dans la documentation actuelle de xAI, puis à régler en
 * variables d'environnement Vercel :
 *   XAI_API_KEY   la clé (jamais dans le code ni dans le dépôt)
 *   XAI_MODEL     le nom d'un modèle qui accepte les images
 *   XAI_BASE_URL  facultatif ; par défaut https://api.x.ai/v1
 */
export const env = (k: string) => (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env[k]

export interface XaiConfig { key: string; model: string; base: string }

export function xaiConfig(): XaiConfig | null {
  const key = env('XAI_API_KEY')
  const model = env('XAI_MODEL')
  if (!key || !model) return null
  return { key, model, base: (env('XAI_BASE_URL') ?? 'https://api.x.ai/v1').replace(/\/+$/, '') }
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
