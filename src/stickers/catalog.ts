/**
 * Catalogue des stickers. Les stickers de l'utilisatrice viennent de mine.ts (généré par scripts/import-stickers.py,
 * dessins dans art/{id}.webp) ; les pierres et les bonus sont définis ici (dessins SVG).
 */
import { MINE, MINE_SERIES, type MineDef } from './mine'

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

const week: Unlock = { kind: 'week' } // tirage au hasard à chaque pochette

const drawn = () => 'Une pochette'

/** Les séries de l'utilisatrice (dossiers importés, voir mine.ts), puis les séries à conditions particulières. */
export const SERIES: SeriesDef[] = [
  ...MINE_SERIES.map((m) => ({ id: m.id, name: m.name, condition: drawn })),
  { id: 'pierres', name: 'Pierres', condition: (s) => (s.unlock.kind === 'streak' ? `${s.unlock.weeks} semaines d'affilée` : '') },
  {
    id: 'bonus', name: 'Bonus',
    condition: (s) => {
      if (s.unlock.kind !== 'bonus') return ''
      return { 'first-cut': 'Premier découpage enregistré', 'first-mixed': 'Première séance mêlant deux vidéos', 'first-extend': 'Premier « Encore »' }[s.unlock.event]
    },
  },
]

const mine = (m: MineDef): StickerDef => ({ id: m.id, name: m.name, series: m.series, rarity: 'common', unlock: week })

export const STICKERS: StickerDef[] = [
  ...MINE.map(mine),

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
