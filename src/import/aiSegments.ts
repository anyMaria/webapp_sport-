import { aiPost, aiStatus, drawTag, openHiddenVideo, seekVideo } from './aiClient'
import { clampCue, defaultName, MIN_SEGMENT_SEC, segId, type Segment } from './segments'

export interface Found { start: number; end: number; name: string; cue: string }
/** Une planche : une grille d'images de la vidéo, avec l'instant de chacune. */
export interface Sheet { image: string; times: number[] }

export async function aiSegmentsEnabled(): Promise<boolean> {
  return (await aiStatus()).enabled
}

const COLS = 5
const ROWS = 4
const PER_SHEET = COLS * ROWS
/** Au plus 5 planches (certains services limitent le nombre d'images) : 100 images au plus. */
export const MAX_FRAMES = 5 * PER_SHEET
/** Une image par seconde jusqu'à 100 s de vidéo (les exercices TikTok durent quelques secondes), puis plus espacées. */
export const frameCount = (durationSec: number) => Math.min(MAX_FRAMES, Math.max(8, Math.round(durationSec)))

/** Planches d'images (grille de 5 x 4, 240 px au plus par image), l'instant écrit sur chaque image. */
export async function sampleSheets(file: Blob, durationSec: number, signal: AbortSignal, onProgress: (ratio: number) => void): Promise<Sheet[]> {
  const { v, done } = await openHiddenVideo(file)
  try {
    const vw = v.videoWidth || 16
    const vh = v.videoHeight || 9
    const k = 240 / Math.max(vw, vh)
    const w = Math.round(vw * k)
    const h = Math.round(vh * k)
    const n = frameCount(durationSec)
    const sheets: Sheet[] = []
    let cv: HTMLCanvasElement | null = null
    let g: CanvasRenderingContext2D | null = null
    let times: number[] = []
    const flush = () => {
      if (cv && times.length) sheets.push({ image: cv.toDataURL('image/jpeg', 0.7).split(',')[1]!, times })
      cv = null
      times = []
    }
    for (let i = 0; i < n; i++) {
      if (signal.aborted) throw new DOMException('Annulé', 'AbortError')
      if (!cv) {
        cv = document.createElement('canvas')
        cv.width = COLS * w
        cv.height = ROWS * h
        g = cv.getContext('2d')!
        g.fillStyle = '#000'
        g.fillRect(0, 0, cv.width, cv.height)
      }
      const t = Math.min(durationSec - 0.1, ((i + 0.5) * durationSec) / n)
      await seekVideo(v, t)
      const slot = times.length
      const x = (slot % COLS) * w
      const y = Math.floor(slot / COLS) * h
      g!.drawImage(v, x, y, w, h)
      drawTag(g!, `${t.toFixed(t < 100 ? 1 : 0)}`, x + 3, y + 3)
      times.push(t)
      if (times.length === PER_SHEET) flush()
      onProgress((i + 1) / n)
    }
    flush()
    return sheets
  } finally {
    done()
  }
}

export async function requestSegments(sheets: Sheet[], durationSec: number, cuts: number[], signal: AbortSignal): Promise<{ exercises: Found[]; note?: string }> {
  const body = await aiPost<{ exercises?: Found[]; note?: string }>({ task: 'segments', sheets, duration: durationSec, cuts: cuts.slice(0, 200) }, signal)
  return { exercises: body.exercises ?? [], note: body.note }
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

/**
 * Cale les débuts et fins proposés par l'IA sur les changements d'image détectés localement (au plus `maxDist` s d'écart),
 * puis recolle les exercices qui s'enchaînent (début du suivant = fin du précédent).
 */
export function snapBoundaries(found: Found[], cuts: number[], maxDist = 1.5): Found[] {
  const snap = (t: number) => {
    let best = t
    let bd = maxDist + 1e-9
    for (const c of cuts) {
      const d = Math.abs(c - t)
      if (d < bd) { bd = d; best = c }
    }
    return best
  }
  const out = [...found].sort((a, b) => a.start - b.start).map((f) => ({ ...f, start: snap(f.start), end: snap(f.end) }))
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1]!
    const cur = out[i]!
    if (Math.abs(cur.start - prev.end) <= maxDist) cur.start = prev.end
  }
  return out.filter((f) => f.end > f.start)
}
