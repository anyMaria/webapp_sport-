import { describe, expect, it } from 'vitest'
import { cumulativeSessions, pouchesEarned, sessionsForPouch, sessionsUntilNextPouch } from './schedule'

describe('rythme des pochettes', () => {
  it('une pochette à chaque séance comptée', () => {
    expect([0, 1, 2, 5, 12, 40].map(pouchesEarned)).toEqual([0, 1, 2, 5, 12, 40])
    expect(sessionsForPouch(30)).toBe(1)
    expect(cumulativeSessions(8)).toBe(8)
  })
  it('la prochaine pochette est toujours à la prochaine séance', () => {
    for (let t = 0; t < 200; t++) expect(sessionsUntilNextPouch(t)).toBe(1)
  })
})
