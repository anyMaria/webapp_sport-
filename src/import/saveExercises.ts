import { db } from '../data/db'
import { getVideoFile } from '../data/opfs'
import { makeThumb, newId } from '../data/importFile'
import type { Exercise, VideoSource } from '../data/types'
import { clampCue, defaultName, keptSegments, type Segment } from './segments'

/** Crée un exercice par segment gardé, avec sa vignette. Un échec de vignette ne bloque pas l'enregistrement. */
export async function saveSegments(source: VideoSource, segments: Segment[]): Promise<Exercise[]> {
  const file = source.opfsPath ? await getVideoFile(source.opfsPath) : undefined
  const now = new Date().toISOString()
  const out: Exercise[] = []
  const kept = keptSegments(segments)
  for (let i = 0; i < kept.length; i++) {
    const s = kept[i]!
    let thumbId: string | undefined
    if (file) {
      try {
        const blob = await makeThumb(file, s.startSec + Math.min(1, (s.endSec - s.startSec) / 2))
        thumbId = newId()
        await db.thumbs.put({ id: thumbId, blob })
      } catch {
        thumbId = undefined
      }
    }
    out.push({
      id: newId(), sourceId: source.id, name: s.name.trim() || defaultName(i), startSec: s.startSec, endSec: s.endSec,
      cue: s.cue.trim() ? clampCue(s.cue.trim()) : undefined, tags: s.tags, thumbId, createdAt: now,
    })
  }
  await db.exercises.bulkPut(out)
  return out
}
