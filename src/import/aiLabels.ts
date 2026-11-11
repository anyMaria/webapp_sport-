import { aiPost, aiStatus, drawTag, openHiddenVideo, seekVideo } from './aiClient'
import type { Segment } from './segments'

export interface Label { id: string; name: string; cue: string }

export async function aiLabelsEnabled(): Promise<boolean> {
  return (await aiStatus()).enabled
}

/** Une bande par segment : trois moments côte à côte (256 px chacun), JPEG, sans l'en-tête « data: ». */
export async function extractFrames(file: Blob, segs: Segment[], signal: AbortSignal): Promise<Record<string, string>> {
  const { v, done } = await openHiddenVideo(file)
  try {
    const w = 256
    const h = Math.round((w * (v.videoHeight || 9)) / (v.videoWidth || 16))
    const cv = document.createElement('canvas')
    cv.width = 3 * w
    cv.height = h
    const g = cv.getContext('2d')!
    const out: Record<string, string> = {}
    for (const s of segs) {
      const len = s.endSec - s.startSec
      const times = [s.startSec + len * 0.2, s.startSec + len * 0.5, s.startSec + len * 0.8]
      for (let i = 0; i < 3; i++) {
        if (signal.aborted) throw new DOMException('Annulé', 'AbortError')
        await seekVideo(v, times[i]!)
        g.drawImage(v, i * w, 0, w, h)
        drawTag(g, String(i + 1), i * w + 4, 4)
      }
      out[s.id] = cv.toDataURL('image/jpeg', 0.7).split(',')[1]!
    }
    return out
  } finally {
    done()
  }
}

/** Au plus 5 bandes par requête (certains services limitent le nombre d'images). */
const BATCH = 5

export async function requestLabels(strips: Record<string, string>, signal: AbortSignal): Promise<Label[]> {
  const entries = Object.entries(strips)
  const all: Label[] = []
  for (let i = 0; i < entries.length; i += BATCH) {
    const part = entries.slice(i, i + BATCH).map(([id, image]) => ({ id, image }))
    const body = await aiPost<{ labels?: Label[] }>({ task: 'labels', segments: part }, signal)
    all.push(...(body.labels ?? []))
  }
  return all
}
