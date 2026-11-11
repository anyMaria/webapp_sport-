import { db } from '../data/db'
import type { PlayItem } from '../engine/session'

export type Clip =
  | { kind: 'file'; opfsPath: string; startSec: number; endSec: number }
  | { kind: 'youtube'; youtubeId: string; startSec: number; endSec: number }
  | { kind: 'missing'; startSec: number; endSec: number }

export interface Plan {
  workoutId: string
  name: string
  items: PlayItem[]
  clips: Clip[]
  thumbIds: (string | undefined)[]
  /** Miniature YouTube quand l'exercice n'a pas de vignette extraite. */
  thumbYt: (string | undefined)[]
  /** Éléments sautés car l'exercice ou la vidéo n'existe plus. */
  missing: number
  isExpress: boolean
}

/** Transforme une séance enregistrée en liste jouable. Un exercice supprimé est sauté et signalé. */
export async function buildPlan(workoutId: string): Promise<Plan | null> {
  const w = await db.workouts.get(workoutId)
  if (!w) return null
  const items: PlayItem[] = []
  const clips: Clip[] = []
  const thumbIds: (string | undefined)[] = []
  const thumbYt: (string | undefined)[] = []
  let missing = 0
  for (const it of w.items) {
    const ex = await db.exercises.get(it.exerciseId)
    const src = ex ? await db.sources.get(ex.sourceId) : undefined
    if (!ex || !src) { missing++; continue }
    items.push({ exerciseId: ex.id, name: ex.name, cue: ex.cue, durationSec: it.durationSec, restAfterSec: it.restAfterSec })
    thumbIds.push(ex.thumbId)
    thumbYt.push(src.kind === 'youtube' ? src.youtubeId : undefined)
    if (src.kind === 'file' && src.opfsPath) clips.push({ kind: 'file', opfsPath: src.opfsPath, startSec: ex.startSec, endSec: ex.endSec })
    else if (src.kind === 'youtube' && src.youtubeId) clips.push({ kind: 'youtube', youtubeId: src.youtubeId, startSec: ex.startSec, endSec: ex.endSec })
    else clips.push({ kind: 'missing', startSec: ex.startSec, endSec: ex.endSec })
  }
  return { workoutId: w.id, name: w.name, items, clips, thumbIds, thumbYt, missing, isExpress: w.isExpress }
}
