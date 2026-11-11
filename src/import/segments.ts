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
  const b: Segment = { ...s, id: segId(), startSec: round(t), name: `${s.name} (suite)`, cue: '', tags: [...s.tags] }
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

export const durationOf = (s: Segment) => round(s.endSec - s.startSec)
export const keptSegments = (segs: Segment[]) => segs.filter((s) => s.kept)
export const clampCue = (cue: string) => cue.slice(0, CUE_MAX)

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Noms par défaut « Exercice N » pour les segments gardés, dans l'ordre, sans toucher aux noms saisis. */
export function defaultName(index: number) {
  return `Exercice ${index + 1}`
}
