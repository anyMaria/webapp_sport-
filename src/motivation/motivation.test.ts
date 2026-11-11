import { describe, expect, it } from 'vitest'
import { composeExpress } from './express'
import { buildIcs, firstOccurrence, fold, slotKey } from './ics'

const it1 = (d: number, r = 0) => ({ exerciseId: 'x', durationSec: d, restAfterSec: r })

describe('séance express', () => {
  it('prend les premiers exercices jusqu’à 3 minutes', () => {
    expect(composeExpress([it1(60), it1(60), it1(60), it1(60), it1(60)])).toHaveLength(3)
  })
  it('jamais plus de 4 exercices', () => {
    expect(composeExpress(Array.from({ length: 10 }, () => it1(20)))).toHaveLength(4)
  })
  it('garde au moins un exercice même s’il dépasse 3 minutes', () => {
    expect(composeExpress([it1(300), it1(30)])).toHaveLength(1)
  })
  it('compte les repos', () => {
    expect(composeExpress([it1(60, 30), it1(60, 30), it1(60, 30)])).toHaveLength(2)
  })
  it('séance vide : rien', () => {
    expect(composeExpress([])).toEqual([])
  })
})

describe('export du créneau', () => {
  const now = new Date(2026, 10, 11, 12, 0) // mercredi 11 nov. 2026
  const slot = { days: [1, 2, 4], time: '19:00', durationMin: 15 }

  it('premier jour : le prochain jeudi à 19h', () => {
    expect(firstOccurrence(slot.days, slot.time, now)).toEqual(new Date(2026, 10, 12, 19, 0))
  })
  it('aujourd’hui compte si l’heure n’est pas passée, sinon le jour suivant', () => {
    expect(firstOccurrence([3], '19:00', now)).toEqual(new Date(2026, 10, 11, 19, 0))
    expect(firstOccurrence([3], '08:00', now)).toEqual(new Date(2026, 10, 18, 8, 0))
  })

  it('fichier .ics : récurrence hebdomadaire, heure locale flottante, alarme 10 min, URL', () => {
    const ics = buildIcs({ slot, reminder: true, appName: 'Séance', appUrl: 'https://exemple.app/', now })
    expect(ics).toContain('BEGIN:VCALENDAR\r\n')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,TH')
    expect(ics).toContain('DTSTART:20261112T190000\r\n') // pas de Z : heure locale flottante
    expect(ics).toContain('DTEND:20261112T191500')
    expect(ics).toContain('TRIGGER:-PT10M')
    expect(ics).toContain('URL:https://exemple.app/')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
  })
  it('sans rappel : pas d’alarme', () => {
    expect(buildIcs({ slot, reminder: false, appName: 'Séance', appUrl: 'https://x/', now })).not.toContain('VALARM')
  })
  it('ordonne les jours du lundi au dimanche, dimanche en dernier', () => {
    const ics = buildIcs({ slot: { days: [0, 6, 1], time: '07:30', durationMin: 20 }, reminder: true, appName: 'S', appUrl: 'https://x/', now })
    expect(ics).toContain('BYDAY=MO,SA,SU')
  })
  it('plie les longues lignes à 75 octets, accents compris', () => {
    const long = 'SUMMARY:' + 'é'.repeat(60)
    const folded = fold(long)
    expect(folded.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
    expect(folded.replace(/\r\n /g, '')).toBe(long)
  })
  it('la clé du créneau change quand le créneau change', () => {
    expect(slotKey(slot)).not.toBe(slotKey({ ...slot, time: '18:00' }))
    expect(slotKey(slot)).toBe(slotKey({ ...slot, days: [4, 2, 1] }))
  })
})
