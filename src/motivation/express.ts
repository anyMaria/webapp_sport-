import type { WorkoutItem } from '../data/types'

export const EXPRESS_TARGET_SEC = 180
export const EXPRESS_MAX_ITEMS = 4

/**
 * Séance express composée avec les premiers exercices : jusqu'à environ 3 minutes, 3 ou 4 exercices.
 * On s'arrête dès que l'ajout du suivant dépasserait 3 minutes (au moins un exercice), ou à 4 exercices.
 */
export function composeExpress(items: WorkoutItem[]): WorkoutItem[] {
  const out: WorkoutItem[] = []
  let total = 0
  for (const it of items) {
    const len = it.durationSec + it.restAfterSec
    if (out.length >= EXPRESS_MAX_ITEMS) break
    if (out.length > 0 && total + len > EXPRESS_TARGET_SEC) break
    out.push(it)
    total += len
  }
  return out
}
