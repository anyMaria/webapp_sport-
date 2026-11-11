import { segId, type Segment } from '../segments'
import type { Candidate, MotionSeries } from './types'
import { median } from './shots'

export const CLUSTER_SEC = 1
export const SHORT_SEC = 8
export const PAUSE_SEC = 15
export const LOW_CONFIDENCE = 0.6

interface Cluster {
  t: number
  sources: Set<string>
  strength: number
}

/** Regroupe les frontières à moins de 1 s les unes des autres. */
function cluster(cands: Candidate[]): Cluster[] {
  const sorted = [...cands].sort((a, b) => a.t - b.t)
  const out: { items: Candidate[] }[] = []
  for (const c of sorted) {
    const last = out[out.length - 1]
    if (last && c.t - last.items[last.items.length - 1]!.t < CLUSTER_SEC) last.items.push(c)
    else out.push({ items: [c] })
  }
  return out.map(({ items }) => {
    const w = items.reduce((n, i) => n + i.strength, 0) || 1
    return {
      t: Math.round((items.reduce((n, i) => n + i.t * i.strength, 0) / w) * 100) / 100,
      sources: new Set(items.map((i) => i.source)),
      strength: Math.max(...items.map((i) => i.strength)),
    }
  })
}

const motionOf = (m: MotionSeries | undefined, a: number, b: number): number | null => {
  if (!m || !m.values.length) return null
  const from = Math.max(0, Math.floor(a / m.stepSec))
  const to = Math.min(m.values.length, Math.ceil(b / m.stepSec))
  const slice = m.values.slice(from, to)
  return slice.length ? slice.reduce((n, x) => n + x, 0) / slice.length : null
}

/**
 * Fusion des frontières en segments proposés. Règles du plan :
 * 1. frontières à moins de 1 s regroupées ; 2. segment de moins de 8 s rattaché à son voisin ;
 * 3. segment de moins de 15 s entre deux longs : « Pause », retiré ; 4. premier et dernier segments retirés
 * s'ils manquent de mouvement, sinon gardés et marqués « à vérifier ».
 * Confiance : deux détecteurs d'accord = haute ; un seul, proche du seuil = « Fin à vérifier ».
 */
export function mergeCandidates(cands: Candidate[], durationSec: number, motion?: MotionSeries): Segment[] {
  const clusters = cluster(cands).filter((c) => c.t >= CLUSTER_SEC && c.t <= durationSec - CLUSTER_SEC)
  const cuts = [0, ...clusters.map((c) => c.t), durationSec]
  let segs: Segment[] = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const end = clusters[i]
    segs.push({
      id: segId(), startSec: cuts[i]!, endSec: cuts[i + 1]!, name: '', cue: '', tags: [], kept: true,
      verify: end ? end.sources.size < 2 && end.strength < LOW_CONFIDENCE : false,
    })
  }

  // 2. Les segments trop courts se rattachent à un voisin (le précédent, sinon le suivant).
  for (;;) {
    const i = segs.findIndex((s) => s.endSec - s.startSec < SHORT_SEC)
    if (i < 0 || segs.length === 1) break
    const s = segs[i]!
    if (i > 0) {
      const prev = segs[i - 1]!
      segs = [...segs.slice(0, i - 1), { ...prev, endSec: s.endSec, verify: s.verify }, ...segs.slice(i + 1)]
    } else {
      const next = segs[1]!
      segs = [{ ...next, startSec: s.startSec }, ...segs.slice(2)]
    }
  }

  // 4. Premier et dernier segments.
  const lastIdx = segs.length - 1
  const meds = median(motion?.values ?? [])
  const edge = (i: number, label: string) => {
    if (segs.length < 3) return
    const s = segs[i]!
    const m = motionOf(motion, s.startSec, s.endSec)
    if (m !== null && m < meds * 0.5) segs[i] = { ...s, kept: false, name: label }
    else segs[i] = { ...s, verify: true }
  }
  edge(0, 'Intro')
  edge(lastIdx, 'Fin')

  // 3. Segment court entre deux longs : pause, retirée par défaut.
  segs = segs.map((s, i) => {
    const prev = segs[i - 1]
    const next = segs[i + 1]
    const len = s.endSec - s.startSec
    if (prev && next && len < PAUSE_SEC && prev.endSec - prev.startSec >= PAUSE_SEC && next.endSec - next.startSec >= PAUSE_SEC) {
      return { ...s, kept: false, name: 'Pause', verify: false }
    }
    return s
  })

  let n = 0
  return segs.map((s) => ({ ...s, name: s.name || `Exercice ${++n}` }))
}
