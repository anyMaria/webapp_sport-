import { db } from '../data/db'
import { newId } from '../data/importFile'
import type { Activity } from '../data/types'

/** Sports proposés d'un toucher ; ceux déjà notés s'ajoutent à la liste. */
export const SPORT_SUGGESTIONS = ['Pilates', 'Yoga', 'Course', 'Marche', 'Natation', 'Vélo', 'Danse', 'Muscu']

/** Les suggestions, puis les sports déjà notés (sans doublon, casse ignorée). */
export function sportChoices(past: Activity[]): string[] {
  const seen = new Set(SPORT_SUGGESTIONS.map((s) => s.toLowerCase()))
  const extra: string[] = []
  for (const a of [...past].sort((x, y) => y.createdAt.localeCompare(x.createdAt))) {
    const k = a.label.trim().toLowerCase()
    if (k && !seen.has(k)) { seen.add(k); extra.push(a.label.trim()) }
  }
  return [...SPORT_SUGGESTIONS, ...extra]
}

export async function addActivity(date: string, label: string, durationMin?: number): Promise<void> {
  const a: Activity = { id: newId(), date, label: label.trim() || 'Sport', durationMin, createdAt: new Date().toISOString() }
  await db.activities.put(a)
}

export const removeActivity = (id: string) => db.activities.delete(id)
