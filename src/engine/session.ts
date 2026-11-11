/**
 * Moteur de séance : un réducteur pur (état, événement) → (état, effets).
 * Il ne touche ni à la vidéo ni au son : une couche d'effets exécute ce qu'il demande.
 * Le temps se calcule par différences d'horloge (`now` en ms, performance.now()), jamais en comptant des intervalles.
 */

export interface PlayItem {
  exerciseId: string
  name: string
  cue?: string
  durationSec: number
  restAfterSec: number
}

export interface SessionConfig {
  items: PlayItem[]
  countdownSec: number
  extendSec: number
}

export type Phase = 'ready' | 'exercise' | 'transition' | 'paused' | 'finished'

export interface SessionState {
  phase: Phase
  /** Phase à retrouver après une pause. */
  resumeTo?: 'exercise' | 'transition'
  index: number
  remainingMs: number
  /** Durée totale de la phase en cours, pour l'anneau du décompte. */
  phaseMs: number
  lastTickAt: number
  /** Temps actif en exercice, pauses exclues. */
  activeMs: number
  extensions: number
  partial: boolean
  config: SessionConfig
}

export type SessionEvent =
  | { type: 'START'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'EXTEND'; now: number }
  | { type: 'SKIP'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'QUIT'; now: number }

export type SessionEffect =
  | { type: 'beep'; kind: 'short' | 'long' }
  | { type: 'speak'; text: string }
  /** Le clip à afficher a changé : index de l'élément courant. */
  | { type: 'showItem'; index: number }
  | { type: 'finished' }

export interface Step {
  state: SessionState
  effects: SessionEffect[]
}

export function createSession(config: SessionConfig): SessionState {
  return { phase: 'ready', index: 0, remainingMs: 0, phaseMs: 0, lastTickAt: 0, activeMs: 0, extensions: 0, partial: false, config }
}

export const plannedSec = (c: SessionConfig) => c.items.reduce((n, i) => n + i.durationSec, 0)

const secLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000))

export function transitionMs(c: SessionConfig, item: PlayItem): number {
  return Math.max(c.countdownSec, item.restAfterSec) * 1000
}

export function speechFor(item: PlayItem): string {
  const base = `Ensuite : ${item.name}, ${item.durationSec} secondes.`
  return item.cue ? `${base} ${item.cue}` : base
}

function enterExercise(s: SessionState, index: number, now: number, ms?: number): Step {
  const item = s.config.items[index]!
  const remainingMs = ms ?? item.durationSec * 1000
  return { state: { ...s, phase: 'exercise', index, remainingMs, phaseMs: remainingMs, lastTickAt: now }, effects: [{ type: 'showItem', index }] }
}

function finish(s: SessionState, now: number, partial: boolean): Step {
  return { state: { ...s, phase: 'finished', remainingMs: 0, lastTickAt: now, partial }, effects: [{ type: 'finished' }] }
}

function enterTransition(s: SessionState, now: number): Step {
  const ms = transitionMs(s.config, s.config.items[s.index]!)
  const next = s.config.items[s.index + 1]!
  return {
    state: { ...s, phase: 'transition', remainingMs: ms, phaseMs: ms, lastTickAt: now },
    effects: [{ type: 'speak', text: speechFor(next) }],
  }
}

export function reduce(s: SessionState, e: SessionEvent): Step {
  const last = s.index >= s.config.items.length - 1
  switch (e.type) {
    case 'START':
      if (s.phase !== 'ready' || s.config.items.length === 0) return { state: s, effects: [] }
      return enterExercise(s, 0, e.now)

    case 'TICK': {
      if (s.phase !== 'exercise' && s.phase !== 'transition') return { state: s, effects: [] }
      const dt = Math.max(0, e.now - s.lastTickAt)
      const remainingMs = s.remainingMs - dt
      const activeMs = s.phase === 'exercise' ? s.activeMs + Math.min(dt, Math.max(0, s.remainingMs)) : s.activeMs
      const effects: SessionEffect[] = []
      // Bips à 3, 2 et 1 seconde de la fin, plus long et plus aigu à zéro.
      const before = secLeft(s.remainingMs)
      const after = secLeft(remainingMs)
      if (before !== after) {
        for (let sec = before - 1; sec >= after; sec--) {
          if (sec >= 1 && sec <= 3) effects.push({ type: 'beep', kind: 'short' })
          if (sec === 0) effects.push({ type: 'beep', kind: 'long' })
        }
      }
      const ticked: SessionState = { ...s, remainingMs: Math.max(0, remainingMs), lastTickAt: e.now, activeMs }
      if (remainingMs > 0) return { state: ticked, effects }
      if (s.phase === 'exercise') {
        const step = last ? finish(ticked, e.now, false) : enterTransition(ticked, e.now)
        return { state: step.state, effects: [...effects, ...step.effects] }
      }
      const step = enterExercise(ticked, s.index + 1, e.now)
      return { state: step.state, effects: [...effects, ...step.effects] }
    }

    case 'EXTEND': {
      const ms = s.config.extendSec * 1000
      if (s.phase === 'exercise') {
        const remainingMs = s.remainingMs + ms
        return { state: { ...s, remainingMs, phaseMs: Math.max(s.phaseMs, remainingMs), extensions: s.extensions + 1, lastTickAt: e.now }, effects: [] }
      }
      if (s.phase === 'transition') {
        const step = enterExercise({ ...s, extensions: s.extensions + 1 }, s.index, e.now, ms)
        return step
      }
      return { state: s, effects: [] }
    }

    case 'SKIP':
      if (s.phase === 'exercise') return last ? finish(s, e.now, false) : enterExercise(s, s.index + 1, e.now)
      if (s.phase === 'transition') return enterExercise(s, s.index + 1, e.now)
      return { state: s, effects: [] }

    case 'PAUSE':
      if (s.phase !== 'exercise' && s.phase !== 'transition') return { state: s, effects: [] }
      {
      // Le temps écoulé depuis le dernier TICK compte avant de figer.
      const ticked = reduce(s, { type: 'TICK', now: e.now })
      if (ticked.state.phase !== s.phase) return ticked
      return { state: { ...ticked.state, phase: 'paused', resumeTo: s.phase, lastTickAt: e.now }, effects: ticked.effects }
    }

    case 'RESUME':
      if (s.phase !== 'paused' || !s.resumeTo) return { state: s, effects: [] }
      return { state: { ...s, phase: s.resumeTo, resumeTo: undefined, lastTickAt: e.now }, effects: [] }

    case 'QUIT':
      if (s.phase === 'finished') return { state: s, effects: [] }
      return finish(s, e.now, true)
  }
}

/** Règle de la section 9 : la séance compte si elle va au bout, ou si le temps actif atteint 80 % du prévu. */
export function sessionCounts(s: SessionState): boolean {
  if (s.phase !== 'finished') return false
  if (!s.partial) return true
  const planned = plannedSec(s.config)
  return planned > 0 && s.activeMs / 1000 >= 0.8 * planned
}
