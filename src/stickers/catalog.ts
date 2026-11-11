/**
 * Catalogue des stickers : un fichier de données. Ajouter une série ne demande aucun autre changement de code :
 * ajouter une entrée dans SERIES, les stickers, et leurs dessins dans art/{id}.svg.
 */
export type Rarity = 'common' | 'rare'
export type Unlock =
  | { kind: 'week' } // une semaine validée : tirage au hasard
  | { kind: 'streak'; weeks: number } // palier de série
  | { kind: 'bonus'; event: BonusEvent }

export type BonusEvent = 'first-cut' | 'first-mixed' | 'first-extend'

export interface StickerDef {
  id: string
  name: string
  series: string
  rarity: Rarity
  unlock: Unlock
}

export interface SeriesDef {
  id: string
  name: string
  /** Condition affichée sur les emplacements vides de la planche. */
  condition: (s: StickerDef) => string
}

const week: Unlock = { kind: 'week' }

export const SERIES: SeriesDef[] = [
  { id: 'ciel-nuit', name: 'Ciel de nuit', condition: () => 'Une semaine validée' },
  { id: 'rituels', name: 'Petits rituels', condition: () => 'Une semaine validée' },
  { id: 'pierres', name: 'Pierres', condition: (s) => (s.unlock.kind === 'streak' ? `${s.unlock.weeks} semaines d'affilée` : '') },
  {
    id: 'bonus', name: 'Bonus',
    condition: (s) => {
      if (s.unlock.kind !== 'bonus') return ''
      return { 'first-cut': 'Premier découpage enregistré', 'first-mixed': 'Première séance mêlant deux vidéos', 'first-extend': 'Premier « Encore »' }[s.unlock.event]
    },
  },
]

const c = (id: string, name: string, series: string): StickerDef => ({ id, name, series, rarity: 'common', unlock: week })

export const STICKERS: StickerDef[] = [
  c('croissant-lune', 'Croissant de lune', 'ciel-nuit'),
  c('etoile-filante', 'Étoile filante', 'ciel-nuit'),
  c('saturne', 'Saturne', 'ciel-nuit'),
  c('comete', 'Comète', 'ciel-nuit'),
  c('constellation-chat', 'Constellation du chat', 'ciel-nuit'),
  c('aurore-boreale', 'Aurore boréale', 'ciel-nuit'),
  c('eclipse', 'Éclipse', 'ciel-nuit'),
  c('nebuleuse', 'Nébuleuse', 'ciel-nuit'),

  c('tapis-roule', 'Tapis roulé', 'rituels'),
  c('tasse-fumante', 'Tasse fumante', 'rituels'),
  c('bougie', 'Bougie', 'rituels'),
  c('monstera', 'Monstera', 'rituels'),
  c('chaussettes-epaisses', 'Chaussettes épaisses', 'rituels'),
  c('casque-audio', 'Casque audio', 'rituels'),
  c('gourde', 'Gourde', 'rituels'),
  c('chat-etire', 'Chat qui s\'étire', 'rituels'),

  { id: 'pierre-de-lune', name: 'Pierre de lune', series: 'pierres', rarity: 'rare', unlock: { kind: 'streak', weeks: 4 } },
  { id: 'amethyste', name: 'Améthyste', series: 'pierres', rarity: 'rare', unlock: { kind: 'streak', weeks: 8 } },
  { id: 'labradorite', name: 'Labradorite', series: 'pierres', rarity: 'rare', unlock: { kind: 'streak', weeks: 12 } },
  { id: 'obsidienne-doree', name: 'Obsidienne dorée', series: 'pierres', rarity: 'rare', unlock: { kind: 'streak', weeks: 26 } },
  { id: 'etoile-polaire', name: 'Étoile polaire', series: 'pierres', rarity: 'rare', unlock: { kind: 'streak', weeks: 52 } },

  { id: 'ciseaux-dores', name: 'Ciseaux dorés', series: 'bonus', rarity: 'common', unlock: { kind: 'bonus', event: 'first-cut' } },
  { id: 'mixtape', name: 'Mixtape', series: 'bonus', rarity: 'common', unlock: { kind: 'bonus', event: 'first-mixed' } },
  { id: 'boucle-infinie', name: 'Boucle infinie', series: 'bonus', rarity: 'common', unlock: { kind: 'bonus', event: 'first-extend' } },
]

export const stickerById = new Map(STICKERS.map((s) => [s.id, s]))

/** Stickers tirés au hasard à chaque semaine validée. */
export const WEEKLY_POOL = STICKERS.filter((s) => s.unlock.kind === 'week').map((s) => s.id)

/** Identifiant d'un doublon « brillant » : même dessin, finition dorée. */
export const SHINY_SUFFIX = ':brillant'
export const baseIdOf = (id: string) => id.split(':')[0]!
export const isShiny = (id: string) => id.includes(SHINY_SUFFIX)

const arts = import.meta.glob('./art/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>
/** URL du dessin d'un sticker (les doublons brillants partagent le dessin d'origine). */
export function artUrl(id: string): string {
  return arts[`./art/${baseIdOf(id)}.svg`] ?? ''
}
