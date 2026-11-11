import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

export interface VideoStats {
  /** Nombre d'exercices enregistrés par vidéo. */
  counts: Record<string, number>
  /** Vignette de secours pour une vidéo importée avant les vignettes de vidéo : celle de son premier exercice. */
  thumbs: Record<string, string>
}
const EMPTY: VideoStats = { counts: {}, thumbs: {} }

/** Ce que les listes de vidéos ont besoin de savoir sur les exercices de chaque vidéo. */
export function useVideoStats(): VideoStats {
  return useLiveQuery(async () => {
    const out: VideoStats = { counts: {}, thumbs: {} }
    const exs = (await db.exercises.toArray()).sort((a, b) => a.startSec - b.startSec)
    for (const e of exs) {
      out.counts[e.sourceId] = (out.counts[e.sourceId] ?? 0) + 1
      if (e.thumbId && !out.thumbs[e.sourceId]) out.thumbs[e.sourceId] = e.thumbId
    }
    return out
  }, []) ?? EMPTY
}
