export type Source = 'shots' | 'audio' | 'rhythm'

/** Une frontière proposée par un détecteur. `strength` va de 0 à 1 (1 = sans ambiguïté). */
export interface Candidate {
  t: number
  source: Source
  strength: number
}

/** Mouvement moyen entre images voisines, un point par échantillon. */
export interface MotionSeries {
  stepSec: number
  values: number[]
}
