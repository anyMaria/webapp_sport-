import type { StickerUnlock } from '../data/types'
import { SHINY_SUFFIX, STICKERS, WEEKLY_POOL, baseIdOf, type BonusEvent } from './catalog'

export interface UnlockFlags {
  'first-cut': boolean
  'first-mixed': boolean
  'first-extend': boolean
}

export interface UnlockInput {
  /** Semaines validées par leurs séances (joker exclu), clés ISO. */
  validatedWeeks: string[]
  /** Série en cours, pour les paliers. */
  streak: number
  owned: StickerUnlock[]
  flags: UnlockFlags
  /** Générateur dans [0, 1) ; injecté pour les tests. */
  rng: () => number
  now: Date
}

/** Choix d'un sticker hebdomadaire : un non obtenu ; sinon un doublon brillant ; sinon un brillant numéroté. */
export function drawWeekly(ownedIds: Set<string>, rng: () => number): string {
  const pick = (list: string[]) => list[Math.floor(rng() * list.length)]!
  const fresh = WEEKLY_POOL.filter((id) => !ownedIds.has(id))
  if (fresh.length) return pick(fresh)
  const shinies = WEEKLY_POOL.map((id) => `${id}${SHINY_SUFFIX}`).filter((id) => !ownedIds.has(id))
  if (shinies.length) return pick(shinies)
  const base = pick(WEEKLY_POOL)
  let n = 2
  while (ownedIds.has(`${base}${SHINY_SUFFIX}${n}`)) n++
  return `${base}${SHINY_SUFFIX}${n}`
}

/**
 * Déblocages dus, à écrire (non révélés). Idempotent : appelé plusieurs fois avec le résultat déjà écrit, ne renvoie rien.
 * - Chaque semaine validée donne une pochette (une seule par semaine).
 * - Les pierres se débloquent aux paliers de série (4, 8, 12, 26, 52 semaines).
 * - Les bonus se débloquent au premier événement.
 */
export function evaluateUnlocks(inp: UnlockInput): StickerUnlock[] {
  const out: StickerUnlock[] = []
  const ownedIds = new Set(inp.owned.map((u) => u.stickerId))
  const weeksDone = new Set(inp.owned.filter((u) => u.reason === 'week').map((u) => u.weekKey))
  const iso = inp.now.toISOString()

  for (const wk of [...inp.validatedWeeks].sort()) {
    if (weeksDone.has(wk)) continue
    const id = drawWeekly(ownedIds, inp.rng)
    ownedIds.add(id)
    out.push({ stickerId: id, reason: 'week', weekKey: wk, unlockedAt: iso, revealed: false })
  }
  for (const s of STICKERS) {
    if (ownedIds.has(s.id)) continue
    if (s.unlock.kind === 'streak' && inp.streak >= s.unlock.weeks) {
      ownedIds.add(s.id)
      out.push({ stickerId: s.id, reason: 'milestone', unlockedAt: iso, revealed: false })
    }
    if (s.unlock.kind === 'bonus' && inp.flags[s.unlock.event as BonusEvent]) {
      ownedIds.add(s.id)
      out.push({ stickerId: s.id, reason: 'bonus', unlockedAt: iso, revealed: false })
    }
  }
  return out
}

/** Nombre de stickers distincts obtenus (les doublons brillants ne comptent pas deux fois). */
export const distinctOwned = (owned: StickerUnlock[]) => new Set(owned.map((u) => baseIdOf(u.stickerId))).size
