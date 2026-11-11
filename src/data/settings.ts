import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  weeklyGoal: 3,
  minInApp: 2,
  jokersPerMonth: 1,
  slot: { days: [1, 2, 4], time: '19:00', durationMin: 15 },
  audioMode: 'music+beeps',
  countdownSec: 5,
  extendSec: 30,
  beepVolume: 0.6,
  userName: '',
  reminder: true,
  expressFallback: true,
}
