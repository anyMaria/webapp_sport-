/** Équipement d'une séance : trois choix courants, ou un équipement écrit à la main. Logique pure. */

export const NO_EQUIPMENT = 'Sans équipement'
export const PRESETS = [NO_EQUIPMENT, 'Bandes élastiques', 'Blocs de yoga'] as const
const MAX_LEN = 40

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Ajoute ou retire un équipement. « Sans équipement » exclut tout le reste, et inversement. */
export function toggleEquipment(list: string[], item: string): string[] {
  const label = item.trim().slice(0, MAX_LEN)
  if (!label) return list
  if (list.some((x) => same(x, label))) return list.filter((x) => !same(x, label))
  if (same(label, NO_EQUIPMENT)) return [NO_EQUIPMENT]
  return [...list.filter((x) => !same(x, NO_EQUIPMENT)), label]
}

/** Texte court pour les cartes : « Bandes élastiques · Blocs de yoga ». Vide si rien n'est indiqué. */
export const equipmentText = (list: string[] | undefined) => (list ?? []).join(' · ')

/** Équipements écrits à la main dans d'autres séances, proposés en raccourci (sans les trois choix courants). */
export function customEquipment(all: (string[] | undefined)[]): string[] {
  const out: string[] = []
  for (const list of all) for (const x of list ?? []) if (!PRESETS.some((p) => same(p, x)) && !out.some((o) => same(o, x))) out.push(x)
  return out.sort((a, b) => a.localeCompare(b, 'fr'))
}
