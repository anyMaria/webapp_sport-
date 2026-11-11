import { describe, expect, it } from 'vitest'
import { SPORT_SUGGESTIONS, sportChoices } from './activities'

const a = (label: string, createdAt: string) => ({ id: label + createdAt, date: '2026-11-14', label, createdAt })

describe('sports notés', () => {
  it('ajoute les sports déjà notés après les suggestions, sans doublon', () => {
    const c = sportChoices([a('Escalade', '2026-11-01'), a('pilates', '2026-11-02'), a('Escalade', '2026-11-03'), a('Boxe', '2026-11-04')])
    expect(c.slice(0, SPORT_SUGGESTIONS.length)).toEqual(SPORT_SUGGESTIONS)
    expect(c.slice(SPORT_SUGGESTIONS.length)).toEqual(['Boxe', 'Escalade'])
  })
})
