import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { applyRhythm, duplicateWorkout, formatDuration, inVideoOrder, itemFor, move, naturalDurationSec, removeRun, workoutDurationSec } from './workouts'
import type { Exercise } from '../data/types'

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


const ex = (id: string, start: number, end: number): Exercise => ({ id, sourceId: 's', name: id, startSec: start, endSec: end, tags: [], createdAt: '' })

describe('vidéo comme unité', () => {
  it('ordonne les exercices dans l\'ordre de la vidéo', () => {
    expect(inVideoOrder([ex('b', 40, 60), ex('a', 0, 20)]).map((e) => e.id)).toEqual(['a', 'b'])
  })
  it('choisit une durée par défaut raisonnable', () => {
    expect(itemFor(ex('a', 0, 12)).durationSec).toBe(12)
    expect(itemFor(ex('a', 0, 90)).durationSec).toBe(30)
    expect(itemFor(ex('a', 0, 2)).durationSec).toBe(5)
  })
  it('arrondit la durée naturelle à 5 s', () => {
    expect(naturalDurationSec(ex('a', 0, 42))).toBe(40)
    expect(naturalDurationSec(ex('a', 0, 900))).toBe(300)
  })
  it('applique un rythme à tous', () => {
    expect(applyRhythm([{ exerciseId: 'a', durationSec: 10, restAfterSec: 0 }], 45, 10)).toEqual([{ exerciseId: 'a', durationSec: 45, restAfterSec: 10 }])
  })
  it('retire une vidéo entière sans toucher aux autres', () => {
    const src: Record<string, string> = { a: 'v1', b: 'v1', c: 'v2', d: 'v1' }
    const items = ['a', 'b', 'c', 'd'].map((id) => ({ exerciseId: id, durationSec: 30, restAfterSec: 0 }))
    expect(removeRun(items, 1, (id) => src[id]).map((i) => i.exerciseId)).toEqual(['c', 'd'])
  })
})
