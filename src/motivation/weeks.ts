/** Semaines du lundi au dimanche, en heure locale de l'appareil. Clés au format semaine ISO (ex. « 2026-W46 »). */

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Lundi (00:00 local) de la semaine contenant d. Calcul par composantes locales : insensible aux changements d'heure. */
export function weekStart(d: Date): Date {
  const x = startOfDay(d)
  const dow = (x.getDay() + 6) % 7 // lundi = 0
  return new Date(x.getFullYear(), x.getMonth(), x.getDate() - dow)
}

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** Semaine ISO : la semaine appartient à l'année de son jeudi. */
export function weekKey(d: Date): string {
  const thursday = addDays(weekStart(d), 3)
  const year = thursday.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const week = Math.floor((Math.round((startOfDay(thursday).getTime() - jan1.getTime()) / 86400000) + 0) / 7) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Mois civil auquel on rattache une semaine pour le joker : celui de son dimanche. */
export const jokerMonthOf = (monday: Date) => monthKey(addDays(monday, 6))
