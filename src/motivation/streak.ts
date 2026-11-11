import type { JokerUse, SessionLog } from '../data/types'
import { addDays, dayKey, jokerMonthOf, startOfDay, weekKey, weekStart } from './weeks'

/** Hypothèses à confirmer avec l'utilisatrice (section 9 du plan) : faciles à changer ici. */
export const MAX_COUNTED_PER_DAY = 1
export const MAX_EXPRESS_PER_WEEK = 1

/**
 * Séances comptées après application des limites : une seule par jour, et une seule express par semaine.
 * On garde la première de chaque jour dans l'ordre chronologique.
 */
export function effectiveSessions(logs: SessionLog[]): SessionLog[] {
  const sorted = logs.filter((l) => l.counted).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const perDay = new Map<string, number>()
  const expressPerWeek = new Map<string, number>()
  const out: SessionLog[] = []
  for (const l of sorted) {
    const d = new Date(l.startedAt)
    const dk = dayKey(d)
    const wk = weekKey(d)
    if ((perDay.get(dk) ?? 0) >= MAX_COUNTED_PER_DAY) continue
    if (l.isExpress && (expressPerWeek.get(wk) ?? 0) >= MAX_EXPRESS_PER_WEEK) continue
    perDay.set(dk, (perDay.get(dk) ?? 0) + 1)
    if (l.isExpress) expressPerWeek.set(wk, (expressPerWeek.get(wk) ?? 0) + 1)
    out.push(l)
  }
  return out
}

export interface WeekSummary {
  key: string
  monday: Date
  count: number
  validated: boolean
  jokered: boolean
  /** Jours (0 = lundi) où une séance a été comptée. */
  days: number[]
}

export interface StreakResult {
  streak: number
  /** Semaines validées par leurs séances (donnent une pochette), joker exclu. */
  validatedWeeks: string[]
  /** Jokers à enregistrer : appliqués automatiquement au changement de semaine. */
  newJokerUses: JokerUse[]
  weeks: WeekSummary[]
  current: WeekSummary
  /** Série remise à zéro à la dernière semaine terminée. */
  brokeLastWeek: boolean
  jokerLastWeek: boolean
}

/**
 * Calcul de la série, par une fonction pure à partir du journal.
 * - Série = semaines validées consécutives en remontant depuis la dernière semaine terminée ; la semaine en cours
 *   s'ajoute dès qu'elle est validée, et ne casse rien tant qu'elle ne l'est pas.
 * - Joker : un par mois civil. Une semaine terminée à exactement 1 séance comptée, joker du mois libre → il s'applique
 *   tout seul, la série continue, sans pochette pour cette semaine.
 * - 0 séance, ou 1 séance sans joker : série à zéro.
 */
export function computeStreak(
  logs: SessionLog[],
  jokerUses: JokerUse[],
  opts: { weeklyGoal: number; jokersPerMonth: number; now: Date },
): StreakResult {
  const eff = effectiveSessions(logs)
  const byWeek = new Map<string, number[]>()
  for (const l of eff) {
    const d = new Date(l.startedAt)
    const k = weekKey(d)
    byWeek.set(k, [...(byWeek.get(k) ?? []), (d.getDay() + 6) % 7])
  }
  const currentMonday = weekStart(opts.now)
  const currentKey = weekKey(currentMonday)
  const first = eff.length ? weekStart(new Date(eff[0]!.startedAt)) : currentMonday

  const usedByWeek = new Map(jokerUses.map((j) => [j.weekKey, j]))
  const jokersInMonth = new Map<string, number>()
  for (const j of jokerUses) jokersInMonth.set(j.monthKey, (jokersInMonth.get(j.monthKey) ?? 0) + 1)

  const weeks: WeekSummary[] = []
  const newJokerUses: JokerUse[] = []
  const validatedWeeks: string[] = []
  let streak = 0
  let brokeLast = false
  let jokerLast = false

  for (let m = first; m <= currentMonday; m = addDays(m, 7)) {
    const key = weekKey(m)
    const days = byWeek.get(key) ?? []
    const count = days.length
    const isCurrent = key === currentKey
    const base: WeekSummary = { key, monday: m, count, validated: count >= opts.weeklyGoal, jokered: false, days }
    if (isCurrent) {
      if (base.validated) { streak++; validatedWeeks.push(key) }
      weeks.push(base)
      break
    }
    brokeLast = false
    jokerLast = false
    if (base.validated) {
      streak++
      validatedWeeks.push(key)
    } else if (count === 1) {
      const month = jokerMonthOf(m)
      const already = usedByWeek.get(key)
      if (already) {
        base.jokered = true
        streak++
        jokerLast = true
      } else if ((jokersInMonth.get(month) ?? 0) < opts.jokersPerMonth) {
        const use: JokerUse = { monthKey: month, weekKey: key }
        newJokerUses.push(use)
        jokersInMonth.set(month, (jokersInMonth.get(month) ?? 0) + 1)
        base.jokered = true
        streak++
        jokerLast = true
      } else {
        brokeLast = streak > 0
        streak = 0
      }
    } else {
      brokeLast = streak > 0
      streak = 0
    }
    weeks.push(base)
  }

  const current = weeks[weeks.length - 1]!
  return { streak, validatedWeeks, newJokerUses, weeks, current, brokeLastWeek: brokeLast, jokerLastWeek: jokerLast }
}

/** Séances qui manquent pour valider la semaine en cours. */
export const remainingThisWeek = (r: StreakResult, goal: number) => Math.max(0, goal - r.current.count)

export type DayState = 'done' | 'today' | 'slot' | 'empty'

/** Sept pastilles de la semaine : faite, aujourd'hui, créneau prévu, vide. */
export function weekDays(current: WeekSummary, now: Date, slotDays: number[]): { label: string; state: DayState }[] {
  const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  const today = (startOfDay(now).getDay() + 6) % 7
  return labels.map((label, i) => {
    const jsDay = (i + 1) % 7 // 1 = lundi … 0 = dimanche, comme settings.slot.days
    let state: DayState = 'empty'
    if (current.days.includes(i)) state = 'done'
    else if (i === today) state = 'today'
    else if (slotDays.includes(jsDay) && i > today) state = 'slot'
    return { label, state }
  })
}
