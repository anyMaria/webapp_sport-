import type { AppDB } from './db'
import type { Workout } from './types'

/** Séances qui utilisent au moins un exercice de cette source (pour la confirmation de suppression). */
export async function workoutsUsingSource(db: AppDB, sourceId: string): Promise<Workout[]> {
  const ids = new Set((await db.exercises.where('sourceId').equals(sourceId).primaryKeys()) as string[])
  return (await db.workouts.toArray()).filter((w) => w.items.some((i) => ids.has(i.exerciseId)))
}

/** Supprime la source, sa vignette, ses exercices et leurs vignettes. Le fichier OPFS est supprimé par l'appelant (voir opfs.ts). */
export async function deleteSourceRecords(db: AppDB, sourceId: string): Promise<{ opfsPath?: string }> {
  const source = await db.sources.get(sourceId)
  await db.transaction('rw', [db.sources, db.exercises, db.thumbs], async () => {
    const exs = await db.exercises.where('sourceId').equals(sourceId).toArray()
    await db.thumbs.bulkDelete([source?.thumbId, ...exs.map((e) => e.thumbId)].filter((t): t is string => !!t))
    await db.exercises.bulkDelete(exs.map((e) => e.id))
    await db.sources.delete(sourceId)
  })
  return { opfsPath: source?.opfsPath }
}
