import { db } from '../data/db'
import { newId } from '../data/importFile'
import type { Exercise, Workout, WorkoutItem } from '../data/types'

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

/** Exercices d'une vidéo, dans l'ordre de la vidéo. */
export const inVideoOrder = (exs: Exercise[]) => [...exs].sort((a, b) => a.startSec - b.startSec)

/** Élément de séance pour un exercice : durée de l'extrait (30 s au plus par défaut, 5 s au moins), sans repos. */
export function itemFor(e: Exercise): WorkoutItem {
  const len = Math.round(e.endSec - e.startSec) || DEFAULT_ITEM_SEC
  return { exerciseId: e.id, durationSec: Math.max(5, Math.min(len, DEFAULT_ITEM_SEC)), restAfterSec: 0 }
}

/** Durée de l'extrait lui-même, arrondie à 5 s, entre 5 s et 300 s. */
export function naturalDurationSec(e: Exercise): number {
  return Math.min(300, Math.max(5, Math.round((e.endSec - e.startSec) / 5) * 5))
}

/** Même durée et même repos pour tous les éléments. */
export const applyRhythm = (items: WorkoutItem[], durationSec: number, restAfterSec: number): WorkoutItem[] =>
  items.map((i) => ({ ...i, durationSec, restAfterSec }))

/** Retire la suite d'éléments consécutifs qui partagent la vidéo de l'élément `index`. */
export function removeRun(items: WorkoutItem[], index: number, sourceOf: (exerciseId: string) => string | undefined): WorkoutItem[] {
  const src = sourceOf(items[index]?.exerciseId ?? '')
  if (src === undefined) return items.filter((_, k) => k !== index)
  let a = index
  let b = index
  while (a > 0 && sourceOf(items[a - 1]!.exerciseId) === src) a--
  while (b < items.length - 1 && sourceOf(items[b + 1]!.exerciseId) === src) b++
  return items.filter((_, k) => k < a || k > b)
}
