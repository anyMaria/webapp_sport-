import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, loadSettings } from '../data/db'
import { DEFAULT_SETTINGS } from '../data/settings'
import type { JokerUse, SessionLog, Settings } from '../data/types'
import { computeStreak, type StreakResult } from './streak'

const NO_LOGS: SessionLog[] = []
const NO_JOKERS: JokerUse[] = []

/** Date courante, rafraîchie chaque minute (changement de jour ou de semaine pendant que l'app est ouverte). */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

export interface Motivation {
  settings: Settings
  logs: SessionLog[]
  result: StreakResult
  now: Date
}

/** Série, semaine en cours et jokers, recalculés à partir du journal. Applique les jokers dus (idempotent). */
export function useMotivation(): Motivation {
  const settings = useLiveQuery(() => loadSettings(), []) ?? DEFAULT_SETTINGS
  const logs = useLiveQuery(() => db.sessionLogs.toArray(), []) ?? NO_LOGS
  const jokers = useLiveQuery(() => db.jokerUses.toArray(), []) ?? NO_JOKERS
  const now = useNow()
  const result = computeStreak(logs, jokers, { weeklyGoal: settings.weeklyGoal, jokersPerMonth: settings.jokersPerMonth, now })
  const pending = result.newJokerUses.map((j) => `${j.monthKey}/${j.weekKey}`).join(',')
  useEffect(() => {
    if (pending) void db.jokerUses.bulkPut(result.newJokerUses)
    // Écrit une fois les jokers dus ; le calcul suivant les relit depuis la base.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])
  return { settings, logs, result, now }
}

/** Message de ton bienveillant : jamais de reproche. */
export function streakMessage(r: StreakResult): string | null {
  if (r.jokerLastWeek) return 'Joker utilisé, ta série continue.'
  if (r.brokeLastWeek) return 'On repart cette semaine.'
  return null
}
