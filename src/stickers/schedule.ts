/**
 * Rythme des pochettes : presque une par séance au début, puis de plus en plus rare.
 * La pochette numéro n demande `sessionsForPouch(n)` séances comptées de plus que la précédente.
 */
export function sessionsForPouch(n: number): number {
  if (n <= 4) return 1 // pochettes 1 à 4 : à chaque séance
  if (n <= 8) return 2
  if (n <= 12) return 3
  if (n <= 16) return 4
  return 5
}

/** Nombre total de séances comptées nécessaires pour avoir gagné la pochette n. */
export function cumulativeSessions(n: number): number {
  let sum = 0
  for (let k = 1; k <= n; k++) sum += sessionsForPouch(k)
  return sum
}

/** Pochettes de séance gagnées après `total` séances comptées. */
export function pouchesEarned(total: number): number {
  let n = 0
  while (cumulativeSessions(n + 1) <= total) n++
  return n
}

/** Séances qui restent avant la prochaine pochette. */
export function sessionsUntilNextPouch(total: number): number {
  return cumulativeSessions(pouchesEarned(total) + 1) - total
}
