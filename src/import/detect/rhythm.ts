import type { Candidate } from './types'

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
