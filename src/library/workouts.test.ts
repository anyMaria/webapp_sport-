import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { duplicateWorkout, formatDuration, move, workoutDurationSec } from './workouts'

describe('séances', () => {
  it('calcule la durée avec les repos', () => {
    expect(workoutDurationSec([{ exerciseId: 'a', durationSec: 30, restAfterSec: 10 }, { exerciseId: 'b', durationSec: 45, restAfterSec: 0 }])).toBe(85)
    expect(workoutDurationSec([])).toBe(0)
  })
  it('formate la durée', () => {
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(180)).toBe('3 min')
    expect(formatDuration(725)).toBe('12 min 05')
  })
  it('réordonne sans modifier l’original', () => {
    const l = ['a', 'b', 'c', 'd']
    expect(move(l, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(move(l, 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(move(l, 1, 1)).toBe(l)
    expect(move(l, 0, 9)).toBe(l)
    expect(l).toEqual(['a', 'b', 'c', 'd'])
  })
  it('duplique une séance avec un nouvel identifiant', async () => {
    await db.workouts.put({ id: 'w', name: 'Dos', isExpress: true, createdAt: 'x', updatedAt: 'x', items: [{ exerciseId: 'e', durationSec: 30, restAfterSec: 0 }] })
    const id = await duplicateWorkout('w')
    const copy = await db.workouts.get(id!)
    expect(id).not.toBe('w')
    expect(copy?.name).toBe('Dos (copie)')
    expect(copy?.items).toEqual([{ exerciseId: 'e', durationSec: 30, restAfterSec: 0 }])
    expect(await duplicateWorkout('absent')).toBeNull()
  })
})
