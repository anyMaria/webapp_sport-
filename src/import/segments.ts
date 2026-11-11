/** Logique pure du découpage : couper, fusionner, ajuster. Aucune dépendance au navigateur. */

export interface Segment {
  id: string
  startSec: number
  endSec: number
  name: string
  cue: string
  tags: string[]
  kept: boolean
  /** Frontière incertaine : affiche « Fin à vérifier ». */
  verify?: boolean
}

export const MIN_SEGMENT_SEC = 1
export const STEP_SEC = 0.5
export const CUE_MAX = 80

const round = (n: number) => Math.round(n * 100) / 100
let counter = 0
export const segId = () => `seg-${Date.now().toString(36)}-${counter++}`

export function wholeVideo(durationSec: number, name = 'Exercice 1'): Segment[] {
  return [{ id: segId(), startSec: 0, endSec: round(durationSec), name, cue: '', tags: [], kept: true }]
}

/** Coupe un segment en deux à la position t. Refuse si une des moitiés serait trop courte. */
export function splitAt(segs: Segment[], id: string, t: number): Segment[] {
  const i = segs.findIndex((s) => s.id === id)
  const s = segs[i]
  if (!s) return segs
  if (t - s.startSec < MIN_SEGMENT_SEC || s.endSec - t < MIN_SEGMENT_SEC) return segs
  const a: Segment = { ...s, endSec: round(t), verify: false }
  const b: Segment = { ...s, id: segId(), startSec: round(t), name: isDefaultName(s.name) ? s.name : `${s.name} (suite)`, cue: '', tags: [...s.tags] }
  return [...segs.slice(0, i), a, b, ...segs.slice(i + 1)]
}

/** Fusionne un segment avec le suivant : le résultat garde le nom et la consigne du premier. */
export function mergeWithNext(segs: Segment[], id: string): Segment[] {
  const i = segs.findIndex((s) => s.id === id)
  const a = segs[i]
  const b = segs[i + 1]
  if (!a || !b) return segs
  const merged: Segment = { ...a, endSec: b.endSec, kept: a.kept || b.kept, verify: b.verify, tags: [...new Set([...a.tags, ...b.tags])] }
  return [...segs.slice(0, i), merged, ...segs.slice(i + 2)]
}

/** Déplace le début ou la fin d'un segment. Si le voisin touche la frontière, elle bouge pour les deux. */
export function adjust(segs: Segment[], id: string, edge: 'start' | 'end', deltaSec: number, durationSec: number): Segment[] {
  const i = segs.findIndex((s) => s.id === id)
  const s = segs[i]
  if (!s) return segs
  const out = segs.map((x) => ({ ...x }))
  const cur = out[i]!
  if (edge === 'end') {
    const next = out[i + 1]
    const joined = next && Math.abs(next.startSec - cur.endSec) < 0.001
    const max = joined ? next.endSec - MIN_SEGMENT_SEC : durationSec
    const t = round(Math.min(max, Math.max(cur.startSec + MIN_SEGMENT_SEC, cur.endSec + deltaSec)))
    if (joined) next.startSec = t
    cur.endSec = t
    cur.verify = false
  } else {
    const prev = out[i - 1]
    const joined = prev && Math.abs(prev.endSec - cur.startSec) < 0.001
    const min = joined ? prev.startSec + MIN_SEGMENT_SEC : 0
    const t = round(Math.max(min, Math.min(cur.endSec - MIN_SEGMENT_SEC, cur.startSec + deltaSec)))
    if (joined) prev.endSec = t
    cur.startSec = t
  }
  return out
}

/**
 * Déplace la coupe entre le segment `index` et le suivant à l'instant `t`.
 * Chaque voisin garde au moins 1 s ; la coupe n'est plus « à vérifier » une fois déplacée.
 */
export function moveBoundary(segs: Segment[], index: number, t: number): Segment[] {
  const a = segs[index]
  const b = segs[index + 1]
  if (!a || !b) return segs
  const lo = a.startSec + MIN_SEGMENT_SEC
  const hi = b.endSec - MIN_SEGMENT_SEC
  if (hi < lo) return segs
  const at = round(Math.min(hi, Math.max(lo, t)))
  if (at === a.endSec && at === b.startSec && !a.verify) return segs
  const out = [...segs]
  out[index] = { ...a, endSec: at, verify: false }
  out[index + 1] = { ...b, startSec: at }
  return out
}

/**
 * Rend les segments jointifs sur toute la vidéo : un trou d'au moins `minGapSec` (1 s par défaut) devient une « Pause » retirée,
 * un trou plus court est absorbé par le segment d'avant, un chevauchement est rogné.
 */
export function fillGaps(segs: Segment[], durationSec: number, minGapSec = MIN_SEGMENT_SEC): Segment[] {
  const total = round(durationSec)
  if (total <= 0) return segs
  const sorted = [...segs].sort((x, y) => x.startSec - y.startSec)
  const out: Segment[] = []
  const pause = (from: number, to: number): Segment => ({ id: segId(), startSec: from, endSec: to, name: 'Pause', cue: '', tags: [], kept: false })
  let cursor = 0
  for (const raw of sorted) {
    let start = round(Math.max(cursor, raw.startSec))
    const end = round(Math.min(total, raw.endSec))
    if (end - start < MIN_SEGMENT_SEC) continue
    const gap = start - cursor
    const prev = out[out.length - 1]
    if (gap >= minGapSec) out.push(pause(cursor, start))
    else if (gap > 0 && prev) prev.endSec = start
    else if (gap > 0) start = cursor
    out.push({ ...raw, startSec: start, endSec: end })
    cursor = end
  }
  const last = out[out.length - 1]
  if (!last) return wholeVideo(total)
  if (total - cursor >= minGapSec) out.push(pause(cursor, total))
  else if (total > cursor) last.endSec = total
  return out
}

export const durationOf = (s: Segment) => round(s.endSec - s.startSec)
export const keptSegments = (segs: Segment[]) => segs.filter((s) => s.kept)
export const clampCue = (cue: string) => cue.slice(0, CUE_MAX)

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const isDefaultName = (name: string) => /^Exercice \d+$/.test(name.trim())

/**
 * Après une coupe ou une fusion, les noms laissés par défaut (« Exercice N ») suivent l'ordre ; les noms saisis ne bougent pas.
 * Les « Pause » ne comptent pas : Exercice 1, Pause, Exercice 2.
 */
export function renumber(segs: Segment[]): Segment[] {
  let n = 0
  return segs.map((s) => {
    if (s.name.trim() === 'Pause') return s
    const name = defaultName(n++)
    return isDefaultName(s.name) && s.name !== name ? { ...s, name } : s
  })
}

/** Noms par défaut « Exercice N » pour les segments gardés, dans l'ordre, sans toucher aux noms saisis. */
export function defaultName(index: number) {
  return `Exercice ${index + 1}`
}
