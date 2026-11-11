import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { AppDB } from './db'
import { deleteSourceRecords, workoutsUsingSource } from './sources'

it('supprime une source avec ses exercices et signale les séances touchées', async () => {
  const db = new AppDB('src-test')
  await db.sources.bulkPut([
    { id: 's1', kind: 'file', title: 'A', durationSec: 10, originLabel: 'Autre', opfsPath: 'a.mp4', createdAt: 'x' },
    { id: 's2', kind: 'file', title: 'B', durationSec: 10, originLabel: 'Autre', opfsPath: 'b.mp4', createdAt: 'x' },
  ])
  await db.exercises.bulkPut([
    { id: 'e1', sourceId: 's1', name: 'x', startSec: 0, endSec: 5, tags: [], thumbId: 't1', createdAt: 'x' },
    { id: 'e2', sourceId: 's2', name: 'y', startSec: 0, endSec: 5, tags: [], createdAt: 'x' },
  ])
  await db.thumbs.put({ id: 't1', blob: new Blob(['a']) })
  await db.workouts.put({ id: 'w1', name: 'S', isExpress: false, createdAt: 'x', updatedAt: 'x', items: [{ exerciseId: 'e1', durationSec: 30, restAfterSec: 0 }] })

  expect((await workoutsUsingSource(db, 's1')).map((w) => w.name)).toEqual(['S'])
  expect(await workoutsUsingSource(db, 's2')).toEqual([])
  expect(await deleteSourceRecords(db, 's1')).toEqual({ opfsPath: 'a.mp4' })
  expect(await db.exercises.count()).toBe(1)
  expect(await db.thumbs.count()).toBe(0)
  // La séance reste en place : le lecteur saute l'exercice manquant.
  expect(await db.workouts.count()).toBe(1)
})
