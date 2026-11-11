import { describe, expect, it } from 'vitest'
import type { StickerUnlock } from '../data/types'
import { SERIES, STICKERS, WEEKLY_POOL, artUrl, isShiny } from './catalog'
import { distinctOwned, drawWeekly, evaluateUnlocks, type UnlockInput } from './unlock'

const NOW = new Date('2026-11-11T12:00:00Z')
const flags = { 'first-cut': false, 'first-mixed': false, 'first-extend': false }
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]! }
const base = (extra: Partial<UnlockInput> = {}): UnlockInput => ({ validatedWeeks: [], streak: 0, owned: [], flags, rng: seq(0), now: NOW, ...extra })
const own = (...ids: string[]): StickerUnlock[] => ids.map((stickerId) => ({ stickerId, reason: 'week', weekKey: `w-${stickerId}`, unlockedAt: 'x', revealed: true }))

describe('catalogue', () => {
  it('40 stickers : 8 + 8 + 8 + 8 + 5 + 3, tous avec un dessin', () => {
    expect(STICKERS).toHaveLength(40)
    const count = (s: string) => STICKERS.filter((x) => x.series === s).length
    expect([count('ciel-nuit'), count('rituels'), count('energie'), count('jardin'), count('pierres'), count('bonus')]).toEqual([8, 8, 8, 8, 5, 3])
    expect(WEEKLY_POOL).toHaveLength(32)
    expect(STICKERS.every((s) => artUrl(s.id).length > 0)).toBe(true)
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(40)
  })
  it('chaque série a une condition lisible pour ses emplacements vides', () => {
    for (const ser of SERIES) for (const s of STICKERS.filter((x) => x.series === ser.id)) expect(ser.condition(s).length).toBeGreaterThan(0)
  })
  it('les pierres sont rares', () => {
    expect(STICKERS.filter((s) => s.rarity === 'rare').map((s) => s.series)).toEqual(Array(5).fill('pierres'))
  })
})

describe('tirage hebdomadaire', () => {
  it('ne tire que des stickers pas encore obtenus', () => {
    const owned = new Set(WEEKLY_POOL.slice(0, WEEKLY_POOL.length - 1))
    expect(drawWeekly(owned, seq(0.5))).toBe(WEEKLY_POOL[WEEKLY_POOL.length - 1])
  })
  it('tous obtenus : doublon brillant, puis brillants numérotés', () => {
    const all = new Set(WEEKLY_POOL)
    const first = drawWeekly(all, seq(0))
    expect(isShiny(first)).toBe(true)
    for (const id of WEEKLY_POOL) all.add(`${id}:brillant`)
    const next = drawWeekly(all, seq(0))
    expect(next).toBe(`${WEEKLY_POOL[0]}:brillant2`)
  })
})

describe('déblocages', () => {
  it('une pochette par semaine validée, une seule fois', () => {
    const first = evaluateUnlocks(base({ validatedWeeks: ['2026-W45', '2026-W46'] }))
    expect(first.map((u) => u.weekKey)).toEqual(['2026-W45', '2026-W46'])
    expect(first.every((u) => !u.revealed && u.reason === 'week')).toBe(true)
    expect(new Set(first.map((u) => u.stickerId)).size).toBe(2)
    const again = evaluateUnlocks(base({ validatedWeeks: ['2026-W45', '2026-W46'], owned: first }))
    expect(again).toEqual([])
  })
  it('un joker ne donne pas de pochette (il n’est pas dans les semaines validées)', () => {
    expect(evaluateUnlocks(base({ validatedWeeks: [] }))).toEqual([])
  })
  it('les pierres se débloquent aux paliers de série', () => {
    const at = (streak: number) => evaluateUnlocks(base({ streak })).map((u) => u.stickerId)
    expect(at(3)).toEqual([])
    expect(at(4)).toEqual(['pierre-de-lune'])
    expect(at(12)).toEqual(['pierre-de-lune', 'amethyste', 'labradorite'])
    expect(at(52)).toHaveLength(5)
  })
  it('une pierre déjà obtenue reste acquise même si la série retombe', () => {
    const owned = [{ stickerId: 'pierre-de-lune', reason: 'milestone' as const, unlockedAt: 'x', revealed: true }]
    expect(evaluateUnlocks(base({ streak: 4, owned }))).toEqual([])
    expect(evaluateUnlocks(base({ streak: 0, owned }))).toEqual([])
  })
  it('les bonus se débloquent au premier événement', () => {
    const r = evaluateUnlocks(base({ flags: { ...flags, 'first-cut': true, 'first-extend': true } }))
    expect(r.map((u) => u.stickerId)).toEqual(['ciseaux-dores', 'boucle-infinie'])
    expect(r.every((u) => u.reason === 'bonus')).toBe(true)
  })
  it('comptage des stickers distincts', () => {
    expect(distinctOwned(own('saturne', 'saturne:brillant', 'bougie'))).toBe(2)
  })
})

describe('pochettes de séance', () => {
  it('une pochette par séance au début, sans doublon sur un second appel', () => {
    const first = evaluateUnlocks(base({ countedSessions: 3, rng: seq(0.1, 0.5, 0.9) }))
    expect(first.filter((u) => u.reason === 'session').map((u) => u.sessionNo)).toEqual([1, 2, 3])
    expect(new Set(first.map((u) => u.stickerId)).size).toBe(3)
    expect(evaluateUnlocks(base({ countedSessions: 3, owned: first }))).toEqual([])
  })
  it('plus rare ensuite : 6 séances = 5 pochettes, 7 = toujours 5, 8 = 6', () => {
    const five = evaluateUnlocks(base({ countedSessions: 6, rng: seq(0.1, 0.5, 0.9, 0.3, 0.7) }))
    expect(five).toHaveLength(5)
    expect(evaluateUnlocks(base({ countedSessions: 7, owned: five }))).toEqual([])
    expect(evaluateUnlocks(base({ countedSessions: 8, owned: five }))).toHaveLength(1)
  })
})
