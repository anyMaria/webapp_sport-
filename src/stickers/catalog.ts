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
  { id: 'ciel-nuit', name: 'Ciel de nuit', condition: () => 'Une pochette' },
  { id: 'rituels', name: 'Petits rituels', condition: () => 'Une pochette' },
  { id: 'energie', name: 'Énergie', condition: () => 'Une pochette' },
  { id: 'jardin', name: 'Jardin', condition: () => 'Une pochette' },
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

  c('eclair', 'Éclair', 'energie'),
  c('flamme', 'Flamme', 'energie'),
  c('fusee', 'Fusée', 'energie'),
  c('soleil', 'Soleil', 'energie'),
  c('etoile', 'Étoile', 'energie'),
  c('coeur', 'Cœur', 'energie'),
  c('diamant', 'Diamant', 'energie'),
  c('trophee', 'Trophée', 'energie'),

  c('fleur', 'Fleur', 'jardin'),
  c('feuille', 'Feuille', 'jardin'),
  c('goutte', 'Goutte', 'jardin'),
  c('papillon', 'Papillon', 'jardin'),
  c('champignon', 'Champignon', 'jardin'),
  c('cactus', 'Cactus', 'jardin'),
  c('arcenciel', 'Arc-en-ciel', 'jardin'),
  c('nuage', 'Nuage', 'jardin'),

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

/** Stickers tirés au hasard à chaque pochette (semaine validée ou séances). */
export const WEEKLY_POOL = STICKERS.filter((s) => s.unlock.kind === 'week').map((s) => s.id)

/** Identifiant d'un doublon « brillant » : même dessin, finition dorée. */
export const SHINY_SUFFIX = ':brillant'
export const baseIdOf = (id: string) => id.split(':')[0]!
export const isShiny = (id: string) => id.includes(SHINY_SUFFIX)

const arts = import.meta.glob('./art/*.{svg,png,jpg,jpeg,webp}', { query: '?url', import: 'default', eager: true }) as Record<string, string>
/** URL du dessin d'un sticker (les doublons brillants partagent le dessin d'origine). */
export function artUrl(id: string): string {
  const base = baseIdOf(id)
  for (const ext of ['svg', 'png', 'webp', 'jpg', 'jpeg']) {
    const url = arts[`./art/${base}.${ext}`]
    if (url) return url
  }
  return ''
}
