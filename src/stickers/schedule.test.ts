import { describe, expect, it } from 'vitest'
import { cumulativeSessions, pouchesEarned, sessionsForPouch, sessionsUntilNextPouch } from './schedule'

describe('rythme des pochettes', () => {
  it('une pochette à chacune des 4 premières séances', () => {
    expect([0, 1, 2, 3, 4].map(pouchesEarned)).toEqual([0, 1, 2, 3, 4])
  })
  it('puis de plus en plus rare', () => {
    expect(sessionsForPouch(5)).toBe(2)
    expect(sessionsForPouch(9)).toBe(3)
    expect(sessionsForPouch(13)).toBe(4)
    expect(sessionsForPouch(30)).toBe(5)
    expect(cumulativeSessions(8)).toBe(12)
    expect(pouchesEarned(11)).toBe(7)
    expect(pouchesEarned(12)).toBe(8)
  })
  it('le nombre de séances avant la prochaine ne dépasse jamais l\'écart courant', () => {
    expect(sessionsUntilNextPouch(0)).toBe(1)
    expect(sessionsUntilNextPouch(4)).toBe(2)
    expect(sessionsUntilNextPouch(5)).toBe(1)
    for (let t = 0; t < 200; t++) expect(sessionsUntilNextPouch(t)).toBeGreaterThan(0)
  })
})
