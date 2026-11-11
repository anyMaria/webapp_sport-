import type { Candidate } from './types'
import { MIN_SEGMENT_SEC, segId, type Segment } from '../segments'

export interface Rhythm {
  effortSec: number
  restSec: number
  /** Début du premier exercice. */
  startSec: number
}

export const SNAP_SEC = 1.5

/**
 * Rythme régulier : génère effort/pause en alternance, puis cale chaque frontière sur une frontière
 * détectée à moins de 1,5 s si elle existe. Caler = être d'accord avec un détecteur : confiance haute.
 */
export function rhythmBoundaries(r: Rhythm, durationSec: number, detected: Candidate[]): Candidate[] {
  const out: Candidate[] = []
  const cycle = r.effortSec + r.restSec
  if (cycle <= 0 || r.effortSec <= 0) return out
  const snap = (t: number) => {
    let best: Candidate | null = null
    for (const d of detected) if (Math.abs(d.t - t) <= SNAP_SEC && (!best || Math.abs(d.t - t) < Math.abs(best.t - t))) best = d
    return best
  }
  const push = (t: number) => {
    if (t <= 0 || t >= durationSec) return
    const hit = snap(t)
    out.push(hit ? { t: hit.t, source: 'rhythm', strength: 0.8 } : { t, source: 'rhythm', strength: 0.4 })
  }
  for (let t = r.startSec; t < durationSec; t += cycle) {
    push(t)
    if (r.restSec > 0) push(t + r.effortSec)
  }
  return out
}

/**
 * Rythme régulier, découpage direct (écran de découpage) : chaque effort devient un exercice gardé, chaque pause une « Pause » retirée,
 * et ce qui précède le début une « Intro » retirée. Rien n'est fusionné ni deviné : ce qu'elle a indiqué comme pause reste une pause.
 * Un bout de moins de 1 s en fin de vidéo est rattaché à la partie d'avant.
 */
export function rhythmSegments(r: Rhythm, durationSec: number): Segment[] {
  const total = Math.round(durationSec * 100) / 100
  if (total <= 0 || r.effortSec <= 0) return []
  const out: Segment[] = []
  const add = (from: number, to: number, kind: 'intro' | 'effort' | 'rest') => {
    const end = Math.min(total, to)
    if (end - from <= 0) return
    const last = out[out.length - 1]
    if (end - from < MIN_SEGMENT_SEC && last) { last.endSec = end; return }
    out.push({
      id: segId(), startSec: from, endSec: end, cue: '', tags: [],
      name: kind === 'effort' ? `Exercice ${out.filter((s) => s.kept).length + 1}` : kind === 'rest' ? 'Pause' : 'Intro',
      kept: kind === 'effort',
    })
  }
  const start = Math.min(Math.max(0, r.startSec), total)
  add(0, start, 'intro')
  for (let t = start; t < total; t += r.effortSec + r.restSec) {
    add(t, t + r.effortSec, 'effort')
    if (r.restSec > 0) add(t + r.effortSec, t + r.effortSec + r.restSec, 'rest')
  }
  return out
}
