import { describe, expect, it } from 'vitest'
import { FINISH, motivationPhrase, phraseSeed, pick } from './phrases'

const ctx = { slotToday: true, streak: 3, weekDone: true }

describe('phrases', () => {
  it('stable pour une même graine, variées sur plusieurs jours', () => {
    expect(motivationPhrase(ctx, 5)).toBe(motivationPhrase(ctx, 5))
    const set = new Set(Array.from({ length: 30 }, (_, i) => motivationPhrase(ctx, i)))
    expect(set.size).toBeGreaterThan(5)
  })
  it('ne culpabilise jamais', () => {
    const all = [...FINISH, ...Array.from({ length: 40 }, (_, i) => motivationPhrase(ctx, i))].join(' ').toLowerCase()
    for (const bad of ['raté', 'manqué', 'retard', 'dommage', 'paresse', 'enfin']) expect(all).not.toContain(bad)
  })
  it('la graine change entre matin et soir', () => {
    expect(phraseSeed(new Date(2026, 10, 11, 9))).not.toBe(phraseSeed(new Date(2026, 10, 11, 19)))
    expect(pick(['a', 'b'], 3)).toBe('b')
  })
})
