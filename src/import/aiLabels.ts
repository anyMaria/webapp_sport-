import { FRAME_W } from './detect/shots'
import type { Segment } from './segments'

export interface Label { id: string; name: string; cue: string }

/** Le bouton n'apparaît que si la fonction serveur a une clé et un modèle configurés. */
export async function aiLabelsEnabled(): Promise<boolean> {
  try {
    const r = await fetch('/api/label-segments')
    if (!r.ok) return false
    return ((await r.json()) as { enabled?: boolean }).enabled === true
  } catch {
    return false
  }
}

/** 2 ou 3 images réduites (512 px de large, JPEG) par segment, prises dans un élément vidéo caché. */
export async function extractFrames(file: Blob, segs: Segment[], signal: AbortSignal): Promise<Record<string, string[]>> {
  void FRAME_W
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  try {
    await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('Vidéo illisible')); v.src = url })
    const out: Record<string, string[]> = {}
    const w = 512
    const h = Math.round((w * (v.videoHeight || 9)) / (v.videoWidth || 16))
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const g = cv.getContext('2d')!
    for (const s of segs) {
      const len = s.endSec - s.startSec
      const times = len < 6 ? [s.startSec + len / 2] : [s.startSec + len * 0.2, s.startSec + len * 0.5, s.startSec + len * 0.8]
      out[s.id] = []
      for (const t of times) {
        if (signal.aborted) throw new DOMException('Annulé', 'AbortError')
        await new Promise<void>((res) => { v.onseeked = () => res(); v.currentTime = t })
        g.drawImage(v, 0, 0, w, h)
        out[s.id]!.push(cv.toDataURL('image/jpeg', 0.7).split(',')[1]!)
      }
    }
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function requestLabels(frames: Record<string, string[]>, signal: AbortSignal): Promise<Label[]> {
  const r = await fetch('/api/label-segments', {
    method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ segments: Object.entries(frames).map(([id, images]) => ({ id, images })) }),
  })
  const body = (await r.json().catch(() => ({}))) as { labels?: Label[]; error?: string }
  if (!r.ok) throw new Error(body.error ?? "Le nommage par IA a échoué.")
  return body.labels ?? []
}
