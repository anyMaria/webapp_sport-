import { db } from '../data/db'
import { newId } from '../data/importFile'
import type { Workout, WorkoutItem } from '../data/types'

export const DEFAULT_ITEM_SEC = 30

/** Durée totale d'une séance : exercices et repos. */
export const workoutDurationSec = (items: WorkoutItem[]) => items.reduce((n, i) => n + i.durationSec + i.restAfterSec, 0)

export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`
}

/** Déplace un élément d'une position à une autre, sans modifier le tableau d'origine. */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const out = [...list]
  const [x] = out.splice(from, 1)
  out.splice(to, 0, x!)
  return out
}

export async function duplicateWorkout(id: string): Promise<string | null> {
  const w = await db.workouts.get(id)
  if (!w) return null
  const now = new Date().toISOString()
  const copy: Workout = { ...w, id: newId(), name: `${w.name} (copie)`, items: w.items.map((i) => ({ ...i })), createdAt: now, updatedAt: now }
  await db.workouts.put(copy)
  return copy.id
}

export async function deleteExercise(id: string): Promise<void> {
  const ex = await db.exercises.get(id)
  await db.transaction('rw', [db.exercises, db.thumbs], async () => {
    if (ex?.thumbId) await db.thumbs.delete(ex.thumbId)
    await db.exercises.delete(id)
  })
}
