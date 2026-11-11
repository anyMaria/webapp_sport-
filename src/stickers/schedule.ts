/**
 * Rythme des pochettes : une pochette à chaque séance comptée (choix de l'utilisatrice).
 * Pour revenir à des pochettes de plus en plus rares, il suffit de changer cette fonction (la pochette numéro n
 * demande `sessionsForPouch(n)` séances comptées de plus que la précédente).
 */
export function sessionsForPouch(n: number): number {
  void n
  return 1
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
