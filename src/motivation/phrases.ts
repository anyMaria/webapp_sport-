/** Phrases d'encouragement qui varient. Jamais de reproche, jamais de compteur de jours manqués. */
export interface PhraseContext {
  slotToday: boolean
  streak: number
  weekDone: boolean
}

const BASE = [
  'Prête pour ta séance ?',
  'Quelques minutes pour toi, c\'est parti.',
  'Ton corps va te dire merci.',
  'On s\'étire un peu ?',
  'Une petite séance, un grand effet.',
  'Respire, déroule-toi, c\'est l\'heure.',
  'Chaque séance compte, même courte.',
]
const SLOT_TODAY = ['C\'est ton jour : on y va ?', 'Ton créneau t\'attend, et ton tapis aussi.']
const STREAK = ['Ta série est belle, continue sur ta lancée.', 'Tu as pris le rythme, ça se voit.']
const WEEK_DONE = ['Semaine validée. Une séance en plus, c\'est du bonus.', 'Objectif atteint : cette séance, c\'est pour le plaisir.']

export const FINISH = [
  'Bravo, séance terminée !',
  'Bien joué, c\'est fait !',
  'Séance terminée. Tu peux être fière.',
  'Et voilà, un beau moment pour toi !',
  'Terminé ! Ton corps te dit merci.',
]

/** Choix stable pour un `seed` donné (par exemple le jour et la demi-journée), qui change d'un moment à l'autre. */
export function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(Math.floor(seed)) % list.length]!
}

export function motivationPhrase(ctx: PhraseContext, seed: number): string {
  const pool = [...BASE, ...(ctx.slotToday ? SLOT_TODAY : []), ...(ctx.streak >= 2 ? STREAK : []), ...(ctx.weekDone ? WEEK_DONE : [])]
  return pick(pool, seed)
}

/** Graine qui change deux fois par jour. */
export const phraseSeed = (d: Date) => d.getFullYear() * 1000 + d.getMonth() * 100 + d.getDate() * 3 + (d.getHours() < 14 ? 0 : 1)
