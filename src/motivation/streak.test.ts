import { describe, expect, it } from 'vitest'
import type { JokerUse, SessionLog } from '../data/types'
import { computeStreak, effectiveSessions, weekDays } from './streak'
import { monthKey, weekKey, weekStart } from './weeks'

const OPTS = (now: string) => ({ weeklyGoal: 2, jokersPerMonth: 1, now: new Date(now) })
let n = 0
const log = (iso: string, extra: Partial<SessionLog> = {}): SessionLog => ({ id: `l${n++}`, workoutId: 'w', startedAt: iso, endedAt: iso, activeSec: 600, plannedSec: 600, extensions: 0, isExpress: false, counted: true, ...extra })

// 2026-11-09 est un lundi (semaine W46).
describe('semaines ISO', () => {
  it('clés correctes, y compris aux changements d’année', () => {
    expect(weekKey(new Date(2026, 10, 9))).toBe('2026-W46')
    expect(weekKey(new Date(2026, 10, 15))).toBe('2026-W46')
    expect(weekKey(new Date(2026, 10, 16))).toBe('2026-W47')
    expect(weekKey(new Date(2025, 11, 29))).toBe('2026-W01') // lundi 29 déc. 2025 : semaine 1 de 2026
    expect(weekKey(new Date(2027, 0, 1))).toBe('2026-W53') // vendredi 1er janv. 2027
    expect(weekKey(new Date(2027, 0, 4))).toBe('2027-W01')
    expect(weekKey(new Date(2024, 11, 30))).toBe('2025-W01')
  })
  it('le lundi est le début de semaine, dimanche compris', () => {
    expect(weekStart(new Date(2026, 10, 15, 23, 59)).getDate()).toBe(9)
    expect(weekStart(new Date(2026, 10, 9, 0, 1)).getDate()).toBe(9)
  })
  it('la semaine du changement d’heure (hiver 2026, 25 oct.) reste de 7 jours', () => {
    const monday = weekStart(new Date(2026, 9, 28)) // semaine du dimanche 25 oct. = W43 précédente
    expect(monday.getDay()).toBe(1)
    expect(weekKey(new Date(2026, 9, 25, 2, 30))).toBe('2026-W43')
    expect(weekKey(new Date(2026, 9, 26))).toBe('2026-W44')
  })
})

describe('séances comptées', () => {
  it('une seule séance comptée par jour', () => {
    expect(effectiveSessions([log('2026-11-09T08:00:00'), log('2026-11-09T19:00:00')])).toHaveLength(1)
  })
  it('une seule express comptée par semaine', () => {
    const l = effectiveSessions([log('2026-11-09T08:00:00', { isExpress: true }), log('2026-11-10T08:00:00', { isExpress: true }), log('2026-11-11T08:00:00')])
    expect(l).toHaveLength(2)
  })
  it('les séances non comptées sont ignorées', () => {
    expect(effectiveSessions([log('2026-11-09T08:00:00', { counted: false })])).toHaveLength(0)
  })
})

describe('série', () => {
  it('aucune séance : série à zéro, semaine en cours vide', () => {
    const r = computeStreak([], [], OPTS('2026-11-11T12:00:00'))
    expect(r.streak).toBe(0)
    expect(r.current.count).toBe(0)
  })

  it('trois semaines validées d’affilée, la semaine en cours ne casse rien tant qu’elle n’est pas validée', () => {
    const logs = [
      log('2026-10-19T19:00:00'), log('2026-10-21T19:00:00'),
      log('2026-10-26T19:00:00'), log('2026-10-28T19:00:00'),
      log('2026-11-02T19:00:00'), log('2026-11-04T19:00:00'),
      log('2026-11-09T19:00:00'),
    ]
    const r = computeStreak(logs, [], OPTS('2026-11-11T12:00:00'))
    expect(r.streak).toBe(3)
    expect(r.current.count).toBe(1)
    expect(r.validatedWeeks).toEqual(['2026-W43', '2026-W44', '2026-W45'])
  })

  it('la semaine en cours s’ajoute dès qu’elle est validée', () => {
    const logs = [log('2026-11-02T19:00:00'), log('2026-11-04T19:00:00'), log('2026-11-09T19:00:00'), log('2026-11-10T19:00:00')]
    expect(computeStreak(logs, [], OPTS('2026-11-11T12:00:00')).streak).toBe(2)
  })

  it('une semaine à zéro séance remet la série à zéro', () => {
    const logs = [log('2026-10-19T19:00:00'), log('2026-10-21T19:00:00'), log('2026-11-02T19:00:00'), log('2026-11-04T19:00:00')]
    const r = computeStreak(logs, [], OPTS('2026-11-11T12:00:00'))
    expect(r.streak).toBe(1) // W45 validée, W44 vide, W43 effacée
    expect(r.brokeLastWeek).toBe(false)
  })

  it('une semaine à 1 séance avec joker libre : la série continue, sans pochette', () => {
    const logs = [log('2026-10-26T19:00:00'), log('2026-10-28T19:00:00'), log('2026-11-02T19:00:00'), log('2026-11-04T19:00:00'), log('2026-11-05T19:00:00')]
    // W44 : 2 séances ; W45 : 3 séances. Remplaçons W45 par 1 séance :
    const l2 = [logs[0]!, logs[1]!, log('2026-11-03T19:00:00')]
    const r = computeStreak(l2, [], OPTS('2026-11-11T12:00:00'))
    expect(r.streak).toBe(2)
    expect(r.newJokerUses).toEqual([{ monthKey: '2026-11', weekKey: '2026-W45' }])
    expect(r.validatedWeeks).toEqual(['2026-W44'])
    expect(r.jokerLastWeek).toBe(true)
  })

  it('un seul joker par mois : la deuxième semaine à 1 séance casse la série', () => {
    const logs = [
      log('2026-10-12T19:00:00'), log('2026-10-14T19:00:00'), // W42 validée
      log('2026-10-19T19:00:00'), // W43 : 1 séance → joker d'octobre (dimanche 25 oct.)
      log('2026-10-26T19:00:00'), // W44 : 1 séance, dimanche 1er nov. → joker de novembre
    ]
    const r = computeStreak(logs, [], OPTS('2026-11-11T12:00:00'))
    expect(r.newJokerUses.map((j) => j.monthKey)).toEqual(['2026-10', '2026-11'])
    // W45 : 0 séance → série à zéro
    expect(r.streak).toBe(0)
    expect(r.brokeLastWeek).toBe(true)
  })

  it('un joker déjà enregistré compte et n’est pas réattribué', () => {
    const used: JokerUse[] = [{ monthKey: '2026-11', weekKey: '2026-W45' }]
    const logs = [log('2026-11-03T19:00:00'), log('2026-11-09T19:00:00'), log('2026-11-10T19:00:00')]
    const r = computeStreak(logs, used, OPTS('2026-11-11T12:00:00'))
    expect(r.newJokerUses).toEqual([])
    expect(r.streak).toBe(2)
  })

  it('1 séance sans joker disponible : série à zéro', () => {
    const used: JokerUse[] = [{ monthKey: '2026-11', weekKey: '2026-W44' }]
    const logs = [log('2026-11-03T19:00:00')]
    expect(computeStreak(logs, used, OPTS('2026-11-11T12:00:00')).streak).toBe(0)
  })

  it('semaine à cheval sur deux mois : le joker se rattache au mois du dimanche', () => {
    // W44 : lundi 26 oct. → dimanche 1er nov.
    const r = computeStreak([log('2026-10-27T19:00:00')], [], OPTS('2026-11-11T12:00:00'))
    expect(r.newJokerUses[0]).toEqual({ monthKey: '2026-11', weekKey: '2026-W44' })
  })

  it('changement d’année : la série traverse le 1er janvier', () => {
    const logs = [log('2026-12-21T19:00:00'), log('2026-12-23T19:00:00'), log('2026-12-28T19:00:00'), log('2026-12-30T19:00:00'), log('2027-01-04T19:00:00'), log('2027-01-06T19:00:00')]
    const r = computeStreak(logs, [], OPTS('2027-01-08T12:00:00'))
    expect(r.streak).toBe(3)
    expect(r.validatedWeeks).toEqual(['2026-W52', '2026-W53', '2027-W01'])
  })

  it('les limites par jour s’appliquent à la validation', () => {
    const logs = [log('2026-11-09T08:00:00'), log('2026-11-09T19:00:00')]
    expect(computeStreak(logs, [], OPTS('2026-11-11T12:00:00')).current.count).toBe(1)
  })
})

describe('pastilles de la semaine', () => {
  it('faite, aujourd’hui, créneau prévu, vide', () => {
    const r = computeStreak([log('2026-11-09T19:00:00')], [], OPTS('2026-11-11T12:00:00')) // mercredi
    const d = weekDays(r.current, new Date('2026-11-11T12:00:00'), [1, 2, 4])
    expect(d.map((x) => x.state)).toEqual(['done', 'empty', 'today', 'slot', 'empty', 'empty', 'empty'])
  })
  it('clé de mois', () => {
    expect(monthKey(new Date(2026, 0, 31))).toBe('2026-01')
  })
})
