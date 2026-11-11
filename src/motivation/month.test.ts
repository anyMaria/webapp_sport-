import { describe, expect, it } from 'vitest'
import { addMonths, monthGrid } from './month'

describe('mois', () => {
  it('novembre 2026 commence un dimanche : six cases de remplissage avant le 1er', () => {
    const g = monthGrid(2026, 10, new Set(['2026-11-03']), [1], new Date(2026, 10, 11))
    expect(g).toHaveLength(42)
    expect(g.slice(0, 6).every((c) => !c.inMonth)).toBe(true)
    expect(g[6]!.day).toBe(1)
    expect(g.find((c) => c.day === 3)!.done).toBe(true)
    expect(g.find((c) => c.day === 11)!.today).toBe(true)
    expect(g.find((c) => c.day === 2)!.slot).toBe(true) // lundi
    expect(g.filter((c) => c.inMonth)).toHaveLength(30)
  })
  it('passe d\'une année à l\'autre', () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
  })
})
