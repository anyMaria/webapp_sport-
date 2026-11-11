/** Échanges avec la fonction serveur /api/ai (voir api/ai.ts). */
export interface AiStatus { enabled: boolean; hasKey?: boolean; provider?: string; model?: string | null; reason?: string }

export async function aiStatus(): Promise<AiStatus> {
  try {
    const r = await fetch('/api/ai')
    if (!r.ok) return { enabled: false }
    return (await r.json()) as AiStatus
  } catch {
    return { enabled: false }
  }
}

/** Erreur du service d'IA ; `retryAfter` (secondes) est renseigné quand il demande d'attendre avant de réessayer. */
export class AiError extends Error {
  retryAfter?: number
  constructor(message: string, retryAfter?: number) {
    super(message)
    this.retryAfter = retryAfter
  }
}

export async function aiPost<T>(payload: unknown, signal: AbortSignal): Promise<T> {
  const r = await fetch('/api/ai', { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  const body = (await r.json().catch(() => ({}))) as T & { error?: string; retryAfter?: number }
  if (!r.ok) throw new AiError(body.error ?? `L'IA n'a pas répondu (code ${r.status}).`, r.status === 429 ? (body.retryAfter ?? 10) : undefined)
  return body
}

/** Attente annulable. */
export const wait = (ms: number, signal: AbortSignal) => new Promise<void>((res, rej) => {
  const t = window.setTimeout(res, ms)
  signal.addEventListener('abort', () => { window.clearTimeout(t); rej(new DOMException('Annulé', 'AbortError')) }, { once: true })
})

/** Ouvre une vidéo cachée pour y prendre des images ; `done()` libère l'adresse temporaire. */
export async function openHiddenVideo(file: Blob): Promise<{ v: HTMLVideoElement; done: () => void }> {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  try {
    await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('Vidéo illisible')); v.src = url })
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
  return { v, done: () => URL.revokeObjectURL(url) }
}

export const seekVideo = (v: HTMLVideoElement, t: number) => new Promise<void>((res) => { v.onseeked = () => res(); v.currentTime = t })

/** Étiquette lisible dans un coin d'image (l'instant ou le numéro de l'image). */
export function drawTag(g: CanvasRenderingContext2D, text: string, x: number, y: number) {
  g.font = 'bold 22px sans-serif'
  const w = g.measureText(text).width + 14
  g.fillStyle = 'rgba(0,0,0,0.75)'
  g.fillRect(x, y, w, 30)
  g.fillStyle = '#fff'
  g.textBaseline = 'middle'
  g.fillText(text, x + 7, y + 16)
}
