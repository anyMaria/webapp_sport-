import { db } from './db'
import { makeThumb, newId } from './importFile'
import type { Exercise, VideoSource, Workout } from './types'

/** Découpe une vidéo en 5 extraits réguliers et crée une séance : sert à tester le lecteur avant l'écran de découpage. */
export async function createDemoWorkout(source: VideoSource, file: Blob): Promise<string> {
  const count = 5
  const seg = Math.max(4, Math.min(30, Math.floor(source.durationSec / count)))
  const now = new Date().toISOString()
  const exercises: Exercise[] = []
  for (let i = 0; i < count; i++) {
    const startSec = Math.min(i * seg, Math.max(0, source.durationSec - seg))
    const thumbId = newId()
    await makeThumb(file, startSec + 1).then((blob) => db.thumbs.put({ id: thumbId, blob })).catch(() => undefined)
    exercises.push({ id: newId(), sourceId: source.id, name: `Exercice ${i + 1}`, startSec, endSec: startSec + seg, tags: [], thumbId, createdAt: now })
  }
  const workout: Workout = {
    id: newId(), name: 'Séance de démonstration', isExpress: false, createdAt: now, updatedAt: now,
    items: exercises.map((e) => ({ exerciseId: e.id, durationSec: Math.min(20, seg), restAfterSec: 0 })),
  }
  await db.exercises.bulkPut(exercises)
  await db.workouts.put(workout)
  return workout.id
}
