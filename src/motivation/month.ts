import { dayKey } from './weeks'

export interface MonthCell {
  /** Jour du mois, 0 pour une case de remplissage (avant le 1er ou après le dernier jour). */
  day: number
  key: string
  inMonth: boolean
  done: boolean
  today: boolean
  /** Jour de créneau prévu. */
  slot: boolean
}

export const addMonths = (year: number, month: number, delta: number) => {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** Grille du mois, du lundi au dimanche, complétée jusqu'à des semaines entières. `month` va de 0 à 11. */
export function monthGrid(year: number, month: number, doneKeys: Set<string>, slotDays: number[], today: Date): MonthCell[] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const count = new Date(year, month + 1, 0).getDate()
  const total = Math.ceil((lead + count) / 7) * 7
  const todayKey = dayKey(today)
  return Array.from({ length: total }, (_, i) => {
    const day = i - lead + 1
    if (day < 1 || day > count) return { day: 0, key: `pad-${i}`, inMonth: false, done: false, today: false, slot: false }
    const d = new Date(year, month, day)
    const key = dayKey(d)
    return { day, key, inMonth: true, done: doneKeys.has(key), today: key === todayKey, slot: slotDays.includes(d.getDay()) }
  })
}
