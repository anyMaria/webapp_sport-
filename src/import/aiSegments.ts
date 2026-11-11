import { clampCue, defaultName, MIN_SEGMENT_SEC, segId, type Segment } from './segments'

export interface Found { start: number; end: number; name: string; cue: string }
export interface Frame { t: number; image: string }

/** Le bouton n'apparaît que si la fonction serveur a une clé et un modèle configurés. */
export async function aiSegmentsEnabled(): Promise<boolean> {
  try {
    const r = await fetch('/api/ai-segments')
    return r.ok && ((await r.json()) as { enabled?: boolean }).enabled === true
  } catch {
    return false
  }
}

/** Nombre d'images envoyées : une toutes les 3 s environ, entre 8 et 60. */
export const frameCount = (durationSec: number) => Math.min(60, Math.max(8, Math.floor(durationSec / 3)))

/** Images réduites (320 px de large, JPEG) prises à intervalles réguliers, dans un élément vidéo caché. */
export async function sampleFrames(file: Blob, durationSec: number, signal: AbortSignal, onProgress: (ratio: number) => void): Promise<Frame[]> {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  try {
    await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('Vidéo illisible')); v.src = url })
    const w = 320
    const h = Math.round((w * (v.videoHeight || 9)) / (v.videoWidth || 16))
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const g = cv.getContext('2d')!
    const n = frameCount(durationSec)
    const out: Frame[] = []
    for (let i = 0; i < n; i++) {
      if (signal.aborted) throw new DOMException('Annulé', 'AbortError')
      const t = Math.min(durationSec - 0.1, ((i + 0.5) * durationSec) / n)
      await new Promise<void>((res) => { v.onseeked = () => res(); v.currentTime = t })
      g.drawImage(v, 0, 0, w, h)
      out.push({ t, image: cv.toDataURL('image/jpeg', 0.6).split(',')[1]! })
      onProgress((i + 1) / n)
    }
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function requestSegments(frames: Frame[], durationSec: number, signal: AbortSignal): Promise<Found[]> {
  const r = await fetch('/api/ai-segments', {
    method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ frames, duration: durationSec }),
  })
  const body = (await r.json().catch(() => ({}))) as { exercises?: Found[]; error?: string }
  if (!r.ok) throw new Error(body.error ?? 'La découpe par IA a échoué.')
  return body.exercises ?? []
}

const round = (n: number) => Math.round(n * 10) / 10

/**
 * Transforme la réponse de l'IA en segments qui couvrent toute la vidéo : exercices gardés (« à vérifier »),
 * et les trous entre eux en segments « Pause » retirés. Ordonne, borne, retire les chevauchements.
 */
export function buildSegments(found: Found[], durationSec: number): Segment[] {
  const items = found
    .filter((f) => Number.isFinite(f.start) && Number.isFinite(f.end))
    .map((f) => ({ ...f, start: Math.max(0, f.start), end: Math.min(durationSec, f.end) }))
    .sort((a, b) => a.start - b.start)
  const out: Segment[] = []
  let cursor = 0
  let n = 0
  const gap = (from: number, to: number) => {
    if (to - from >= MIN_SEGMENT_SEC) out.push({ id: segId(), startSec: round(from), endSec: round(to), name: 'Pause', cue: '', tags: [], kept: false })
  }
  for (const f of items) {
    const start = Math.max(f.start, cursor)
    if (f.end - start < MIN_SEGMENT_SEC) continue
    gap(cursor, start)
    out.push({ id: segId(), startSec: round(start), endSec: round(f.end), name: f.name.trim() || defaultName(n), cue: clampCue(f.cue), tags: [], kept: true, verify: true })
    n++
    cursor = f.end
  }
  gap(cursor, durationSec)
  return out
}
