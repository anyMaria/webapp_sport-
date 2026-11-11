import { db, loadSettings } from '../data/db'
import type { StickerUnlock } from '../data/types'
import { computeStreak } from '../motivation/streak'
import { baseIdOf, stickerById } from './catalog'
import { evaluateUnlocks, type UnlockFlags } from './unlock'

const rng = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32

async function readFlags(): Promise<UnlockFlags> {
  const exercises = await db.exercises.toArray()
  const logs = await db.sessionLogs.toArray()
  const perSource = new Map<string, number>()
  for (const e of exercises) perSource.set(e.sourceId, (perSource.get(e.sourceId) ?? 0) + 1)
  const sourceOf = new Map(exercises.map((e) => [e.id, e.sourceId]))
  const workouts = new Map((await db.workouts.toArray()).map((w) => [w.id, w]))
  const mixed = logs.some((l) => {
    const w = workouts.get(l.workoutId)
    return !!w && new Set(w.items.map((i) => sourceOf.get(i.exerciseId)).filter(Boolean)).size >= 2
  })
  return {
    'first-cut': [...perSource.values()].some((n) => n >= 2),
    'first-mixed': mixed,
    'first-extend': logs.some((l) => l.extensions > 0),
  }
}

/** Écrit les déblocages dus. Idempotent, et sérialisé par une transaction pour éviter un double tirage. */
export async function syncUnlocks(now = new Date()): Promise<StickerUnlock[]> {
  const [settings, logs, jokers, flags] = await Promise.all([loadSettings(), db.sessionLogs.toArray(), db.jokerUses.toArray(), readFlags()])
  const result = computeStreak(logs, jokers, { weeklyGoal: settings.weeklyGoal, jokersPerMonth: settings.jokersPerMonth, now })
  return db.transaction('rw', db.stickerUnlocks, async () => {
    // Anciens stickers qui ne sont plus au catalogue (remplacés par les dessins de l'utilisatrice) : retirés, la pochette est retirée au sort.
    const all = await db.stickerUnlocks.toArray()
    const stale = all.filter((u) => !stickerById.has(baseIdOf(u.stickerId)))
    if (stale.length) await db.stickerUnlocks.bulkDelete(stale.map((u) => u.stickerId))
    const owned = all.filter((u) => stickerById.has(baseIdOf(u.stickerId)))
    const fresh = evaluateUnlocks({ validatedWeeks: result.validatedWeeks, countedSessions: logs.filter((l) => l.counted).length, streak: result.streak, owned, flags, rng, now })
    if (fresh.length) await db.stickerUnlocks.bulkPut(fresh)
    return fresh
  })
}

export async function markRevealed(stickerId: string): Promise<void> {
  await db.stickerUnlocks.update(stickerId, { revealed: true })
}
